import express from "express";
type Request = express.Request;
type Response = express.Response;
import { createServer as createViteServer } from "vite";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import crypto from "crypto";
import swaggerUi from "swagger-ui-express";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter;
async function initMailer() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Configuração real para Outlook / Office 365
    transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      requireTLS: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log("Real Outlook SMTP initialized.");
  } else {
    // Fallback para Ethereal (Testes)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("Ethereal Email initialized (Fallback de testes).");
  }
}
initMailer();

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Cantina API',
    version: '1.0.0',
    description: 'API para o sistema de cantina',
  },
  paths: {
    '/usuarios': {
      post: {
        summary: 'Cadastra um novo usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  senha: { type: 'string' }
                },
                required: ['name', 'email', 'senha']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Cadastro válido (Criado)'
          },
          '400': {
            description: 'Dados inválidos'
          }
        }
      }
    },
    '/cantinas': {
      get: {
        summary: 'Retorna nome e foto das 3 cantinas',
        responses: {
          '200': {
            description: 'Lista de cantinas'
          }
        }
      }
    },
    '/produtos': {
      get: {
        summary: 'Retorna produtos ativos, opcionalmente filtrados por categoria',
        parameters: [
          {
            name: 'categoria',
            in: 'query',
            required: false,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Lista de produtos'
          }
        }
      }
    },
    '/produtos/{id}': {
      get: {
        summary: 'Retorna foto, nome, ingredientes e preço de um produto',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Detalhes do produto'
          },
          '404': {
            description: 'Produto não encontrado'
          }
        }
      }
    }
  }
};

const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// ============================================================================
// Database Manager
// ============================================================================
class DatabaseManager {
  public db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync('./database.sqlite');
    this.initializeSchema();
    this.seedData();
  }

  private initializeSchema() {
    // Users
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        matricula TEXT,
        senha TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        points INTEGER DEFAULT 0,
        canteen_id INTEGER DEFAULT NULL
      )
    `);
    try { this.db.exec("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0"); } catch (e) {}
    try { this.db.exec("ALTER TABLE users ADD COLUMN canteen_id INTEGER DEFAULT NULL"); } catch (e) {}
    try { this.db.exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (e) {}

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Products
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        desc TEXT NOT NULL,
        price REAL NOT NULL,
        emoji TEXT NOT NULL,
        cat TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        stock INTEGER DEFAULT 10,
        points_price INTEGER DEFAULT NULL,
        canteen_id INTEGER DEFAULT 1
      )
    `);
    try { this.db.exec("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10"); } catch (e) {}
    try { this.db.exec("ALTER TABLE products ADD COLUMN points_price INTEGER DEFAULT NULL"); } catch (e) {}
    try { this.db.exec("ALTER TABLE products ADD COLUMN canteen_id INTEGER DEFAULT 1"); } catch (e) {}
    try { this.db.exec("ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}

    // Tags
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        canteen_id INTEGER NOT NULL
      )
    `);

    // Orders
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        user_name TEXT NOT NULL,
        user_id INTEGER,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'aguardando',
        canteen_id INTEGER DEFAULT 1,
        points_awarded INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add user_id column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE orders ADD COLUMN user_id INTEGER`);
    } catch (e) {
      // Column might already exist
    }
    try { this.db.exec("ALTER TABLE orders ADD COLUMN canteen_id INTEGER DEFAULT 1"); } catch (e) {}
    try { this.db.exec("ALTER TABLE orders ADD COLUMN points_awarded INTEGER DEFAULT 0"); } catch (e) {}

    // Canteens
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS canteens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        desc TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        emoji TEXT NOT NULL,
        color TEXT NOT NULL,
        open_time TEXT NOT NULL DEFAULT '08:00',
        close_time TEXT NOT NULL DEFAULT '18:00',
        points_enabled INTEGER DEFAULT 1
      )
    `);
    try { this.db.exec("ALTER TABLE canteens ADD COLUMN location TEXT NOT NULL DEFAULT ''"); } catch (e) {}
    try { this.db.exec("ALTER TABLE canteens ADD COLUMN points_enabled INTEGER DEFAULT 1"); } catch (e) {}

    // Ratings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER UNIQUE NOT NULL,
        canteen_id INTEGER NOT NULL DEFAULT 1,
        score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try { this.db.exec("ALTER TABLE ratings ADD COLUMN canteen_id INTEGER NOT NULL DEFAULT 1"); } catch (e) {}

    // Categories
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // Coupons
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_pct REAL NOT NULL,
        max_uses INTEGER DEFAULT NULL,
        used_count INTEGER DEFAULT 0,
        expires_at DATETIME DEFAULT NULL,
        min_value REAL DEFAULT 0,
        canteen_id INTEGER NOT NULL,
        active INTEGER DEFAULT 1
      )
    `);
    try { this.db.exec("ALTER TABLE coupons ADD COLUMN min_value REAL DEFAULT 0"); } catch (e) {}
  }

  private seedData() {
    // Seed Mock User
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get('admin@facens.br') as any;
    if (userCount.count === 0) {
      const insertUser = this.db.prepare('INSERT INTO users (name, email, matricula, senha, role, canteen_id) VALUES (?, ?, ?, ?, ?, ?)');
      insertUser.run('Admin Teste', 'admin@facens.br', 'admin', hashPassword('224641'), 'student', null);
      
      // Seed Gestores
      insertUser.run('Cantina Central', 'central@facens.br', null, hashPassword('123456'), 'manager', 1);
      insertUser.run('Cantina Bloco B', 'blocob@facens.br', null, hashPassword('123456'), 'manager', 2);
      insertUser.run('Cantina Leste', 'leste@facens.br', null, hashPassword('123456'), 'manager', 3);
      insertUser.run('Super Admin', 'sadmin@facens.br', null, hashPassword('224641'), 'superadmin', null);
    } else {
      const sadminCount = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get('sadmin@facens.br') as any;
      if (sadminCount.count === 0) {
         const insertUser = this.db.prepare('INSERT INTO users (name, email, matricula, senha, role, canteen_id) VALUES (?, ?, ?, ?, ?, ?)');
         insertUser.run('Super Admin', 'sadmin@facens.br', null, hashPassword('224641'), 'superadmin', null);
      }
      
      try {
        this.db.prepare("UPDATE users SET email = 'central@facens.br', name = 'Cantina Central' WHERE email = 'carlos@cantina.br'").run();
        this.db.prepare("UPDATE users SET email = 'blocob@facens.br', name = 'Cantina Bloco B' WHERE email = 'mariana@cantina.br'").run();
        this.db.prepare("UPDATE users SET email = 'leste@facens.br', name = 'Cantina Leste' WHERE email = 'joao@cantina.br'").run();
      } catch (e) {}
    }

    // Seed Canteens
    const canteensCount = this.db.prepare('SELECT COUNT(*) as count FROM canteens').get() as any;
    if (canteensCount.count === 0) {
      const insertCanteen = this.db.prepare('INSERT INTO canteens (name, desc, location, emoji, color, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
      insertCanteen.run('Cantina Central', 'Salgados, lanches e bebidas para o dia a dia', 'Prédio Principal', '🍕', '#fff8f0', '08:00', '22:30');
      insertCanteen.run('Cantina do Bloco B', 'Refeições completas e opções saudáveis', 'Bloco B', '🥗', '#f0f7ff', '08:00', '22:00');
      insertCanteen.run('Cafeteria Leste', 'Cafés, sucos e snacks rápidos', 'Prédio Leste', '☕', '#f5f7fb', '08:00', '23:00');
    }

    // Seed Categories
    const catCount = this.db.prepare('SELECT COUNT(*) as count FROM categories').get() as any;
    if (catCount.count === 0) {
      const insertCat = this.db.prepare('INSERT INTO categories (name) VALUES (?)');
      insertCat.run('salgados');
      insertCat.run('bebidas');
      insertCat.run('lanches');
      insertCat.run('doces');
    }

    // Seed Products
    const count = this.db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
    if (count.count === 0) {
      const insertProd = this.db.prepare('INSERT INTO products (name, desc, price, emoji, cat, points_price, canteen_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
      // Cantina Central (8 items, 4 redeemable)
      insertProd.run('Coxinha', 'Coxinha de frango crocante', 5.50, '🥟', 'salgados', 80, 1);
      insertProd.run('Esfiha', 'Esfiha de carne temperada', 4.00, '🥙', 'salgados', null, 1);
      insertProd.run('Refrigerante Lata', '350ml gelado', 5.00, '🥤', 'bebidas', 50, 1);
      insertProd.run('Suco de Uva', 'Suco natural 300ml', 7.00, '🥤', 'bebidas', null, 1);
      insertProd.run('X-Burguer', 'Hamburguer completo', 18.00, '🍔', 'lanches', null, 1);
      insertProd.run('Misto Quente', 'Queijo e presunto na chapa', 8.00, '🥪', 'lanches', 100, 1);
      insertProd.run('Bolo de Pote', 'Bolo de chocolate molhadinho', 9.00, '🧁', 'doces', null, 1);
      insertProd.run('Água Mineral', '500ml sem gás', 3.00, '💧', 'bebidas', 30, 1);
      
      // Cantina do Bloco B (8 items, 4 redeemable)
      insertProd.run('Salada Caesar', 'Alface, croutons e frango', 15.00, '🥗', 'lanches', null, 2);
      insertProd.run('Wrap Vegetariano', 'Grão de bico e vegetais', 12.00, '🌯', 'lanches', 150, 2);
      insertProd.run('Suco Verde', 'Detox de limão e couve', 8.00, '🥤', 'bebidas', null, 2);
      insertProd.run('Brownie Fit', 'Sem açúcar', 6.00, '🍫', 'doces', 60, 2);
      insertProd.run('Kombucha', 'Bebida probiótica', 10.00, '🍹', 'bebidas', null, 2);
      insertProd.run('Sanduíche Natural', 'Pão integral e frango desfiado', 11.00, '🥪', 'lanches', 120, 2);
      insertProd.run('Salada de Frutas', 'Frutas da estação da feira', 7.00, '🍎', 'doces', 80, 2);
      insertProd.run('Açaí Médio', 'Açaí 300ml com granola', 14.00, '🥣', 'doces', null, 2);

      // Cafeteria Leste (8 items, 4 redeemable)
      insertProd.run('Café Expresso', 'Café puro', 3.00, '☕', 'bebidas', null, 3);
      insertProd.run('Cappuccino', 'Com bastante espuma', 6.00, '☕', 'bebidas', 60, 3);
      insertProd.run('Pão de Queijo', 'Saindo do forno', 4.00, '🧀', 'salgados', null, 3);
      insertProd.run('Fatia de Bolo', 'Bolo de cenoura com chocolate', 7.00, '🍰', 'doces', 120, 3);
      insertProd.run('Croissant', 'Manteiga derretendo', 8.00, '🥐', 'salgados', null, 3);
      insertProd.run('Macchiato', 'Café com espuma de leite', 5.00, '☕', 'bebidas', 50, 3);
      insertProd.run('Cookie', 'Cookie de chocolate macio', 4.50, '🍪', 'doces', 45, 3);
      insertProd.run('Torta de Frango', 'Fatia artesanal', 9.00, '🥧', 'salgados', null, 3);
    }
    
    // Seed Tags
    const tagsCount = this.db.prepare('SELECT COUNT(*) as count FROM tags').get() as any;
    if (tagsCount.count === 0) {
      const insertTag = this.db.prepare('INSERT INTO tags (name, color, canteen_id) VALUES (?, ?, ?)');
      insertTag.run('Vegano', '#22c55e', 1); // ID 1
      insertTag.run('Sem Glúten', '#eab308', 1); // ID 2
      insertTag.run('Zero Lactose', '#3b82f6', 1); // ID 3
      insertTag.run('Vegano', '#22c55e', 2); // ID 4
      insertTag.run('Zero Açúcar', '#ec4899', 2); // ID 5
      insertTag.run('Vegano', '#22c55e', 3); // ID 6
      insertTag.run('Sem Glúten', '#eab308', 3); // ID 7

      // Updates initial seeded products
      this.db.exec("UPDATE products SET tags = '[3]' WHERE name = 'Coxinha' AND canteen_id = 1");
      this.db.exec("UPDATE products SET tags = '[1, 3]' WHERE name = 'Suco de Uva' AND canteen_id = 1");
      this.db.exec("UPDATE products SET tags = '[1]' WHERE name = 'Bolo de Pote' AND canteen_id = 1");
      this.db.exec("UPDATE products SET tags = '[1]' WHERE name = 'Esfiha' AND canteen_id = 1"); 

      this.db.exec("UPDATE products SET tags = '[4]' WHERE name = 'Wrap Vegetariano' AND canteen_id = 2");
      this.db.exec("UPDATE products SET tags = '[4, 5]' WHERE name = 'Suco Verde' AND canteen_id = 2");
      this.db.exec("UPDATE products SET tags = '[5]' WHERE name = 'Brownie Fit' AND canteen_id = 2");
      this.db.exec("UPDATE products SET tags = '[4, 5]' WHERE name = 'Salada de Frutas' AND canteen_id = 2");

      this.db.exec("UPDATE products SET tags = '[6, 7]' WHERE name = 'Café Expresso' AND canteen_id = 3");
      this.db.exec("UPDATE products SET tags = '[7]' WHERE name = 'Pão de Queijo' AND canteen_id = 3");
      this.db.exec("UPDATE products SET tags = '[6]' WHERE name = 'Cookie' AND canteen_id = 3");
    }
  }
}

// ============================================================================
// Controllers
// ============================================================================

// Controller Helper
function checkGestor(req: Request, res: Response, db: DatabaseSync): boolean {
  const userIdHeader = req.headers['x-user-id'] as string;
  if (!userIdHeader) {
     res.status(401).json({ error: "Não autorizado." });
     return false;
  }
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userIdHeader) as any;
  if (!user || user.role !== 'manager') {
     res.status(403).json({ error: "Acesso negado." });
     return false;
  }
  return true;
}

function checkSuperAdmin(req: Request, res: Response, db: DatabaseSync): boolean {
  const userIdHeader = req.headers['x-user-id'] as string;
  if (!userIdHeader) {
     res.status(401).json({ error: "Não autorizado." });
     return false;
  }
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userIdHeader) as any;
  if (!user || user.role !== 'superadmin') {
     res.status(403).json({ error: "Acesso negado. Apenas superadmins." });
     return false;
  }
  return true;
}

class BaseController {
  protected db: DatabaseSync;
  protected app: express.Application;

  constructor(db: DatabaseSync, app: express.Application) {
    this.db = db;
    this.app = app;
  }

  public registerRoutes(): void {
    throw new Error("Method not implemented.");
  }
}

class UserController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.post("/api/register", this.register.bind(this));
    this.app.post("/usuarios", this.register.bind(this)); // Alias for swagger
    this.app.post("/api/login", this.login.bind(this));
    this.app.get("/api/users", this.getAll.bind(this));
    this.app.get("/api/users/:id", this.getProfile.bind(this));
    this.app.put("/api/users/:id", this.updateProfile.bind(this));
    this.app.post("/api/users/:id/redeem", this.redeemReward.bind(this));
    this.app.post("/api/users/manager", this.createManager.bind(this));
    this.app.put("/api/users/admin/:id", this.updateUser.bind(this));
    this.app.delete("/api/users/:id", this.deleteUser.bind(this));
    this.app.post("/api/request-code", this.requestCode.bind(this));
    this.app.post("/api/reset-password-request", this.resetPasswordRequest.bind(this));
    this.app.post("/api/reset-password", this.resetPassword.bind(this));
  }

  private async resetPasswordRequest(req: Request, res: Response) {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "E-mail é obrigatório." });
    }

    const existingUser = this.db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!existingUser) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    try {
      const stmt = this.db.prepare(`
        INSERT INTO verification_codes (email, code, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
      `);
      stmt.run(email, code, expiresAt);

      if (transporter) {
        const fromAddress = process.env.SMTP_USER ? `"Cantina OrderPoint" <${process.env.SMTP_USER}>` : '"Cantina OrderPoint" <noreply@orderpoint.com>';
        const info = await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject: "Cantina OrderPoint - Recuperação de Senha",
          text: `Seu código para redefinir a senha é: ${code}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #ea580c; margin: 0; font-size: 28px;">Cantina OrderPoint 🍔</h1>
  </div>
  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <h2 style="color: #1f2937; margin-top: 0; text-align: center;">Recuperação de Senha</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5; text-align: center;">
      Recebemos um pedido para redefinir a sua senha. Utilize o código de 6 dígitos abaixo para concluir o processo:
    </p>
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
      <span style="font-size: 32px; font-weight: bold; color: #ea580c; letter-spacing: 4px;">${code}</span>
    </div>
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      ⚠️ <b>Aviso:</b> Se você não solicitou a troca de senha, por favor ignore este email. Nenhuma alteração será feita na sua conta.
    </p>
  </div>
  <div style="text-align: center; margin-top: 20px;">
    <p style="color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Cantina OrderPoint. Todos os direitos reservados.</p>
  </div>
</div>`
        });
        
        if (!process.env.SMTP_USER) {
          console.log("Email sent! Preview URL: %s", nodemailer.getTestMessageUrl(info));
        } else {
          console.log(`Real email sent to ${email}`);
        }
      }

      res.json({ success: true, message: "Código enviado com sucesso." });
    } catch (error) {
      res.status(500).json({ error: "Erro ao gerar código." });
    }
  }

  private resetPassword(req: Request, res: Response) {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "E-mail, código e nova senha são obrigatórios." });
    }

    const record = this.db.prepare('SELECT * FROM verification_codes WHERE email = ?').get(email) as any;
    if (!record) return res.status(400).json({ error: "Nenhum código solicitado para este e-mail." });
    if (record.code !== code) return res.status(400).json({ error: "Código inválido." });
    if (Date.now() > record.expires_at) return res.status(400).json({ error: "Código expirado." });

    const hashedSenha = hashPassword(newPassword);

    const currentUser = this.db.prepare('SELECT senha FROM users WHERE email = ?').get(email) as any;
    if (currentUser && currentUser.senha === hashedSenha) {
      return res.status(400).json({ error: "A nova senha deve ser diferente da atual." });
    }

    try {
      const update = this.db.prepare('UPDATE users SET senha = ? WHERE email = ?');
      update.run(hashedSenha, email);
      
      this.db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
      
      res.json({ success: true, message: "Senha redefinida com sucesso." });
    } catch (error) {
      res.status(500).json({ error: "Erro ao redefinir senha." });
    }
  }

  private async requestCode(req: Request, res: Response) {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "E-mail é obrigatório." });
    }

    const emailRegex = /^\d{6}@facens\.br$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "O e-mail deve ser institucional (@facens.br) e conter exatamente 6 dígitos numéricos antes do @ (seu RA)." });
    }

    const existingUser = this.db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    try {
      const stmt = this.db.prepare(`
        INSERT INTO verification_codes (email, code, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
      `);
      stmt.run(email, code, expiresAt);

      if (transporter) {
        const fromAddress = process.env.SMTP_USER ? `"Cantina OrderPoint" <${process.env.SMTP_USER}>` : '"Cantina OrderPoint" <noreply@orderpoint.com>';
        const info = await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject: "Cantina OrderPoint - Código de Verificação",
          text: `Seu código de verificação é: ${code}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #ea580c; margin: 0; font-size: 28px;">Cantina OrderPoint 🍕</h1>
  </div>
  <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <h2 style="color: #1f2937; margin-top: 0; text-align: center;">Confirme seu E-mail</h2>
    <p style="color: #4b5563; font-size: 16px; line-height: 1.5; text-align: center;">
      Falta pouco para você fazer o seu primeiro pedido! Use o código de verificação abaixo para criar a sua conta na cantina:
    </p>
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
      <span style="font-size: 32px; font-weight: bold; color: #ea580c; letter-spacing: 4px;">${code}</span>
    </div>
    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      Este código é válido por 10 minutos. Aproveite nossos lanches!
    </p>
  </div>
  <div style="text-align: center; margin-top: 20px;">
    <p style="color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Cantina OrderPoint. Todos os direitos reservados.</p>
  </div>
</div>`
        });
        
        if (!process.env.SMTP_USER) {
          console.log("Email sent! Preview URL: %s", nodemailer.getTestMessageUrl(info));
        } else {
          console.log(`Real email sent to ${email}`);
        }
      }

      res.json({ success: true, message: "Código enviado com sucesso." });
    } catch (error) {
      res.status(500).json({ error: "Erro ao gerar código." });
    }
  }

  private register(req: Request, res: Response) {
    const { name, email, senha, code } = req.body;
    if (!name || !email || !senha || !code) {
      return res.status(400).json({ error: "Nome, e-mail, senha e código são obrigatórios." });
    }

    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({ error: "O nome de usuário não pode conter números ou caracteres especiais, apenas letras." });
    }

    const emailRegex = /^\d{6}@facens\.br$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "O e-mail deve ser institucional (@facens.br) e conter exatamente 6 dígitos numéricos antes do @ (seu RA)." });
    }

    const record = this.db.prepare('SELECT * FROM verification_codes WHERE email = ?').get(email) as any;
    if (!record) return res.status(400).json({ error: "Nenhum código solicitado para este e-mail." });
    if (record.code !== code) return res.status(400).json({ error: "Código inválido." });
    if (Date.now() > record.expires_at) return res.status(400).json({ error: "Código expirado." });

    const matricula = email.split('@')[0];
    const hashedSenha = hashPassword(senha);

    try {
      const insert = this.db.prepare('INSERT INTO users (name, email, matricula, senha, role) VALUES (?, ?, ?, ?, ?)');
      const result = insert.run(name, email, matricula, hashedSenha, 'student');
      
      this.db.prepare('DELETE FROM verification_codes WHERE email = ?').run(email);
      
      res.status(201).json({ success: true, userId: result.lastInsertRowid });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "E-mail já cadastrado." });
      } else {
        res.status(500).json({ error: "Erro ao criar conta." });
      }
    }
  }

  private login(req: Request, res: Response) {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const hashedSenha = hashPassword(senha);

    try {
      const select = this.db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?');
      const user = select.get(email, hashedSenha) as any;
      
      if (user) {
        res.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            matricula: user.matricula,
            role: user.role,
            points: user.points,
            canteen_id: user.canteen_id
          }
        });
      } else {
        res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao fazer login." });
    }
  }

  private getProfile(req: Request, res: Response) {
    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader || userIdHeader !== req.params.id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    try {
      const user = this.db.prepare('SELECT id, name, email, matricula, role, points, canteen_id FROM users WHERE id = ?').get(req.params.id) as any;
      if (user) {
        res.json({ success: true, user });
      } else {
        res.status(404).json({ error: "Usuário não encontrado." });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar perfil." });
    }
  }

  private updateProfile(req: Request, res: Response) {
    const { name, email, senha } = req.body;
    const matricula = email.endsWith('@facens.br') ? email.replace('@facens.br', '') : '';
    
    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader || userIdHeader !== req.params.id) {
      return res.status(403).json({ error: "Acesso negado. Você só pode atualizar seu próprio perfil." });
    }

    if (name) {
      const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
      if (!nameRegex.test(name)) {
        return res.status(400).json({ error: "O nome de usuário não pode conter números ou caracteres especiais, apenas letras." });
      }
    }

    try {
      if (senha) {
        const hashedSenha = hashPassword(senha);
        
        const currentUser = this.db.prepare('SELECT senha FROM users WHERE id = ?').get(req.params.id) as any;
        if (currentUser && currentUser.senha === hashedSenha) {
          return res.status(400).json({ error: "A nova senha deve ser diferente da atual." });
        }

        const update = this.db.prepare('UPDATE users SET name=?, email=?, matricula=?, senha=? WHERE id=?');
        update.run(name, email, matricula, hashedSenha, req.params.id);
      } else {
        const update = this.db.prepare('UPDATE users SET name=?, email=?, matricula=? WHERE id=?');
        update.run(name, email, matricula, req.params.id);
      }
      res.json({ success: true, matricula });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "E-mail já cadastrado." });
      } else {
        res.status(500).json({ error: "Erro ao atualizar perfil." });
      }
    }
  }

  private redeemReward(req: Request, res: Response) {
    const { productId } = req.body;
    const userId = req.params.id;

    if (req.headers['x-user-id'] !== userId.toString()) {
        return res.status(403).json({ error: "Acesso negado." });
    }

    try {
        this.db.exec('BEGIN TRANSACTION');
        
        const user = this.db.prepare('SELECT points FROM users WHERE id = ?').get(userId) as any;
        const product = this.db.prepare('SELECT id, name, emoji, stock, points_price FROM products WHERE id = ? AND active = 1').get(productId) as any;

        if (!product || !product.points_price) throw new Error("Produto não disponível para resgate.");
        if (!user || user.points < product.points_price) throw new Error("Pontos insuficientes.");
        if (product.stock <= 0) throw new Error("Produto esgotado no estoque.");

        this.db.exec('COMMIT');
        // Fake the newPoints just for UI immediate update, the real deduction happens at checkout
        res.json({ success: true, newPoints: user.points - product.points_price, product: { ...product, price: 0, isReward: true, points_price: product.points_price } });
    } catch(err: any) {
        this.db.exec('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
  }
  private getAll(req: Request, res: Response) {
    if (!checkSuperAdmin(req, res, this.db)) return;
    try {
      const users = this.db.prepare('SELECT id, name, email, matricula, role, canteen_id, points FROM users').all();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar usuários." });
    }
  }

  private createManager(req: Request, res: Response) {
    if (!checkSuperAdmin(req, res, this.db)) return;
    const { name, email, senha, canteen_id, role, matricula } = req.body;
    if (!name || !email || !senha) {
       return res.status(400).json({ error: "Nome, E-mail e Senha são obrigatórios." });
    }
    if (!email.endsWith("@facens.br")) {
       return res.status(400).json({ error: "O e-mail deve terminar com @facens.br." });
    }
    const targetRole = role && ['superadmin', 'manager', 'student'].includes(role) ? role : 'manager';
    if (targetRole === 'manager' && !canteen_id) {
       return res.status(400).json({ error: "A cantina é obrigatória para Gestores." });
    }
    const hashedSenha = hashPassword(senha);
    try {
      const insert = this.db.prepare('INSERT INTO users (name, email, senha, role, canteen_id, matricula) VALUES (?, ?, ?, ?, ?, ?)');
      const result = insert.run(name, email, hashedSenha, targetRole, targetRole === 'manager' ? canteen_id : null, matricula || null);
      res.status(201).json({ success: true, userId: result.lastInsertRowid });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "E-mail já cadastrado." });
      } else {
        res.status(500).json({ error: "Erro ao criar conta." });
      }
    }
  }

  private updateUser(req: Request, res: Response) {
    if (!checkSuperAdmin(req, res, this.db)) return;
    const { name, email, role, canteen_id, matricula } = req.body;
    if (!name || !email || !role) {
       return res.status(400).json({ error: "Nome, E-mail e Função são obrigatórios." });
    }
    try {
      const update = this.db.prepare('UPDATE users SET name=?, email=?, role=?, canteen_id=?, matricula=? WHERE id=?');
      update.run(name, email, role, role === 'manager' ? canteen_id : null, matricula || null, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "E-mail já cadastrado noutra conta." });
      } else {
        res.status(500).json({ error: "Erro ao atualizar usuário." });
      }
    }
  }

  private deleteUser(req: Request, res: Response) {
    if (!checkSuperAdmin(req, res, this.db)) return;
    const { id } = req.params;
    try {
      this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar usuário." });
    }
  }
}

class ProductController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.get("/api/products", this.getAll.bind(this));
    this.app.post("/api/products", this.create.bind(this));
    this.app.put("/api/products/:id", this.update.bind(this));
    this.app.delete("/api/products/:id", this.delete.bind(this));
    this.app.get("/produtos", this.getProdutos.bind(this));
    this.app.get("/produtos/:id", this.getProdutoById.bind(this));
  }

  private getProdutos(req: Request, res: Response) {
    const { categoria } = req.query;
    try {
      let products;
      if (categoria) {
        products = this.db.prepare('SELECT * FROM products WHERE active = 1 AND cat = ?').all(categoria as string);
      } else {
        products = this.db.prepare('SELECT * FROM products WHERE active = 1').all();
      }
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar produtos." });
    }
  }

  private getProdutoById(req: Request, res: Response) {
    try {
      const product = this.db.prepare('SELECT emoji as foto, name as nome, desc as ingredientes, price as preco FROM products WHERE id = ?').get(req.params.id);
      if (product) {
        res.json(product);
      } else {
        res.status(404).json({ error: "Produto não encontrado." });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar produto." });
    }
  }

  private getAll(req: Request, res: Response) {
    try {
      const products = this.db.prepare('SELECT * FROM products').all();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar produtos." });
    }
  }

  private create(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const { name, desc, price, emoji, cat, stock, points_price, canteen_id, tags } = req.body;
    if (!name || !price || !cat) return res.status(400).json({ error: "Dados incompletos." });
    try {
      const insert = this.db.prepare('INSERT INTO products (name, desc, price, emoji, cat, stock, points_price, canteen_id, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const result = insert.run(name, desc || '', price, emoji || '🍽️', cat, stock !== undefined ? stock : 10, points_price || null, canteen_id || 1, tags || '[]');
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar produto." });
    }
  }

  private update(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const { name, desc, price, emoji, cat, active, stock, points_price, canteen_id, tags } = req.body;
    try {
      const update = this.db.prepare('UPDATE products SET name=?, desc=?, price=?, emoji=?, cat=?, active=?, stock=?, points_price=?, canteen_id=?, tags=? WHERE id=?');
      update.run(name, desc, price, emoji, cat, active !== undefined ? active : 1, stock !== undefined ? stock : 10, points_price || null, canteen_id || 1, tags || '[]', req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar produto." });
    }
  }

  private delete(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    try {
      const del = this.db.prepare('DELETE FROM products WHERE id=?');
      del.run(parseInt(req.params.id, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar produto." });
    }
  }
}

class CanteenController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.get("/api/canteens", this.getAll.bind(this));
    this.app.post("/api/canteens", this.create.bind(this));
    this.app.put("/api/canteens/:id", this.update.bind(this));
    this.app.delete("/api/canteens/:id", this.delete.bind(this));
    this.app.get("/cantinas", this.getCantinas.bind(this));
  }

  private getCantinas(req: Request, res: Response) {
    try {
      const canteens = this.db.prepare(`SELECT name, emoji as foto FROM canteens LIMIT 3`).all();
      res.json(canteens);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar cantinas." });
    }
  }

  private getAll(req: Request, res: Response) {
    try {
      const canteens = this.db.prepare(`
        SELECT c.*, 
               COALESCE(AVG(r.score), 0) as avg_rating,
               COUNT(r.id) as rating_count
        FROM canteens c
        LEFT JOIN ratings r ON c.id = r.canteen_id
        GROUP BY c.id
      `).all();
      res.json(canteens);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar cantinas." });
    }
  }

  private update(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db) && !checkSuperAdmin(req, res, this.db)) return;
    const { name, desc, location, emoji, color, open_time, close_time, points_enabled } = req.body;
    try {
      const update = this.db.prepare('UPDATE canteens SET name=?, desc=?, location=?, emoji=?, color=?, open_time=?, close_time=?, points_enabled=? WHERE id=?');
      update.run(name, desc, location, emoji, color, open_time, close_time, points_enabled !== undefined ? points_enabled : 1, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar cantina." });
    }
  }

  private create(req: Request, res: Response) {
    if (!checkSuperAdmin(req, res, this.db)) return;
    const { name, desc, location, emoji, color, open_time, close_time } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
    try {
      const insert = this.db.prepare('INSERT INTO canteens (name, desc, location, emoji, color, open_time, close_time, points_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const result = insert.run(name, desc || '', location || '', emoji || '🍽️', color || '#ffffff', open_time || '08:00', close_time || '18:00', 1);
      res.status(201).json({ success: true, canteenId: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar cantina." });
    }
  }

  private delete(req: Request, res: Response) {
    if (!checkSuperAdmin(req, res, this.db)) return;
    try {
      this.db.prepare('DELETE FROM canteens WHERE id=?').run(parseInt(req.params.id, 10));
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao deletar cantina." });
    }
  }
}

class CouponController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.get("/api/coupons", this.getAll.bind(this));
    this.app.post("/api/coupons", this.create.bind(this));
    this.app.post("/api/coupons/validate", this.validateCoupon.bind(this));
    this.app.put("/api/coupons/:id", this.update.bind(this));
    this.app.delete("/api/coupons/:id", this.delete.bind(this));
  }

  private getAll(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const userIdHeader = req.headers['x-user-id'] as string;
    const user = this.db.prepare('SELECT canteen_id FROM users WHERE id = ?').get(userIdHeader) as any;
    try {
      let coupons;
      if (user && user.canteen_id) {
        coupons = this.db.prepare('SELECT * FROM coupons WHERE canteen_id = ?').all(user.canteen_id);
      } else {
        coupons = this.db.prepare('SELECT * FROM coupons').all();
      }
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar cupons." });
    }
  }

  private validateCoupon(req: Request, res: Response) {
    const { code, canteen_id, cart_total } = req.body;
    if (!code || !canteen_id) return res.status(400).json({ error: "Código ou cantina não informados." });
    try {
      const coupon = this.db.prepare('SELECT * FROM coupons WHERE code = ? AND canteen_id = ? AND active = 1').get(code, canteen_id) as any;
      if (!coupon) return res.status(404).json({ error: "Cupom inválido." });
      
      if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
        return res.status(400).json({ error: "Cupom esgotado." });
      }
      
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return res.status(400).json({ error: "Cupom expirado." });
      }
      
      if (coupon.min_value > 0 && cart_total !== undefined) {
         if (cart_total < coupon.min_value) {
           return res.status(400).json({ error: `Valor mínimo da cantina é R$ ${coupon.min_value.toFixed(2).replace('.', ',')}` });
         }
      }
      
      res.json({ success: true, coupon });
    } catch (error) {
      res.status(500).json({ error: "Erro ao validar cupom." });
    }
  }

  private create(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const { code, discount_pct, max_uses, expires_at, canteen_id, min_value } = req.body;
    if (!code || !discount_pct || !canteen_id) return res.status(400).json({ error: "Dados obrigatórios faltando." });
    try {
      const insert = this.db.prepare('INSERT INTO coupons (code, discount_pct, max_uses, expires_at, min_value, canteen_id) VALUES (?, ?, ?, ?, ?, ?)');
      insert.run(code, discount_pct, max_uses || null, expires_at || null, min_value || 0, canteen_id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Um cupom com este código já existe." });
      } else {
        res.status(500).json({ error: "Erro ao criar cupom." });
      }
    }
  }

  private update(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const { code, discount_pct, max_uses, expires_at, active, min_value } = req.body;
    try {
      if (code && discount_pct) {
         const update = this.db.prepare('UPDATE coupons SET code = ?, discount_pct = ?, max_uses = ?, expires_at = ?, min_value = ?, active = ? WHERE id = ?');
         update.run(code, discount_pct, max_uses || null, expires_at || null, min_value || 0, active !== undefined ? active : 1, req.params.id);
      } else {
         const update = this.db.prepare('UPDATE coupons SET active = ?, max_uses = ?, expires_at = ? WHERE id = ?');
         update.run(active !== undefined ? active : 1, max_uses || null, expires_at || null, req.params.id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar cupom." });
    }
  }

  private delete(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    try {
      const del = this.db.prepare('DELETE FROM coupons WHERE id = ?');
      del.run(parseInt(req.params.id, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir cupom." });
    }
  }
}

class CategoryController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.get("/api/categories", this.getAll.bind(this));
    this.app.post("/api/categories", this.create.bind(this));
    this.app.delete("/api/categories/:id", this.delete.bind(this));
  }

  private getAll(req: Request, res: Response) {
    try {
      const categories = this.db.prepare('SELECT * FROM categories').all();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar categorias." });
    }
  }

  private create(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
    try {
      const insert = this.db.prepare('INSERT INTO categories (name) VALUES (?)');
      const result = insert.run(name);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Categoria já existe." });
      } else {
        res.status(500).json({ error: "Erro ao criar categoria." });
      }
    }
  }

  private delete(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    try {
      const del = this.db.prepare('DELETE FROM categories WHERE id=?');
      del.run(parseInt(req.params.id, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar categoria." });
    }
  }
}

class TagController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.get("/api/tags", this.getAll.bind(this));
    this.app.post("/api/tags", this.create.bind(this));
    this.app.delete("/api/tags/:id", this.delete.bind(this));
  }

  private getAll(req: Request, res: Response) {
    try {
      const tags = this.db.prepare('SELECT * FROM tags').all();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar tags." });
    }
  }

  private create(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const { name, color, canteen_id } = req.body;
    if (!name || !color || !canteen_id) return res.status(400).json({ error: "Dados incompletos." });
    try {
      const insert = this.db.prepare('INSERT INTO tags (name, color, canteen_id) VALUES (?, ?, ?)');
      const result = insert.run(name, color, canteen_id);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar tag." });
    }
  }

  private delete(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    try {
      const del = this.db.prepare('DELETE FROM tags WHERE id=?');
      del.run(parseInt(req.params.id, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao excluir tag." });
    }
  }
}

class RatingController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.post("/api/ratings", this.create.bind(this));
  }

  private create(req: Request, res: Response) {
    const { order_id, canteen_id, score } = req.body;
    if (!order_id || !score) return res.status(400).json({ error: "Dados incompletos." });
    
    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader) {
      return res.status(401).json({ error: "Não autorizado." });
    }

    // Verify if the order belongs to the user
    const order = this.db.prepare('SELECT user_id, user_name FROM orders WHERE id = ?').get(order_id) as any;
    const user = this.db.prepare('SELECT name FROM users WHERE id = ?').get(userIdHeader as string) as any;
    
    if (!order || !user) {
      return res.status(403).json({ error: "Pedido ou usuário não encontrado." });
    }

    const isOwner = order.user_id?.toString() === userIdHeader || (order.user_id === null && order.user_name === user.name);
    
    if (!isOwner) {
      return res.status(403).json({ error: "Você só pode avaliar seus próprios pedidos." });
    }

    const finalCanteenId = canteen_id || 1; // Fallback to 1 if undefined

    try {
      const insert = this.db.prepare('INSERT INTO ratings (order_id, canteen_id, score) VALUES (?, ?, ?)');
      insert.run(order_id, finalCanteenId, score);
      res.status(201).json({ success: true });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Pedido já avaliado." });
      } else {
        console.error("Erro ao salvar avaliação:", error);
        res.status(500).json({ error: "Erro ao salvar avaliação." });
      }
    }
  }
}

class OrderController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.post("/api/orders", this.create.bind(this));
    this.app.get("/api/orders", this.getAll.bind(this));
    this.app.get("/api/orders/user/:id", this.getByUserId.bind(this));
    this.app.get("/api/orders/:code", this.getByCode.bind(this));
    this.app.put("/api/orders/:id/status", this.updateStatus.bind(this));
    this.app.delete("/api/orders/:id", this.delete.bind(this));
  }

  private create(req: Request, res: Response) {
    const { user_name, user_id, items, total, canteen_id, coupon_code } = req.body;
    if (!user_name || !items || !total) return res.status(400).json({ error: "Dados incompletos." });
    
    let code = '';
    let inserted = false;
    let attempts = 0;

    while (!inserted && attempts < 10) {
      code = Math.floor(10000000 + Math.random() * 90000000).toString();
      
      try {
        this.db.exec('BEGIN TRANSACTION');
        
        let calculatedTotal = 0;
        let neededPoints = 0;
        let couponDiscountPct = 0;
        let appliedCoupon: any = null;

        if (coupon_code) {
           const coupon = this.db.prepare('SELECT * FROM coupons WHERE code = ? AND canteen_id = ? AND active = 1').get(coupon_code, canteen_id || 1) as any;
           if (!coupon) {
             this.db.exec('ROLLBACK');
             return res.status(400).json({ error: "Cupom inválido." });
           }
           if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
             this.db.exec('ROLLBACK');
             return res.status(400).json({ error: "Cupom esgotado." });
           }
           if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
             this.db.exec('ROLLBACK');
             return res.status(400).json({ error: "Cupom expirado." });
           }
           couponDiscountPct = coupon.discount_pct;
           appliedCoupon = coupon;
        }
        
        const checkStock = this.db.prepare('SELECT stock, name, price, points_price FROM products WHERE id = ?');
        const checkStockByName = this.db.prepare('SELECT id, stock, name, price, points_price FROM products WHERE name = ?');
        const userQuery = this.db.prepare('SELECT points FROM users WHERE id = ?');
        
        let currentUser = null;
        if (user_id) {
           currentUser = userQuery.get(user_id) as any;
        }

        // Verificar estoque antes de inserir o pedido e recalcular os valores
        for (const item of items) {
          let row;
          if (item.id) {
            row = checkStock.get(item.id) as any;
          } else if (item.name) {
            row = checkStockByName.get(item.name) as any;
          }
          
          if (!row) {
            this.db.exec('ROLLBACK');
            return res.status(400).json({ error: `Produto ${item.name} não encontrado.` });
          }
          
          if (row.stock < item.qty) {
            this.db.exec('ROLLBACK');
            return res.status(400).json({ error: `Estoque insuficiente para o produto ${row.name}.` });
          }

          if (item.isReward) {
             if (!row.points_price) {
                this.db.exec('ROLLBACK');
                return res.status(400).json({ error: `Produto ${row.name} não aceita resgate.` });
             }
             neededPoints += row.points_price * item.qty;
          } else {
             calculatedTotal += row.price * item.qty;
          }
        }

        if (neededPoints > 0) {
            if (!currentUser || currentUser.points < neededPoints) {
                this.db.exec('ROLLBACK');
                return res.status(400).json({ error: "Pontos insuficientes para o resgate." });
            }
        }

        if (appliedCoupon) {
          if (appliedCoupon.min_value > 0 && calculatedTotal < appliedCoupon.min_value) {
            this.db.exec('ROLLBACK');
            return res.status(400).json({ error: `O valor mínimo para este cupom é R$ ${appliedCoupon.min_value.toFixed(2).replace('.', ',')}.` });
          }
          calculatedTotal = calculatedTotal * (1 - (couponDiscountPct / 100));
          if (calculatedTotal < 0) calculatedTotal = 0;
        }

        const insert = this.db.prepare('INSERT INTO orders (code, user_name, user_id, items, total, status, canteen_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const result = insert.run(code, user_name, user_id || null, JSON.stringify(items), calculatedTotal, 'aguardando', canteen_id || 1);
        
        const updateStock = this.db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
        const pauseProduct = this.db.prepare('UPDATE products SET active = 0 WHERE id = ?');
        const updateStockByName = this.db.prepare('UPDATE products SET stock = stock - ? WHERE name = ?');

        for (const item of items) {
          if (item.id) {
            updateStock.run(item.qty, item.id);
            const row = checkStock.get(item.id) as any;
            if (row && row.stock <= 0) {
              pauseProduct.run(item.id);
            }
          } else if (item.name) {
            updateStockByName.run(item.qty, item.name);
            const row = checkStockByName.get(item.name) as any;
            if (row && row.stock <= 0) {
              pauseProduct.run(row.id);
            }
          }
        }

        if (neededPoints > 0 && user_id) {
            this.db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(neededPoints, user_id);
        }

        if (appliedCoupon) {
          this.db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(appliedCoupon.id);
        }
        
        this.db.exec('COMMIT');
        inserted = true;
        return res.status(201).json({ success: true, code, id: result.lastInsertRowid });
      } catch (error: any) {
        this.db.exec('ROLLBACK');
        if (error.message && error.message.includes("UNIQUE constraint failed")) {
          attempts++;
        } else {
          return res.status(500).json({ error: "Erro ao criar pedido." });
        }
      }
    }

    if (!inserted) {
      res.status(500).json({ error: "Erro ao gerar código único." });
    }
  }

  private getAll(req: Request, res: Response) {
    const userIdHeader = req.headers['x-user-id'] as string;
    if (!userIdHeader) {
       return res.status(401).json({ error: "Não autorizado." });
    }
    const user = this.db.prepare('SELECT role, canteen_id FROM users WHERE id = ?').get(userIdHeader) as any;
    if (!user || user.role !== 'manager') {
       return res.status(403).json({ error: "Acesso negado." });
    }

    try {
      let orders;
      if (user.canteen_id) {
         orders = this.db.prepare("SELECT * FROM orders WHERE status != 'retirado' AND status != 'cancelado' AND canteen_id = ? ORDER BY created_at DESC").all(user.canteen_id);
      } else {
         orders = this.db.prepare("SELECT * FROM orders WHERE status != 'retirado' AND status != 'cancelado' ORDER BY created_at DESC").all();
      }
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar pedidos." });
    }
  }

  private getByUserId(req: Request, res: Response) {
    const userIdHeader = req.headers['x-user-id'];
    if (!userIdHeader || userIdHeader !== req.params.id) {
      return res.status(403).json({ error: "Acesso negado. Você só pode ver seus próprios pedidos." });
    }

    try {
      const orders = this.db.prepare(`
        SELECT o.*, r.score as rating 
        FROM orders o 
        LEFT JOIN ratings r ON o.id = r.order_id 
        WHERE o.user_id = ? OR (o.user_id IS NULL AND o.user_name = (SELECT name FROM users WHERE id = ?))
        ORDER BY o.created_at DESC
      `).all(req.params.id, req.params.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar pedidos do usuário." });
    }
  }

  private getByCode(req: Request, res: Response) {
    try {
      const order = this.db.prepare('SELECT * FROM orders WHERE code = ?').get(req.params.code);
      if (order) {
        res.json(order);
      } else {
        res.status(404).json({ error: "Pedido não encontrado." });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar pedido." });
    }
  }

  private updateStatus(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status é obrigatório." });
    try {
      this.db.exec('BEGIN TRANSACTION');
      
      if (status === 'cancelado') {
        const order = this.db.prepare('SELECT status, items, user_id FROM orders WHERE id=?').get(req.params.id) as any;
        if (order && order.status !== 'cancelado') {
          const itemsArr = JSON.parse(order.items);
          const restoreStock = this.db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
          const restoreStockByName = this.db.prepare('UPDATE products SET stock = stock + ? WHERE name = ?');
          let pointsToRestore = 0;
          for (const item of itemsArr) {
            if (item.id) {
              restoreStock.run(item.qty, item.id);
            } else if (item.name) {
              restoreStockByName.run(item.qty, item.name);
            }
            if (item.isReward && item.points_price) {
               pointsToRestore += item.points_price * item.qty;
            }
          }
          if (pointsToRestore > 0 && order.user_id) {
              this.db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(pointsToRestore, order.user_id);
          }
        }
        this.db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
      } else if (status === 'retirado') {
        const order = this.db.prepare('SELECT status, user_id, total, points_awarded, canteen_id FROM orders WHERE id=?').get(req.params.id) as any;
        if (order && order.status !== 'retirado' && !order.points_awarded && order.user_id) {
          const canteen = this.db.prepare('SELECT points_enabled FROM canteens WHERE id=?').get(order.canteen_id) as any;
          const isPointsEnabled = canteen && canteen.points_enabled === 1;

          const pointsEarned = Math.floor(order.total);
          if (pointsEarned > 0 && isPointsEnabled) {
            this.db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(pointsEarned, order.user_id);
          }
          this.db.prepare('UPDATE orders SET status=?, points_awarded=1 WHERE id=?').run(status, req.params.id);
        } else {
          this.db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
        }
      } else {
        this.db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
      }
      
      this.db.exec('COMMIT');
      res.json({ success: true });
    } catch (error) {
      this.db.exec('ROLLBACK');
      res.status(500).json({ error: "Erro ao atualizar status do pedido." });
    }
  }

  private delete(req: Request, res: Response) {
    if (!checkGestor(req, res, this.db)) return;
    try {
      const del = this.db.prepare('DELETE FROM orders WHERE id=?');
      del.run(parseInt(req.params.id, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar pedido." });
    }
  }
}

// ============================================================================
// Application Server
// ============================================================================

class AppServer {
  private app: express.Application;
  private dbManager: DatabaseManager;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    this.dbManager = new DatabaseManager();
    this.setupControllers();
  }

  private setupControllers() {
    const controllers: BaseController[] = [
      new UserController(this.dbManager.db, this.app),
      new ProductController(this.dbManager.db, this.app),
      new CouponController(this.dbManager.db, this.app),
      new CanteenController(this.dbManager.db, this.app),
      new CategoryController(this.dbManager.db, this.app),
      new RatingController(this.dbManager.db, this.app),
      new OrderController(this.dbManager.db, this.app),
      new TagController(this.dbManager.db, this.app)
    ];

    for (const controller of controllers) {
      controller.registerRoutes();
    }
  }

  public async start(port: number) {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      this.app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      this.app.use(express.static(distPath));
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    this.app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  }
}

// Start the server
const server = new AppServer();
server.start(3000);
