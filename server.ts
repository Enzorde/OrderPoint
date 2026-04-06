import express from "express";
type Request = express.Request;
type Response = express.Response;
import { createServer as createViteServer } from "vite";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import crypto from "crypto";
import swaggerUi from "swagger-ui-express";

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

    // Ratings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER UNIQUE NOT NULL,
        canteen_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Seed Products
    const count = this.db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
    if (count.count === 0) {
      const insertProd = this.db.prepare('INSERT INTO products (name, desc, price, emoji, cat) VALUES (?, ?, ?, ?, ?)');
      insertProd.run('Coxinha', 'Coxinha de frango crocante', 5.50, '🥟', 'salgados');
      insertProd.run('Esfiha', 'Esfiha de carne temperada', 4.00, '🥙', 'salgados');
      insertProd.run('Suco de Uva', 'Suco natural 300ml', 7.00, '🥤', 'bebidas');
      insertProd.run('Café', 'Café coado 200ml', 3.00, '☕', 'bebidas');
      insertProd.run('X-Burguer', 'Hamburguer completo', 18.00, '🍔', 'lanches');
      insertProd.run('Wrap de Frango', 'Frango grelhado com salada', 14.00, '🌯', 'lanches');
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
    this.app.post("/usuarios", this.register.bind(this)); // Alias for swagger
    this.app.post("/api/login", this.login.bind(this));
    this.app.put("/api/users/:id", this.updateProfile.bind(this));
  }

  private register(req: Request, res: Response) {
    const { name, email, senha } = req.body;
    if (!name || !email || !senha) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }

    const emailRegex = /^\d{6}@facens\.br$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "O e-mail deve ser institucional (@facens.br) e conter exatamente 6 dígitos numéricos antes do @ (seu RA)." });
    }

    const matricula = email.split('@')[0];
    const hashedSenha = hashPassword(senha);

    try {
      const insert = this.db.prepare('INSERT INTO users (name, email, matricula, senha, role) VALUES (?, ?, ?, ?, ?)');
      const result = insert.run(name, email, matricula, hashedSenha, 'student');
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
        const hashedSenha = hashPassword(senha);
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
        products = this.db.prepare('SELECT * FROM products WHERE active = 1 AND cat = ?').all(categoria);
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
    const { name, desc, price, emoji, cat, stock } = req.body;
    if (!name || !price || !cat) return res.status(400).json({ error: "Dados incompletos." });
    try {
      const insert = this.db.prepare('INSERT INTO products (name, desc, price, emoji, cat, stock) VALUES (?, ?, ?, ?, ?, ?)');
      const result = insert.run(name, desc || '', price, emoji || '🍽️', cat, stock !== undefined ? stock : 10);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar produto." });
    }
  }

  private update(req: Request, res: Response) {
    const { name, desc, price, emoji, cat, active, stock } = req.body;
    try {
      const update = this.db.prepare('UPDATE products SET name=?, desc=?, price=?, emoji=?, cat=?, active=?, stock=? WHERE id=?');
      update.run(name, desc, price, emoji, cat, active !== undefined ? active : 1, stock !== undefined ? stock : 10, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar produto." });
    }
  }

  private delete(req: Request, res: Response) {
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
    this.app.put("/api/canteens/:id", this.update.bind(this));
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

class RatingController extends BaseController {
  constructor(db: DatabaseSync, app: express.Application) {
    super(db, app);
  }

  public registerRoutes() {
    this.app.post("/api/ratings", this.create.bind(this));
  }

  private create(req: Request, res: Response) {
    const { order_id, canteen_id, score } = req.body;
    if (!order_id || !canteen_id || !score) return res.status(400).json({ error: "Dados incompletos." });
    try {
      const insert = this.db.prepare('INSERT INTO ratings (order_id, canteen_id, score) VALUES (?, ?, ?)');
      insert.run(order_id, canteen_id, score);
      res.status(201).json({ success: true });
    } catch (error: any) {
      if (error.message && error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Pedido já avaliado." });
      } else {
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
    const { user_name, user_id, items, total, canteen_id } = req.body;
    if (!user_name || !items || !total) return res.status(400).json({ error: "Dados incompletos." });
    
    let code = '';
    let inserted = false;
    let attempts = 0;

    while (!inserted && attempts < 10) {
      code = Math.floor(10000000 + Math.random() * 90000000).toString();
      
      try {
        this.db.exec('BEGIN TRANSACTION');
        
        const checkStock = this.db.prepare('SELECT stock, name FROM products WHERE id = ?');
        const checkStockByName = this.db.prepare('SELECT id, stock, name FROM products WHERE name = ?');
        
        // Verificar estoque antes de inserir o pedido
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
        }

        const insert = this.db.prepare('INSERT INTO orders (code, user_name, user_id, items, total, status, canteen_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const result = insert.run(code, user_name, user_id || null, JSON.stringify(items), total, 'aguardando', canteen_id || 1);
        
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
    try {
      const orders = this.db.prepare("SELECT * FROM orders WHERE status != 'retirado' AND status != 'cancelado' ORDER BY created_at DESC").all();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar pedidos." });
    }
  }

  private getByUserId(req: Request, res: Response) {
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
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status é obrigatório." });
    try {
      this.db.exec('BEGIN TRANSACTION');
      
      if (status === 'cancelado') {
        const order = this.db.prepare('SELECT status, items FROM orders WHERE id=?').get(req.params.id) as any;
        if (order && order.status !== 'cancelado') {
          const itemsArr = JSON.parse(order.items);
          const restoreStock = this.db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
          const restoreStockByName = this.db.prepare('UPDATE products SET stock = stock + ? WHERE name = ?');
          for (const item of itemsArr) {
            if (item.id) {
              restoreStock.run(item.qty, item.id);
            } else if (item.name) {
              restoreStockByName.run(item.qty, item.name);
            }
          }
        }
      }

      const update = this.db.prepare('UPDATE orders SET status=? WHERE id=?');
      update.run(status, req.params.id);
      
      this.db.exec('COMMIT');
      res.json({ success: true });
    } catch (error) {
      this.db.exec('ROLLBACK');
      res.status(500).json({ error: "Erro ao atualizar status do pedido." });
    }
  }

  private delete(req: Request, res: Response) {
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

// Start the server
const server = new AppServer();
server.start(3000);
