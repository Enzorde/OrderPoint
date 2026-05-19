import express, { Request, Response } from "express";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, addDoc, orderBy, runTransaction, writeBatch } from 'firebase/firestore';
import crypto from "crypto";
import fs from "fs";
import path from "path";

let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
} catch (e) {
  firebaseConfig = {}; // fallback if not found
}

const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const hashPassword = (password: string) => crypto.createHash('sha256').update(password).digest('hex');

// Helpers
const checkGestor = async (req: Request, res: Response) => {
  const userIdHeader = req.headers['x-user-id'] as string;
  if (!userIdHeader) { res.status(401).json({ error: "Não autorizado." }); return false; }
  const userSnap = await getDoc(doc(db, "users", userIdHeader));
  const user = userSnap.data();
  if (!user || (user.role !== 'manager' && user.role !== 'superadmin')) { res.status(403).json({ error: "Acesso negado." }); return false; }
  return user;
};

const checkSuperAdmin = async (req: Request, res: Response) => {
  const userIdHeader = req.headers['x-user-id'] as string;
  if (!userIdHeader) { res.status(401).json({ error: "Não autorizado." }); return false; }
  const userSnap = await getDoc(doc(db, "users", userIdHeader));
  const user = userSnap.data();
  if (!user || user.role !== 'superadmin') { res.status(403).json({ error: "Acesso negado. Apenas superadmins." }); return false; }
  return user;
};

// ----- USERS -----
const parseDoc = (d: any) => ({ id: d.id, ...d.data() });

app.post(["/api/register", "/usuarios"], async (req: Request, res: Response) => {
  const { name, email, senha, code } = req.body;
  if (!name || !email || !senha || !code) return res.status(400).json({ error: "Nome, e-mail, senha e código são obrigatórios." });

  // verify code
  const qCode = query(collection(db, "verification_codes"), where("email", "==", email));
  const codeSnaps = await getDocs(qCode);
  if (codeSnaps.empty) return res.status(400).json({ error: "Nenhum código solicitado para este e-mail." });
  const record: any = parseDoc(codeSnaps.docs[0]);
  if (record.code !== code) return res.status(400).json({ error: "Código inválido." });
  if (Date.now() > record.expires_at) return res.status(400).json({ error: "Código expirado." });

  const q = query(collection(db, "users"), where("email", "==", email));
  const snaps = await getDocs(q);
  if (!snaps.empty) return res.status(400).json({ error: "E-mail já cadastrado." });

  const matricula = email.split('@')[0];
  const hashedSenha = hashPassword(senha);

  const newUser = await addDoc(collection(db, "users"), {
    name, email, matricula, senha: hashedSenha, role: 'student', points: 0, canteen_id: null, created_at: Date.now()
  });
  
  await deleteDoc(doc(db, "verification_codes", record.id));
  res.status(201).json({ success: true, userId: newUser.id });
});

app.post("/api/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: "E-mail e senha são obrigatórios." });

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
});

app.get("/api/users", async (req, res) => {
  if (!await checkSuperAdmin(req, res)) return;
  const snaps = await getDocs(collection(db, "users"));
  res.json(snaps.docs.map(parseDoc).map((u: any) => ({ id: u.id, name: u.name, email: u.email, matricula: u.matricula, role: u.role, canteen_id: u.canteen_id, points: u.points })));
});

app.get("/api/users/:id", async (req, res) => {
  const snap = await getDoc(doc(db, "users", req.params.id));
  if (snap.exists()) {
    const u = snap.data();
    res.json({ success: true, user: { id: snap.id, name: u.name, email: u.email, matricula: u.matricula, role: u.role, points: u.points, canteen_id: u.canteen_id } });
  } else {
    res.status(404).json({ error: "Usuário não encontrado." });
  }
});

app.put("/api/users/:id", async (req, res) => {
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
      return { pData: p, newPoints: u.points - p.points_price };
    });
    res.json({ success: true, newPoints: result.newPoints, product: { id: productId, ...result.pData, price: 0, isReward: true, points_price: result.pData.points_price } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/request-code", async (req, res) => {
  const { email } = req.body;
  const code = crypto.randomInt(100000, 1000000).toString();
  await addDoc(collection(db, "verification_codes"), { email, code, expires_at: Date.now() + 10 * 60 * 1000 });
  res.json({ success: true, message: "Código enviado (simulado no Vercel). O código é: " + code });
});

// ----- PRODUCTS -----
app.get(["/api/products", "/produtos"], async (req, res) => {
  const snaps = await getDocs(collection(db, "products"));
  res.json(snaps.docs.map(parseDoc));
});

app.post("/api/products", async (req, res) => {
  if (!await checkGestor(req, res)) return;
  const newRef = await addDoc(collection(db, "products"), { ...req.body, stock: req.body.stock ?? 10, active: 1 });
  res.status(201).json({ success: true, id: newRef.id });
});

app.put("/api/products/:id", async (req, res) => {
  if (!await checkGestor(req, res)) return;
  await updateDoc(doc(db, "products", req.params.id), req.body);
  res.json({ success: true });
});

app.delete("/api/products/:id", async (req, res) => {
  if (!await checkGestor(req, res)) return;
  await deleteDoc(doc(db, "products", req.params.id));
  res.json({ success: true });
});

// ----- CANTEENS -----
app.get(["/api/canteens", "/cantinas"], async (req, res) => {
  const snaps = await getDocs(collection(db, "canteens"));
  res.json(snaps.docs.map(parseDoc));
});

app.post("/api/canteens", async (req, res) => {
  if (!await checkSuperAdmin(req, res)) return;
  const newRef = await addDoc(collection(db, "canteens"), req.body);
  res.status(201).json({ success: true, canteenId: newRef.id });
});

app.put("/api/canteens/:id", async (req, res) => {
  await updateDoc(doc(db, "canteens", req.params.id), req.body);
  res.json({ success: true });
});

app.delete("/api/canteens/:id", async (req, res) => {
  if (!await checkSuperAdmin(req, res)) return;
  await deleteDoc(doc(db, "canteens", req.params.id));
  res.json({ success: true });
});

// ----- SETTINGS -----
app.get("/api/settings", async (req, res) => {
  const snaps = await getDocs(collection(db, "settings"));
  const settingsMap: any = {};
  snaps.docs.forEach(d => settingsMap[d.data().key] = d.data().value);
  res.json(settingsMap);
});

// ----- COUPONS -----
app.get("/api/coupons", async (req, res) => {
  const snaps = await getDocs(collection(db, "coupons"));
  res.json(snaps.docs.map(parseDoc));
});

app.post("/api/coupons", async (req, res) => {
  await addDoc(collection(db, "coupons"), req.body);
  res.json({ success: true });
});

app.post("/api/coupons/validate", async (req, res) => {
  const { code, canteen_id } = req.body;
  const q = query(collection(db, "coupons"), where("code", "==", code), where("canteen_id", "==", canteen_id));
  const snaps = await getDocs(q);
  if (snaps.empty) return res.status(404).json({ error: "Cupom inválido." });
  res.json({ success: true, coupon: parseDoc(snaps.docs[0]) });
});

app.put("/api/coupons/:id", async (req, res) => {
  await updateDoc(doc(db, "coupons", req.params.id), req.body);
  res.json({ success: true });
});

app.delete("/api/coupons/:id", async (req, res) => {
  await deleteDoc(doc(db, "coupons", req.params.id));
  res.json({ success: true });
});

// ----- OTHERS -----
['categories', 'tags'].forEach(coll => {
  app.get(`/api/${coll}`, async (req, res) => res.json((await getDocs(collection(db, coll))).docs.map(parseDoc)));
  app.post(`/api/${coll}`, async (req, res) => res.status(201).json({ success: true, id: (await addDoc(collection(db, coll), req.body)).id }));
  app.delete(`/api/${coll}/:id`, async (req, res) => { await deleteDoc(doc(db, coll, req.params.id)); res.json({ success: true }); });
});

app.post("/api/ratings", async (req, res) => {
  await addDoc(collection(db, "ratings"), req.body);
  res.status(201).json({ success: true });
});

// ----- ORDERS -----
app.get("/api/orders", async (req, res) => {
  const snaps = await getDocs(query(collection(db, "orders"), orderBy("created_at", "desc")));
  res.json(snaps.docs.map(parseDoc));
});

app.get("/api/orders/user/:id", async (req, res) => {
  const snaps = await getDocs(query(collection(db, "orders"), where("user_id", "==", req.params.id)));
  res.json(snaps.docs.map(parseDoc));
});

app.post("/api/orders", async (req, res) => {
  const { user_name, user_id, items, total, canteen_id } = req.body;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  
  const newRef = await addDoc(collection(db, "orders"), {
    code, user_name, user_id, items: JSON.stringify(items), total, status: 'aguardando', canteen_id, created_at: Date.now(), points_awarded: 0
  });

  // deduct stock (simple approach without tx for brevity)
  for (const item of items) {
    if (item.id) {
       const pRef = doc(db, "products", item.id);
       const p = (await getDoc(pRef)).data();
       if (p) await updateDoc(pRef, { stock: Math.max(0, p.stock - item.qty) });
    }
  }

  res.status(201).json({ success: true, code, id: newRef.id });
});

app.put("/api/orders/:id/status", async (req, res) => {
  const { status, cancel_reason } = req.body;
  await updateDoc(doc(db, "orders", req.params.id), { status, cancel_reason: cancel_reason || null });
  res.json({ success: true });
});

app.delete("/api/orders/:id", async (req, res) => {
  await deleteDoc(doc(db, "orders", req.params.id));
  res.json({ success: true });
});

export default app;
