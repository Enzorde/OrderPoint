import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { DatabaseSync } from "node:sqlite";

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
        role TEXT NOT NULL DEFAULT 'student'
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
        stock INTEGER DEFAULT 10
      )
    `);
    try { this.db.exec("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10"); } catch (e) {}

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
        close_time TEXT NOT NULL DEFAULT '18:00'
      )
    `);
    try { this.db.exec("ALTER TABLE canteens ADD COLUMN location TEXT NOT NULL DEFAULT ''"); } catch (e) {}

    // Categories
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);
  }


  private seedData() {
    // Seed Canteens
    const canteensCount = this.db.prepare('SELECT COUNT(*) as count FROM canteens').get() as any;
    if (canteensCount.count === 0) {
      const insertCanteen = this.db.prepare('INSERT INTO canteens (name, desc, location, emoji, color, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
      insertCanteen.run('Cantina Central', 'Salgados, lanches e bebidas para o dia a dia', 'Prédio Principal', '🍕', '#fff8f0', '08:00', '18:00');
      insertCanteen.run('Cantina do Bloco B', 'Refeições completas e opções saudáveis', 'Bloco B', '🥗', '#f0f7ff', '08:00', '17:00');
      insertCanteen.run('Cafeteria Leste', 'Cafés, sucos e snacks rápidos', 'Prédio Leste', '☕', '#f5f7fb', '08:00', '18:00');
    }

   // Seed Categories
    const catCount = this.db.prepare('SELECT COUNT(*) as count FROM categories').get() as any;
    if (catCount.count === 0) {
      const insertCat = this.db.prepare('INSERT INTO categories (name) VALUES (?)');
      insertCat.run('salgados');
      insertCat.run('bebidas');
      insertCat.run('lanches');
    }
  }
}



// ============================================================================
// Controllers
// ============================================================================
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
    this.app.post("/api/login", this.login.bind(this));
    this.app.put("/api/users/:id", this.updateProfile.bind(this));
  }

  private register(req: Request, res: Response) {
    const { name, email, senha } = req.body;
    if (!name || !email || !senha) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }

    const matricula = email.endsWith('@facens.br') ? email.replace('@facens.br', '') : '';

    try {
      const insert = this.db.prepare('INSERT INTO users (name, email, matricula, senha, role) VALUES (?, ?, ?, ?, ?)');
      const result = insert.run(name, email, matricula, senha, 'student');
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

    try {
      const select = this.db.prepare('SELECT * FROM users WHERE email = ? AND senha = ?');
      const user = select.get(email, senha) as any;
      
      if (user) {
        res.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            matricula: user.matricula,
            role: user.role
          }
        });
      } else {
        res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao fazer login." });
    }
  }

  private updateProfile(req: Request, res: Response) {
    const { name, email, senha } = req.body;
    const matricula = email.endsWith('@facens.br') ? email.replace('@facens.br', '') : '';
    
    try {
      if (senha) {
        const update = this.db.prepare('UPDATE users SET name=?, email=?, matricula=?, senha=? WHERE id=?');
        update.run(name, email, matricula, senha, req.params.id);
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
}

class CanteenController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.get("/api/canteens", this.getAll.bind(this));
    this.app.put("/api/canteens/:id", this.update.bind(this));
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
    const { name, desc, location, emoji, color, open_time, close_time } = req.body;
    try {
      const update = this.db.prepare('UPDATE canteens SET name=?, desc=?, location=?, emoji=?, color=?, open_time=?, close_time=? WHERE id=?');
      update.run(name, desc, location, emoji, color, open_time, close_time, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar cantina." });
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
    try {
      const del = this.db.prepare('DELETE FROM categories WHERE id=?');
      del.run(parseInt(req.params.id, 10));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar categoria." });
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
    this.dbManager = new DatabaseManager();
    this.setupControllers();
  }

  private setupControllers() {
    const controllers: BaseController[] = [
      new UserController(this.dbManager.db, this.app),
      new CanteenController(this.dbManager.db, this.app),
      new CategoryController(this.dbManager.db, this.app),
      new OrderController(this.dbManager.db, this.app)
    ];

    for (const controller of controllers) {
      controller.registerRoutes();
    }
  }

  public async start(port: number) {

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

