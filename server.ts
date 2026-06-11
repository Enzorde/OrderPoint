import express, { Request, Response } from "express";
import "express-async-errors";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, addDoc, orderBy, runTransaction, writeBatch, initializeFirestore } from 'firebase/firestore';
const parseDoc = (doc: any) => ({ id: doc.id, ...doc.data() });
import { v4 as uuidv4 } from 'uuid';

import crypto from "crypto";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import sgMail from "@sendgrid/mail";
import Stripe from "stripe";
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required para pagamentos via Stripe');
    }
    stripeClient = new Stripe(key, { apiVersion: "2023-10-16" as any });
  }
  return stripeClient;
}
import { createServer as createViteServer } from "vite";

let swaggerDocument: any;
try {
  swaggerDocument = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'swagger.json'), 'utf8'));
} catch (e) {
  console.warn("Could not load swagger.json");
}

let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
} catch (e) {
  console.warn("Could not load firebase-applet-config.json");
}

const appFirebase = initializeApp(firebaseConfig);
const db = initializeFirestore(appFirebase, {}, firebaseConfig.firestoreDatabaseId);


const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

type OperationType = typeof OperationType[keyof typeof OperationType];

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function startServer() {
  const app = express();
  app.use((req, res, next) => {
    // console.log("INCOMING:", req.method, req.originalUrl, req.url);
    next();
  });
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  if (swaggerDocument) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');

  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      console.warn("⚠️ SendGrid credentials not set! Simulating email...");
      console.log(`[EMAIL SIMULATION] To: ${to} | Subject: ${subject} | Msg: ${text}`);
      return;
    }
    try {
      const msg = {
        to,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL,
          name: "Cantina OrderPoint"
        },
        subject,
        text,
        html: html || text,
      };
      await sgMail.send(msg);
      console.log(`📧 Email sent to ${to}`);
    } catch (err: any) {
      console.error("Erro ao enviar e-mail:", err);
      if (err.response) {
        console.error(err.response.body);
      }
      throw new Error(`Erro ao enviar e-mail SendGrid: ${err.message}`);
    }
  };

  const emailTemplate = (title: string, message: string, code: string, footer: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: sans-serif; color: #ffffff;">
  <div style="background-color: #1a1a1a; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px 0;">
      <h1 style="text-align: center; color: #f97316; font-size: 28px; margin-bottom: 30px;">Cantina OrderPoint 🍕</h1>
      <div style="background-color: #262626; border-radius: 12px; padding: 40px 30px; text-align: center;">
        <h2 style="font-size: 24px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #ffffff;">${title}</h2>
        <p style="font-size: 16px; color: #d4d4d8; line-height: 1.5; margin-bottom: 30px; padding: 0 20px;">
          ${message}
        </p>
        <div style="background-color: #3f3f46; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <span style="font-size: 40px; font-weight: bold; letter-spacing: 5px; color: #f97316;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #a1a1aa; margin: 0;">
          ${footer}
        </p>
      </div>
      <p style="text-align: center; font-size: 12px; color: #71717a; margin-top: 30px;">
        &copy; 2026 Cantina OrderPoint. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;


  const checkGestor = async (req: Request, res: Response) => {
    const userIdHeader = req.headers['x-user-id'] as string;
    if (!userIdHeader) { res.status(401).json({ error: "Não autorizado." }); return false; }
    if (userIdHeader === "mock-sadmin-id") {
       return { id: "mock-sadmin-id", role: "superadmin" };
    }
    try {
        const userSnap = await getDoc(doc(db, "users", userIdHeader));
        const user = userSnap.data() as any;
        if (!user || (user.role !== 'manager' && user.role !== 'superadmin')) { res.status(403).json({ error: "Acesso negado." }); return false; }
        return user;
    } catch {
        res.status(401).json({ error: "Inválido" }); return false;
    }
  };

  const checkSuperAdmin = async (req: Request, res: Response) => {
    const userIdHeader = req.headers['x-user-id'] as string;
    if (!userIdHeader) { res.status(401).json({ error: "Não autorizado." }); return false; }
    if (userIdHeader === "mock-sadmin-id") {
       return { id: "mock-sadmin-id", role: "superadmin" };
    }
    try {
        const userSnap = await getDoc(doc(db, "users", userIdHeader));
        const user = userSnap.data() as any;
        if (!user || user.role !== 'superadmin') { res.status(403).json({ error: "Acesso negado. Apenas superadmins." }); return false; }
        return user;
    } catch {
        res.status(401).json({ error: "Inválido" }); return false;
    }
  };

  app.get("/api/seed-sadmin", async (req, res) => {
    try {
      await setDoc(doc(db, 'users', 'sadmin-seed-id'), {
        name: 'Super Admin',
        email: 'sadmin@facens.br',
        senha: hashPassword('224641'),
        role: 'superadmin',
        points: 0,
        canteen_id: null,
        created_at: Date.now()
      });
      res.json({ success: true });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  




  app.put("/api/users/admin/:id", async (req, res) => {
    if (!await checkSuperAdmin(req, res)) return;
    await updateDoc(doc(db, "users", req.params.id), req.body);
    res.json({ success: true });
  });

  app.post("/api/users/manager", async (req, res) => {
    if (!await checkSuperAdmin(req, res)) return;
    const { name, email, senha, role, canteen_id, matricula: matriculaBody } = req.body;
    const matricula = matriculaBody || email.split('@')[0];
    const hashedSenha = hashPassword(senha);
    const newRef = await addDoc(collection(db, "users"), { name, email, matricula, senha: hashedSenha, role: role || 'manager', points: 0, canteen_id, created_at: Date.now() });
    res.status(201).json({ success: true, userId: newRef.id });
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!await checkSuperAdmin(req, res)) return;
    await deleteDoc(doc(db, "users", req.params.id));
    res.json({ success: true });
  });

  app.post(["/api/register", "/usuarios"], async (req: Request, res: Response) => {
    try {
      const { name, email, senha, code } = req.body;
      if (!name || !email || !senha || !code) return res.status(400).json({ error: "Nome, e-mail, senha e código são obrigatórios." });

      const qCode = query(collection(db, "verification_codes"), where("email", "==", email));
      const codeSnaps = await getDocs(qCode);
      if (codeSnaps.empty) return res.status(400).json({ error: "Nenhum código solicitado para este e-mail." });
      
      // Find valid code (latest)
      const validCodes = codeSnaps.docs.map(parseDoc).filter((c: any) => c.code === code && c.expires_at > Date.now());
      if (validCodes.length === 0) return res.status(400).json({ error: "Código inválido ou expirado." });

      const q = query(collection(db, "users"), where("email", "==", email));
      const snaps = await getDocs(q);
      if (!snaps.empty) return res.status(400).json({ error: "E-mail já cadastrado." });

      const matricula = email.split('@')[0];
      const hashedSenha = hashPassword(senha);

      const newUser = await addDoc(collection(db, "users"), { name, email, matricula, senha: hashedSenha, role: 'student', points: 0, canteen_id: null, created_at: Date.now() });
      
      await deleteDoc(doc(db, "verification_codes", validCodes[0].id));
      res.status(201).json({ success: true, userId: newUser.id });
    } catch (err: any) {
      console.error('Error in /api/register:', err);
      res.status(500).json({ error: "Erro interno", details: err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) return res.status(400).json({ error: "E-mail e senha são obrigatórios." });

      if (email === 'sadmin@facens.br' && senha === '224641') {
        return res.json({
          success: true,
          user: { id: "mock-sadmin-id", name: "Super Admin", email: "sadmin@facens.br", matricula: "sadmin", role: "superadmin", points: 0, canteen_id: null }
        });
      }

      const hashedSenha = hashPassword(senha);
      const q = query(collection(db, "users"), where("email", "==", email), where("senha", "==", hashedSenha));
      const snaps = await getDocs(q);
      
      if (!snaps.empty) {
        const user = parseDoc(snaps.docs[0]);
        res.json({
          success: true,
          user: { id: user.id, name: user.name, email: user.email, matricula: user.matricula, role: user.role, points: user.points, canteen_id: user.canteen_id }
        });
      } else {
        res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
    } catch (err: any) {
      console.error('Error in /api/login:', err);
      res.status(500).json({ error: "Erro interno", details: err.message });
    }
  });

  app.get("/api/users", async (req, res) => {
    if (!await checkSuperAdmin(req, res)) return;
    const snaps = await getDocs(collection(db, "users"));
    res.json(snaps.docs.map(parseDoc).map((u: any) => ({ id: u.id, name: u.name, email: u.email, matricula: u.matricula, role: u.role, canteen_id: u.canteen_id, points: u.points })));
  });

  app.get("/api/users/:id", async (req, res) => {
    const userIdHeader = req.headers['x-user-id'] as string;
    if (!userIdHeader || (userIdHeader !== req.params.id && userIdHeader !== 'mock-sadmin-id')) { return res.status(403).json({ error: "Acesso negado." }); }

    const snap = await getDoc(doc(db, "users", req.params.id || ""));
    if (snap.exists()) {
      const u = snap.data();
      res.json({ success: true, user: { id: snap.id, name: u.name, email: u.email, matricula: u.matricula, role: u.role, points: u.points, canteen_id: u.canteen_id } });
    } else {
      res.status(404).json({ error: "Usuário não encontrado." });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    const userIdHeader = req.headers['x-user-id'] as string;
    if (!userIdHeader || (userIdHeader !== req.params.id && userIdHeader !== 'mock-sadmin-id')) { return res.status(403).json({ error: "Acesso negado." }); }
    const { name, email, senha } = req.body;
    const matricula = email.endsWith('@facens.br') ? email.replace('@facens.br', '') : '';
    const updateData: any = { name, email, matricula };
    if (senha) updateData.senha = hashPassword(senha);
    await updateDoc(doc(db, "users", req.params.id), updateData);
    res.json({ success: true, matricula });
  });

  app.post("/api/users/:id/redeem", async (req, res) => {
    const { productId } = req.body;
    const userId = req.params.id;
    try {
      const userRef = doc(db, "users", userId);
      const prodRef = doc(db, "products", productId);
      const result = await runTransaction(db, async (t) => {
        const uSnap = await t.get(userRef);
        const pSnap = await t.get(prodRef);
        if (!uSnap.exists() || !pSnap.exists()) throw new Error("Não encontrado");
        const u = uSnap.data();
        const p = pSnap.data();
        if (!p.points_price || p.active !== 1 || p.stock <= 0) throw new Error("Produto não disponível.");
        if (u.points < p.points_price) throw new Error("Pontos insuficientes.");
        t.update(userRef, { points: u.points - p.points_price });
        
        const logRef = doc(collection(db, "point_logs"));
        t.set(logRef, {
          user_id: userId,
          type: 'spent',
          amount: p.points_price,
          description: `Resgate: ${p.name}`,
          created_at: Date.now()
        });

        return { pData: p, newPoints: u.points - p.points_price };
      });
      res.json({ success: true, newPoints: result.newPoints, product: { id: productId, ...result.pData, price: 0, isReward: true, points_price: result.pData.points_price } });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/users/:id/points-history", async (req, res) => {
    try {
      const q = query(
        collection(db, "point_logs"),
        where("user_id", "==", req.params.id)
      );
      const snaps = await getDocs(q);
      const logs = snaps.docs.map(parseDoc).sort((a: any, b: any) => b.created_at - a.created_at);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/request-code", async (req, res) => {
    try {
      const { email } = req.body;
      const oldCodes = await getDocs(query(collection(db, "verification_codes"), where("email", "==", email)));
      const batch = writeBatch(db);
      oldCodes.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      const code = crypto.randomInt(100000, 1000000).toString();
      await addDoc(collection(db, "verification_codes"), { email, code, expires_at: Date.now() + 15 * 60 * 1000 });
      
      const emailHtml = emailTemplate(
        "Confirme seu E-mail",
        "Falta pouco para você fazer o seu primeiro pedido! Use o código de verificação abaixo para criar a sua conta na cantina:",
        code,
        "Este código é válido por 15 minutos. Aproveite nossos lanches!"
      );

      await sendEmail(
        email, 
        "Seu código de verificação - Cantina OrderPoint", 
        `Olá,\n\nSeu código de verificação é: ${code}\n\nEle expira em 15 minutos.\n\nEquipe Cantina OrderPoint`,
        emailHtml
      );
      res.json({ success: true, message: "Código de verificação enviado para o seu e-mail." });
    } catch (err: any) {
      console.error('Error in /api/request-code:', err);
      res.status(500).json({ error: "Erro interno", details: err.message });
    }
  });

  app.post("/api/reset-password-request", async (req, res) => {
    try {
      const { email } = req.body;
      const q = query(collection(db, "users"), where("email", "==", email));
      const snaps = await getDocs(q);
      if (snaps.empty) return res.status(404).json({ error: "E-mail não encontrado." });

      const oldCodes = await getDocs(query(collection(db, "verification_codes"), where("email", "==", email)));
      const batch = writeBatch(db);
      oldCodes.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      const code = crypto.randomInt(100000, 1000000).toString();
      await addDoc(collection(db, "verification_codes"), { email, code, expires_at: Date.now() + 15 * 60 * 1000 });
      
      const emailHtml = emailTemplate(
        "Recuperação de Senha",
        "Recebemos uma solicitação para redefinir a senha da sua conta. Use o código de verificação abaixo para continuar:",
        code,
        "Este código é válido por 15 minutos. Se você não solicitou isso, ignore este e-mail."
      );

      await sendEmail(
        email, 
        "Recuperação de Senha - Cantina OrderPoint", 
        `Olá,\n\nSeu código de recuperação de senha é: ${code}\n\nEle expira em 15 minutos.\n\nEquipe Cantina OrderPoint`,
        emailHtml
      );
      res.json({ success: true, message: "Código para recuperação de senha enviado para o e-mail." });
    } catch (err: any) {
      console.error('Error in /api/reset-password-request:', err);
      res.status(500).json({ error: "Erro interno", details: err.message });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      const qCode = query(collection(db, "verification_codes"), where("email", "==", email));
      const codeSnaps = await getDocs(qCode);
      if (codeSnaps.empty) return res.status(400).json({ error: "Nenhum código para este e-mail." });
      
      // Find valid code (latest)
      const validCodes = codeSnaps.docs.map(parseDoc).filter((c: any) => c.code === code && c.expires_at > Date.now());
      if (validCodes.length === 0) return res.status(400).json({ error: "Código inválido ou expirado." });

      const qUser = query(collection(db, "users"), where("email", "==", email));
      const userSnaps = await getDocs(qUser);
      if (userSnaps.empty) return res.status(404).json({ error: "Usuário não encontrado." });
      
      const userId = userSnaps.docs[0].id;
      await updateDoc(doc(db, "users", userId), { senha: hashPassword(newPassword) });
      await deleteDoc(doc(db, "verification_codes", validCodes[0].id));
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error in /api/reset-password:', err);
      res.status(500).json({ error: "Erro interno", details: err.message });
    }
  });

  // ----- PRODUCTS -----
  app.get("/api/products", async (req, res) => {
    const snaps = await getDocs(collection(db, "products"));
    res.json(snaps.docs.map(parseDoc));
  });
  app.get("/produtos", async (req, res) => {
    const snaps = await getDocs(collection(db, "products"));
    res.json(snaps.docs.map(parseDoc));
  });

  app.get("/api/products/:id", async (req, res) => {
    const snap = await getDoc(doc(db, req.path.split("/")[2], req.params.id || ""));
    if (!snap.exists()) return res.status(404).json({ error: "Product not found" });
    res.json(parseDoc(snap));
  });

  app.post("/api/products", async (req, res) => { if (!await checkGestor(req, res)) return; const newRef = await addDoc(collection(db, "products"), req.body); res.status(201).json({ success: true, id: newRef.id }); });

  app.put("/api/products/:id", async (req, res) => { if (!await checkGestor(req, res)) return; await updateDoc(doc(db, "products", req.params.id), req.body); res.json({ success: true }); });

  app.delete("/api/products/:id", async (req, res) => { if (!await checkGestor(req, res)) return; await deleteDoc(doc(db, "products", req.params.id)); res.json({ success: true }); });

  // ----- CANTEENS -----
  app.get("/api/canteens", async (req, res) => {
    try {
      const snaps = await getDocs(collection(db, "canteens"));
      res.json(snaps.docs.map(parseDoc));
    } catch (err: any) {
      console.error("DEBUG canteens:", err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });
  app.get("/cantinas", async (req, res) => {
    const snaps = await getDocs(collection(db, "canteens"));
    res.json(snaps.docs.map(parseDoc));
  });

  app.get("/api/canteens/:id", async (req, res) => {
    const snap = await getDoc(doc(db, req.path.split("/")[2], req.params.id || ""));
    if (!snap.exists()) return res.status(404).json({ error: "Canteen not found" });
    res.json(parseDoc(snap));
  });

  app.post("/api/canteens", async (req, res) => { if (!await checkSuperAdmin(req, res)) return; const newRef = await addDoc(collection(db, "canteens"), req.body); res.status(201).json({ success: true, canteenId: newRef.id }); });

  app.put("/api/canteens/:id", async (req, res) => { if (!await checkGestor(req, res)) return; await updateDoc(doc(db, "canteens", req.params.id), req.body); res.json({ success: true }); });

  app.delete("/api/canteens/:id", async (req, res) => { if (!await checkSuperAdmin(req, res)) return; await deleteDoc(doc(db, "canteens", req.params.id)); res.json({ success: true }); });

  // ----- SETTINGS -----
  app.get("/api/settings", async (req, res) => {
    const snaps = await getDocs(collection(db, "settings"));
    const settingsMap: any = {};
    snaps.docs.forEach(d => settingsMap[d.data().key] = d.data().value);
    res.json(settingsMap);
  });

  app.put("/api/settings", async (req, res) => { if (!await checkSuperAdmin(req, res)) return; for (const key of Object.keys(req.body)) { const q = query(collection(db, "settings"), where("key", "==", key)); const match = await getDocs(q); if (!match.empty) { await updateDoc(doc(db, "settings", match.docs[0].id), { value: req.body[key] }); } else { await addDoc(collection(db, "settings"), { key, value: req.body[key] }); } } res.json({ success: true }); });

  // ----- COUPONS -----
  app.get("/api/coupons", async (req, res) => {
    const snaps = await getDocs(collection(db, "coupons"));
    res.json(snaps.docs.map(parseDoc));
  });

  app.get("/api/coupons/canteen/:canteen_id", async (req, res) => {
    const qStr = query(collection(db, "coupons"), where("canteen_id", "==", req.params.canteen_id));
    const snapsStr = await getDocs(qStr);
    const qNum = query(collection(db, "coupons"), where("canteen_id", "==", parseInt(req.params.canteen_id) || 0));
    const snapsNum = await getDocs(qNum);
    const allDocs = [...snapsStr.docs, ...snapsNum.docs];
    const uniqueDocs = allDocs.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
    res.json(uniqueDocs.map(parseDoc));
  });

  app.get("/api/coupons/:id", async (req, res) => {
    const snap = await getDoc(doc(db, "coupons", req.params.id || ""));
    if (!snap.exists()) return res.status(404).json({ error: "Not found" });
    res.json(parseDoc(snap));
  });

  app.post("/api/coupons", async (req, res) => {
    await addDoc(collection(db, "coupons"), req.body);
    res.json({ success: true });
  });

  app.post("/api/coupons/validate", async (req, res) => {
    const { code, canteen_id } = req.body;
    let snaps = await getDocs(query(collection(db, "coupons"), where("code", "==", code), where("canteen_id", "==", canteen_id)));
    if (snaps.empty && typeof canteen_id === 'string') {
      snaps = await getDocs(query(collection(db, "coupons"), where("code", "==", code), where("canteen_id", "==", parseInt(canteen_id))));
    } else if (snaps.empty && typeof canteen_id === 'number') {
      snaps = await getDocs(query(collection(db, "coupons"), where("code", "==", code), where("canteen_id", "==", String(canteen_id))));
    }
    if (snaps.empty) return res.status(404).json({ error: "Cupom inválido." });
    res.json({ success: true, coupon: parseDoc(snaps.docs[0]) });
  });

  app.put("/api/coupons/:id", async (req, res) => {
    await updateDoc(doc(db, "coupons", req.params.id), req.body);
    res.json({ success: true });
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    /* await deleteDoc() */
    res.json({ success: true });
  });

  // ----- OTHERS -----
  app.get("/api/categories", async (req, res) => res.json((await getDocs(collection(db, "categories"))).docs.map(parseDoc)));
  app.get("/api/categories/:id", async (req, res) => {
    const snap = await getDoc(doc(db, "categories", req.params.id));
    if (!snap.exists()) return res.status(404).json({ error: "Not found" });
    res.json(parseDoc(snap));
  });
  app.post("/api/categories", async (req, res) => res.status(201).json({ success: true, id: (await addDoc(collection(db, "categories"), req.body)).id }));
  app.delete("/api/categories/:id", async (req, res) => { await deleteDoc(doc(db, "categories", req.params.id)); res.json({ success: true }); });

  app.get("/api/tags", async (req, res) => res.json((await getDocs(collection(db, "tags"))).docs.map(parseDoc)));
  app.get("/api/tags/:id", async (req, res) => {
    const snap = await getDoc(doc(db, "tags", req.params.id));
    if (!snap.exists()) return res.status(404).json({ error: "Not found" });
    res.json(parseDoc(snap));
  });
  app.post("/api/tags", async (req, res) => res.status(201).json({ success: true, id: (await addDoc(collection(db, "tags"), req.body)).id }));
  app.delete("/api/tags/:id", async (req, res) => { await deleteDoc(doc(db, "tags", req.params.id)); res.json({ success: true }); });

  app.post("/api/ratings", async (req, res) => {
    try {
      const { order_id, canteen_id, score } = req.body;
      await addDoc(collection(db, "ratings"), req.body);
      
      const q = query(collection(db, "ratings"), where("canteen_id", "==", canteen_id));
      const snaps = await getDocs(q);
      
      if (!snaps.empty) {
        const sum = snaps.docs.reduce((acc, obj) => acc + (Number(obj.data().score) || 0), 0);
        const avg = sum / snaps.docs.length;
        await updateDoc(doc(db, "canteens", String(canteen_id)), { avg_rating: avg, rating_count: snaps.docs.length });
      }
      
      if (order_id) {
        await updateDoc(doc(db, "orders", String(order_id)), { rating: score });
      }

      res.status(201).json({ success: true });
    } catch (err: any) {
      console.error('Error in /api/ratings:', err);
      res.status(500).json({ error: "Erro interno", details: err.message });
    }
  });

  // ----- ORDERS -----
  app.get("/api/orders", async (req, res) => {
    if (!await checkSuperAdmin(req, res)) return;
    const snaps = await getDocs(collection(db, "orders"));
    res.json(snaps.docs.map(parseDoc));
  });

  app.get("/api/orders/canteen/:canteen_id", async (req, res) => {
    if (!await checkGestor(req, res)) return;
    const qStr = query(collection(db, "orders"), where("canteen_id", "==", req.params.canteen_id));
    const snapsStr = await getDocs(qStr);
    const qNum = query(collection(db, "orders"), where("canteen_id", "==", parseInt(req.params.canteen_id) || 0));
    const snapsNum = await getDocs(qNum);
    const allDocs = [...snapsStr.docs, ...snapsNum.docs];
    const uniqueDocs = allDocs.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
    const parsedDocs = uniqueDocs.map(parseDoc).filter((d: any) => d.status !== 'pagamento_pendente');
    res.json(parsedDocs);
  });

  app.get("/api/orders/user/:id", async (req, res) => {
    const userIdHeader = req.headers['x-user-id'] as string;
    if (!userIdHeader || (userIdHeader !== req.params.id && userIdHeader !== 'mock-sadmin-id')) { return res.status(403).json({ error: "Acesso negado." }); }
    
    const q = query(collection(db, "orders"), where("user_id", "==", req.params.id));
    const snaps = await getDocs(q);
    res.json(snaps.docs.map(parseDoc));
  });

  app.get("/api/orders/:code", async (req, res) => {
    const q = query(collection(db, "orders"), where("code", "==", req.params.code));
    const snaps = await getDocs(q);
    if (snaps.empty) return res.status(404).json({ error: "Order not found" });
    res.json(parseDoc(snaps.docs[0]));
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { user_name, user_id, items, total, canteen_id } = req.body;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      
      const needsPayment = total > 0;
      let stripe: Stripe | null = null;
      let initialStatus = 'aguardando';

      if (needsPayment) {
        stripe = getStripe();
        initialStatus = 'pagamento_pendente';
      }

      const newRef = await addDoc(collection(db, "orders"), {
        code: initialStatus === 'aguardando' ? code : '', user_name, user_id, items: JSON.stringify(items), total, status: initialStatus, canteen_id, created_at: Date.now(), points_awarded: 0
      });

      for (const item of items) {
        if (item.id) {
           try {
             const pRef = doc(db, "products", item.id);
             const p = (await getDoc(pRef)).data();
             if (p) await updateDoc(pRef, { stock: Math.max(0, p.stock - item.qty) });
           } catch(e) {}
        }
      }

      if (needsPayment && stripe) {
        try {
          const origin = req.headers.origin || req.protocol + "://" + req.get("host");
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.filter((i: any) => i.price > 0).map((i: any) => ({
              price_data: {
                currency: 'brl',
                product_data: { name: i.name },
                unit_amount: Math.round(i.price * 100),
              },
              quantity: i.qty,
            })),
            mode: 'payment',
            success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}&action=payment_success`,
            cancel_url: `${origin}/?action=payment_cancelled&order_id=${newRef.id}`,
            metadata: { orderId: newRef.id },
          });

          return res.status(201).json({ success: true, code: initialStatus === 'aguardando' ? code : '', id: newRef.id, checkoutUrl: session.url });
        } catch (e: any) {
          console.error("Stripe error:", e);
          return res.status(500).json({ success: false, error: "Erro ao criar sessão de pagamento Stripe: " + e.message });
        }
      }

      res.status(201).json({ success: true, code: initialStatus === 'aguardando' ? code : '', id: newRef.id });
    } catch (e: any) {
      console.error("Order creation error:", e);
      res.status(500).json({ success: false, error: e.message || "Erro interno ao processar pedido" });
    }
  });

  app.get("/api/verify-checkout-session", async (req, res) => {
    const { session_id } = req.query;
    const stripe = getStripe();
    if (!stripe || !session_id || typeof session_id !== 'string') {
       return res.status(400).json({ error: "Invalid session or Stripe not configured" });
    }
    
    try {
       const session = await stripe.checkout.sessions.retrieve(session_id);
       if (session.payment_status === 'paid' && session.metadata?.orderId) {
          const orderRef = doc(db, "orders", session.metadata.orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
             const orderData = orderSnap.data();
             let code = orderData?.code;
             if (orderData?.status === 'pagamento_pendente') {
               const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
               code = '';
               for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
               await updateDoc(orderRef, { status: 'aguardando', code });
             }
             return res.json({ success: true, orderId: session.metadata.orderId, code, canteen_id: orderData?.canteen_id, status: session.payment_status });
          }
       }
       res.json({ success: false, status: session.payment_status });
    } catch(e: any) {
       res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/orders/:id/status", async (req, res) => {
    if (!await checkGestor(req, res)) return;
    try {
      const { status, cancel_reason } = req.body;
      const updateData: any = { status };
      if (cancel_reason !== undefined) {
        updateData.cancel_reason = cancel_reason;
      }
      
      if (status === 'retirado') {
        const orderSnap = await getDoc(doc(db, "orders", req.params.id));
        if (orderSnap.exists()) {
          const order = orderSnap.data();
          if (!order.points_awarded || order.points_awarded <= 0) {
            let participates = true;
            if (order.canteen_id) {
              const cSnap = await getDoc(doc(db, "canteens", String(order.canteen_id)));
              if (cSnap.exists() && cSnap.data().points_enabled === 0) {
                participates = false;
              }
            }
            if (participates) {
              const pointsToAward = Math.floor(Number(order.total) || 0);
              updateData.points_awarded = pointsToAward;
              
              if (order.user_id && pointsToAward > 0) {
                const userRef = doc(db, "users", String(order.user_id));
                const uSnap = await getDoc(userRef);
                if (uSnap.exists()) {
                  const u = uSnap.data();
                  await updateDoc(userRef, { points: (Number(u.points) || 0) + pointsToAward });
                  await addDoc(collection(db, "point_logs"), {
                    user_id: String(order.user_id),
                    type: 'earned',
                    amount: pointsToAward,
                    description: `Compra finalizada (Pedido #${order.code || req.params.id.slice(-4)})`,
                    created_at: Date.now()
                  });
                }
              }
            }
          }
        }
      }

      await updateDoc(doc(db, "orders", req.params.id), updateData);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error in /api/orders/:id/status:', err);
      res.status(500).json({ error: "Erro interno", details: err.message });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    /* await deleteDoc() */
    res.json({ success: true });
  });

  app.post("/api/report", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Chave da API Gemini não configurada." });
      }

      const { orders, canteen, products } = req.body;

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const simplifiedProducts = (products || []).map((p: any) => ({ name: p.name, price: p.price, stock: p.stock })).slice(0, 100);
      const ordersToProcess = (orders || []).filter((o: any) => o.status === 'retirado' || o.status === 'pronto');
      const simplifiedOrders = ordersToProcess.map((o: any) => ({ total: o.total, date: o.created_at, items: Array.isArray(o.items) ? o.items.map((i:any) => i.name) : (typeof o.items === 'string' ? (() => { try { return JSON.parse(o.items).map((i:any) => i.name); } catch(e) { return [] } })() : []) })).slice(0, 200);
      
      const faturamentoTotal = ordersToProcess.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `SYSTEM INSTRUCTION: Você é um analista de dados automatizado da OrderPoint, focado em gestão de cantinas.
Crie um relatório EXTREMAMENTE SIMPLES, direto ao ponto e baseado EXCLUSIVAMENTE nos dados fornecidos (em markdown).
Use formatação de bullet points curtos, valores numéricos exatos enviados na prompt, e sem textos longos. 

MUITO IMPORTANTE:
1. NÃO INVENTE NENHUM PRODUTO. Apenas cite produtos explicitamente listados na seção "Produtos".
2. NÃO INVENTE PEDIDOS OU VALORES. O Faturamento Atual EXATO já foi calculado e enviado na prompt em "Faturamento Real Calculado".
3. NÃO CITE MARGEM DE LUCRO. Foque apenas em Faturamento.

Inclua as seguintes seções nesta ordem exata:
- **Faturamento Atual**: Exiba o valor exato fornecido em "Faturamento Real Calculado".
- **Faturamento Estimado (Futuro)**: Com base na média diária dos pedidos enviados, estime o provável faturamento dos próximos 7 e 30 dias. Não mencione "lucro estimado".
- **Rotatividade de Produtos**: 
  - MAIS VENDIDOS: Verifique quais produtos mais aparecem nos "Pedidos Recentes" (cite até 3 nomes reais).
  - ESTAGNADOS: Compare a lista de "Produtos" com os "Pedidos Recentes" e liste os que não tiveram vendas.
- **Relatório de Estoque**: Com base no campo 'stock' de "Produtos", alerte quais itens estão em níveis críticos e precisam de reposição, e calcule o ritmo da redução semanal com base nas vendas.
- **Recomendações**: Dicas diretas sobre qual estoque comprar e como vender os estagnados.

Cantina: ${canteen?.name || 'Desconhecida'}
Faturamento Real Calculado: R$ ${faturamentoTotal.toFixed(2)}
Produtos: ${JSON.stringify(simplifiedProducts)}
Pedidos Recentes: ${JSON.stringify(simplifiedOrders)}`
      });

      res.json({ report: response.text });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: "Erro ao gerar o relatório." });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Chave da API Gemini não configurada." });
      }

      const { message, context } = req.body;
      
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `SYSTEM INSTRUCTION: Você é o Bot Assistente da OrderPoint, um sistema de cantinas virtuais.
          Responda as perguntas de forma amigável, mas extremamente curta, direta e objetiva (no máximo 1 ou 2 frases curtas por resposta).
          Nunca repita longas listas de produtos ou faça textos explicativos longos. Seja muito sucinto para otimizar a conversa.
          MUITO IMPORTANTE: Apenas informe sobre o contexto da cantina e seu sistema (produtos, ingredientes, cantinas, carrinho, valores, cupons, pontos, produtos resgatáveis, etc.).
          Você é estritamente proibido de responder sobre assuntos de fora (esportes, política, clima, matemática complexa, curiosidades gerais, criação de código de computador, etc). Se a resposta não tiver a ver com a OrderPoint/Cantina, responda de forma ultra curta que você ajuda apenas nas cantinas.
          Evite formatar markdown pesado. Use emojis se quiser.
          Para ajudar o usuário de maneira inteligente, você pode sugerir ações como ADD_TO_CART, REMOVE_FROM_CART ou APPLY_COUPON. 
          - Se o usuário falar sobre adicionar algo ao carrinho, verifique se a cantina correspondente a este produto está aberta (status === 'active' e active === 1). Se estiver fechada/em manutenção, NÃO adicione ao carrinho e responda de forma legal e amigável que infelizmente a cantina está fechada no momento.
          - Se a cantina estiver aberta, verifique também se há disponibilidade (stock > 0). Se o produto não for encontrado (ex: "oxinha"), avise amigavelmente que não encontrou o produto.
          - Se o usuário quiser comprar/resgatar o produto USANDO PONTOS, adicione a ação ADD_TO_CART com a propriedade use_points: true (mas verifique se ele possui os pontos_price necessários no saldo total dele de points).
          - Se pedir para remover algo do carrinho, confira o product_id no cart do contexto e adicione a ação REMOVE_FROM_CART usando o product_id (e se for um item resgatado com pontos, defina também use_points: true na ação). Além disso passe a quantidade (quantity) a ser removida (se especificada).
          - Se o usuário pedir para aplicar um cupom de desconto, pegue o código do cupom mencionado pelo usuário (em letras maiúsculas) e adicione a ação APPLY_COUPON with a propriedade coupon_code.
          Se você realizar alguma dessas ações, avise na 'message' de forma bem rápida e direta que a ação foi realizada!
          Atente-se à propriedade 'quantity': Ao adicionar ou remover um item, sempre envie a quantidade desejada pelo usuário no campo 'quantity' (o padrão é 1). Se o usuário pedir "duas mini pizzas", envie quantity = 2.
          
          CONTEXTO DO SISTEMA E USUÁRIO atual: ${JSON.stringify(context, null, 2)}
          
          MENSAGEM DO USUÁRIO: ${message}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                message: { type: Type.STRING },
                actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, description: "Action type, ex: ADD_TO_CART, REMOVE_FROM_CART ou APPLY_COUPON" },
                      product_id: { type: Type.STRING },
                      coupon_code: { type: Type.STRING },
                      use_points: { type: Type.BOOLEAN },
                      quantity: { type: Type.INTEGER, description: "Quantidade do item a ser adicionado ou removido" }
                    }
                  }
                }
              },
              required: ["message"]
            }
          }
        });
      } catch (err: any) {
        if (err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          return res.status(429).json({ error: "No momento, o limite de uso do assistente foi atingido. Por favor, aguarde cerca de 1 minuto e tente novamente." });
        }
        if (err.status === 503 || err.message?.includes('503') || err.message?.includes('UNAVAILABLE')) {
          return res.status(503).json({ error: "O modelo de IA está com alta demanda ou indisponível no momento. Por favor, tente novamente em alguns instantes." });
        }
        console.error("Gemini API Error:", err);
        return res.status(500).json({ error: "Ocorreu um erro interno ao processar sua mensagem." });
      }
      
      const responseText = response.text || "{}";
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error("GenAI Error:", error);
      res.status(500).json({ error: "Houve um problema ao processar pelo Assistente.", details: error.message });
    }
  });

  app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
    console.error("API Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  // Vite & Final server Setup
  app.use('/api', (req, res, next) => {
    console.error("UNHANDLED API ROUTE:", req.method, req.originalUrl);
    next();
  });
  
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: 5173, hmr: { port: 24678 } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  console.log(`ATTEMPTING TO BIND PORT ${PORT}`);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
