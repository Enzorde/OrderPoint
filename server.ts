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
  }
}

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
      new ProductController(this.dbManager.db, this.app),
      new CanteenController(this.dbManager.db, this.app),
      new CategoryController(this.dbManager.db, this.app),
      new RatingController(this.dbManager.db, this.app),
      new OrderController(this.dbManager.db, this.app)
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


// ============================================================================
// Controllers
// ============================================================================

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
    ];

// Start the server
const server = new AppServer();
server.start(3000);

