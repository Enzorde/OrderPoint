import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker from 'emoji-picker-react';

type User = {
  id?: number;
  name: string;
  email?: string;
  matricula?: string;
  role: 'student' | 'manager';
};

type Product = {
  id: number;
  name: string;
  desc: string;
  price: number;
  emoji: string;
  cat: string;
  active: number;
  stock: number;
};

type CartItem = {
  id: number;
  name: string;
  price: number;
  emoji: string;
  qty: number;
};

type Canteen = {
  id: number;
  name: string;
  desc: string;
  location: string;
  emoji: string;
  color: string;
  open_time: string;
  close_time: string;
  avg_rating: number;
  rating_count: number;
};

type Order = {
  id: number;
  code: string;
  user_name: string;
  items: string; // JSON string
  total: number;
  status: 'aguardando' | 'preparo' | 'pronto' | 'retirado' | 'cancelado';
  canteen_id: number;
  rating?: number;
  created_at: string;
};

type Category = {
  id: number;
  name: string;
};

type Screen = 'login' | 'login-gestor' | 'cadastro' | 'esqueci-senha' | 'cantinas' | 'catalogo' | 'carrinho' | 'confirmacao' | 'status' | 'gestor' | 'meus-pedidos' | 'perfil';

// --- Padrão de Projeto: STRATEGY (Conforme PDF) ---
interface GestorCallbacks {
  updateOrderStatus: (id: number, status: string) => void;
  setDeleteOrderConfirmId: (id: number) => void;
}

interface Padrao_StatusPedido {
  mostrarTexto(): string;
  mostrarCor(): { background?: string; color?: string; className?: string };
  renderGestorActions(orderId: number, callbacks: GestorCallbacks): React.ReactNode;
}

class Status_Aguardando implements Padrao_StatusPedido {
  mostrarTexto() { return '⏳ Aguardando Cantina'; }
  mostrarCor() { return { background: '#f0f7ff', color: 'var(--primary)' }; }
  renderGestorActions(orderId: number, callbacks: GestorCallbacks) {
    return (
      <React.Fragment>
        <span className="tag" style={{ background: '#f0f7ff', color: 'var(--primary)' }}>Aguardando</span>
        <div className="order-actions">
          <button className="btn-orange btn-sm" onClick={() => callbacks.updateOrderStatus(orderId, 'preparo')}>Aceitar</button>
          <button className="btn-danger btn-sm" onClick={() => callbacks.updateOrderStatus(orderId, 'cancelado')}>Recusar</button>
        </div>
      </React.Fragment>
    );
  }
}

class Status_Preparo implements Padrao_StatusPedido {
  mostrarTexto() { return '👨‍🍳 Em Preparo'; }
  mostrarCor() { return { background: '#fff4e6', color: 'var(--orange)' }; }
  renderGestorActions(orderId: number, callbacks: GestorCallbacks) {
    return (
      <React.Fragment>
        <span className="tag tag-orange">Em Preparo</span>
        <div className="order-actions">
          <button className="btn-success btn-sm" onClick={() => callbacks.updateOrderStatus(orderId, 'pronto')}>Pronto!</button>
          <button className="btn-danger btn-sm" onClick={() => callbacks.updateOrderStatus(orderId, 'cancelado')}>Cancelar</button>
        </div>
      </React.Fragment>
    );
  }
}

class Status_Pronto implements Padrao_StatusPedido {
  mostrarTexto() { return '🔔 Pronto para Retirada'; }
  mostrarCor() { return { background: '#e6f4ea', color: 'var(--success)' }; }
  renderGestorActions(orderId: number, callbacks: GestorCallbacks) {
    return (
      <React.Fragment>
        <span className="tag tag-success">Pronto para Retirada</span>
        <div className="order-actions">
          <button className="btn-success btn-sm" onClick={() => callbacks.updateOrderStatus(orderId, 'retirado')}>Marcar como Retirado</button>
        </div>
      </React.Fragment>
    );
  }
}

class Status_Retirado implements Padrao_StatusPedido {
  mostrarTexto() { return '✅ Retirado'; }
  mostrarCor() { return { background: '#f1f3f4', color: 'var(--muted)' }; }
  renderGestorActions(orderId: number, callbacks: GestorCallbacks) {
    return (
      <React.Fragment>
        <span className="tag" style={{ background: '#f3f4f6', color: '#4b5563' }}>Retirado</span>
        <div className="order-actions">
          <button className="btn-danger btn-sm" onClick={() => callbacks.setDeleteOrderConfirmId(orderId)}>Excluir</button>
        </div>
      </React.Fragment>
    );
  }
}

class Status_Cancelado implements Padrao_StatusPedido {
  mostrarTexto() { return '❌ Cancelado'; }
  mostrarCor() { return { background: '#fce8e6', color: 'var(--danger)' }; }
  renderGestorActions(orderId: number, callbacks: GestorCallbacks) {
    return (
      <React.Fragment>
        <span className="tag tag-danger">Cancelado</span>
        <div className="order-actions">
          <button className="btn-danger btn-sm" onClick={() => callbacks.setDeleteOrderConfirmId(orderId)}>Excluir</button>
        </div>
      </React.Fragment>
    );
  }
}

class Status_Outro implements Padrao_StatusPedido {
  constructor(private status: string) {}
  mostrarTexto() { return this.status; }
  mostrarCor() { return {}; }
  renderGestorActions(orderId: number, callbacks: GestorCallbacks) {
    return <React.Fragment></React.Fragment>;
  }
}

class StatusPedidoContexto {
  private m_Padrao_Status: Padrao_StatusPedido;

  constructor(status: string) {
    switch(status) {
      case 'aguardando': this.m_Padrao_Status = new Status_Aguardando(); break;
      case 'preparo': this.m_Padrao_Status = new Status_Preparo(); break;
      case 'pronto': this.m_Padrao_Status = new Status_Pronto(); break;
      case 'retirado': this.m_Padrao_Status = new Status_Retirado(); break;
      case 'cancelado': this.m_Padrao_Status = new Status_Cancelado(); break;
      default: this.m_Padrao_Status = new Status_Outro(status); break;
    }
  }

  set_Padrao_Status(novoStatus: Padrao_StatusPedido) {
    this.m_Padrao_Status = novoStatus;
  }

  comportamento_mostrarTexto() { return this.m_Padrao_Status.mostrarTexto(); }
  comportamento_mostrarCor() { return this.m_Padrao_Status.mostrarCor(); }
  comportamento_renderGestorActions(orderId: number, callbacks: GestorCallbacks) { return this.m_Padrao_Status.renderGestorActions(orderId, callbacks); }
}
// --- Fim Padrão Strategy ---

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

function ScreenPerfil({ goTo, currentUser, setCurrentUser, showToast }: { goTo: (s: Screen) => void, currentUser: User | null, setCurrentUser: (u: User) => void, showToast: (msg: string) => void }) {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);

  const matricula = email.endsWith('@facens.br') ? email.replace('@facens.br', '') : (currentUser?.matricula || '');

  useEffect(() => {
    if (currentUser?.id) {
      fetch(`/api/orders/user/${currentUser.id}`, {
        headers: { 'X-User-Id': currentUser.id.toString() }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTotalOrders(data.length);
          }
        })
        .catch(err => console.error(err));
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser?.id) return;

    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
    if (!nameRegex.test(name)) {
      showToast('Erro: O nome de usuário não pode conter números ou caracteres especiais, apenas letras.');
      return;
    }

    if (isChangingPassword) {
      if (senha !== confirmaSenha) {
        showToast('Erro: As senhas não coincidem.');
        return;
      }
      if (senha.length < 6) {
        showToast('Erro: A senha deve ter no mínimo 6 caracteres.');
        return;
      }
    }

    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify({ name, email, senha: isChangingPassword ? senha : '' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Perfil atualizado com sucesso!');
        setCurrentUser({ ...currentUser, name, email, matricula: data.matricula });
        setSenha(''); 
        setConfirmaSenha('');
        setIsChangingPassword(false);
      } else {
        showToast(data.error || 'Erro ao atualizar perfil.');
      }
    } catch (err) {
      showToast('Erro de conexão.');
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-secondary btn-sm" onClick={() => goTo(currentUser?.role === 'manager' ? 'gestor' : 'cantinas')}>← Voltar</button>
        <h2 style={{ margin: 0 }}>Meu Perfil</h2>
      </div>
      
      <div className="card" style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>👤</div>
          <h3 style={{ margin: 0 }}>{currentUser?.name}</h3>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: 14 }}>
            {currentUser?.role === 'manager' ? 'Gestor da Cantina' : 'Aluno'}
          </p>
          {currentUser?.role === 'student' && (
            <div style={{ marginTop: 16, display: 'inline-block', background: 'var(--primary-soft)', color: 'var(--primary)', padding: '8px 16px', borderRadius: 999, fontWeight: 'bold', fontSize: 14 }}>
              Total de Pedidos: {totalOrders}
            </div>
          )}
        </div>

        <div className="form">
          <label>Nome Completo
            <input type="text" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>E-mail
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          {currentUser?.role === 'student' && (
            <label>Matrícula
              <input type="text" value={matricula} readOnly style={{ background: 'var(--bg)', color: 'var(--muted)', cursor: 'not-allowed' }} title="Matrícula gerada automaticamente a partir do e-mail" />
            </label>
          )}

          {!isChangingPassword ? (
            <button className="btn-outline" style={{ marginTop: 8 }} onClick={() => setIsChangingPassword(true)}>
              Alterar Senha
            </button>
          ) : (
            <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginTop: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 12px 0' }}>Alterar Senha</h4>
              <label>Nova Senha
                <input type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} />
              </label>
              <label>Confirmar Nova Senha
                <input type="password" placeholder="Repita a nova senha" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} />
              </label>
              <button className="btn-secondary btn-sm" onClick={() => {
                setIsChangingPassword(false);
                setSenha('');
                setConfirmaSenha('');
              }}>Cancelar alteração de senha</button>
            </div>
          )}

          <button className="btn-orange" style={{ marginTop: 16 }} onClick={handleSave}>Salvar Alterações</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? 'cantinas' : 'login';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [cart, setCart] = useState<CartItem[]>(() => {
    const savedUser = localStorage.getItem('currentUser');
    const user = savedUser ? JSON.parse(savedUser) : null;
    if (user) {
      const savedCart = localStorage.getItem(`cart_${user.id}`);
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });
  const [orderCode, setOrderCode] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const savedCart = localStorage.getItem(`cart_${currentUser.id}`);
      setCart(savedCart ? JSON.parse(savedCart) : []);
    } else {
      setCart([]);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`cart_${currentUser.id}`, JSON.stringify(cart));
    }
  }, [cart, currentUser]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Erro ao carregar produtos", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error("Erro ao carregar categorias", err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCanteens();
    fetchCategories();
    
    // Polling para manter o catálogo e estoque atualizados em tempo real
    const interval = setInterval(() => {
      fetchProducts();
      fetchCanteens();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchCanteens = async () => {
    try {
      const res = await fetch('/api/canteens', { cache: 'no-store' });
      const data = await res.json();
      setCanteens(data);
    } catch (err) {
      console.error("Erro ao carregar cantinas", err);
    }
  };

  const goTo = (screen: Screen) => {
    setCurrentScreen(screen);
    window.scrollTo(0, 0);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(i => i.id === product.id);
    if (existing && existing.qty + 1 > product.stock) {
      showToast(`⚠️ Limite de estoque atingido!`);
      return;
    }
    if (!existing && product.stock < 1) {
      showToast('⚠️ Produto esgotado!');
      return;
    }

    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 }];
    });
    showToast(`✅ ${product.name} adicionado!`);
  };

  const changeQty = (index: number, delta: number) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.id);
    
    if (delta > 0 && product && item.qty + delta > product.stock) {
      showToast(`⚠️ Limite de estoque atingido!`);
      return;
    }

    setCart(prev => {
      const newCart = [...prev];
      newCart[index] = { ...newCart[index], qty: newCart[index].qty + delta };
      if (newCart[index].qty <= 0) {
        newCart.splice(index, 1);
      }
      return newCart;
    });
  };

  const clearCart = () => setCart([]);

  const finalizarPedido = async () => {
    if (cart.length === 0) {
      showToast('Adicione pelo menos um item ao carrinho!');
      return;
    }
    
    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: currentUser?.name || 'Aluno',
          user_id: currentUser?.id,
          items: cart,
          total: total,
          canteen_id: selectedCanteen?.id || 1
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setOrderCode(data.code);
        setCart([]);
        goTo('confirmacao');
        fetchProducts();
      } else {
        showToast(data.error || 'Erro ao finalizar pedido.');
      }
    } catch (err) {
      showToast('Erro de conexão com o servidor.');
    }
  };

  const logout = () => {
    setCart([]);
    setCurrentUser(null);
    goTo('login');
  };

  const authScreens = ['login', 'cadastro', 'login-gestor', 'esqueci-senha'];
  const showNavbar = !authScreens.includes(currentScreen);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <>
      {showNavbar && (
        <nav id="navbar">
          <div className="nav-logo" onClick={() => goTo(currentUser?.role === 'manager' ? 'gestor' : 'cantinas')} style={{ cursor: 'pointer' }}>🍽️ OrderPoint</div>
          <div className="nav-right">
            <span 
              className="nav-user" 
              id="nav-username" 
              onClick={() => goTo('perfil')}
              style={{ cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-soft)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              👤 {currentUser?.name}
            </span>
            {currentUser?.role === 'student' && (
              <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => goTo('meus-pedidos')}>
                📦 Meus Pedidos
              </button>
            )}
            <button className="cart-btn" onClick={() => goTo('carrinho')}>
              🛒 Carrinho <span className="cart-badge" id="cart-count">{cartCount}</span>
            </button>
            <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={logout}>Sair</button>
          </div>
        </nav>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {currentScreen === 'login' && <ScreenLogin goTo={goTo} setCurrentUser={setCurrentUser} />}
          {currentScreen === 'login-gestor' && <ScreenLoginGestor goTo={goTo} setCurrentUser={setCurrentUser} />}
          {currentScreen === 'cadastro' && <ScreenCadastro goTo={goTo} />}
          {currentScreen === 'esqueci-senha' && <ScreenEsqueciSenha goTo={goTo} />}
          {currentScreen === 'cantinas' && <ScreenCantinas goTo={goTo} canteens={canteens} setSelectedCanteen={setSelectedCanteen} />}
          {currentScreen === 'catalogo' && <ScreenCatalogo goTo={goTo} addToCart={addToCart} products={products} selectedCanteen={selectedCanteen} categories={categories} />}
          {currentScreen === 'carrinho' && <ScreenCarrinho goTo={goTo} cart={cart} changeQty={changeQty} clearCart={clearCart} finalizarPedido={finalizarPedido} />}
          {currentScreen === 'confirmacao' && <ScreenConfirmacao goTo={goTo} orderCode={orderCode} />}
          {currentScreen === 'status' && <ScreenStatus goTo={goTo} orderCode={orderCode} />}
          {currentScreen === 'meus-pedidos' && <ScreenMeusPedidos goTo={goTo} currentUser={currentUser} setOrderCode={setOrderCode} showToast={showToast} fetchCanteens={fetchCanteens} />}
          {currentScreen === 'gestor' && <ScreenGestor products={products} fetchProducts={fetchProducts} showToast={showToast} canteens={canteens} fetchCanteens={fetchCanteens} categories={categories} fetchCategories={fetchCategories} />}
          {currentScreen === 'perfil' && <ScreenPerfil goTo={goTo} currentUser={currentUser} setCurrentUser={setCurrentUser} showToast={showToast} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 24, right: 24,
              background: '#1a1a1a', color: 'white',
              padding: '12px 20px', borderRadius: 12,
              fontWeight: 'bold', fontSize: 14,
              zIndex: 9999
            }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ScreenLogin({ goTo, setCurrentUser }: { goTo: (s: Screen) => void, setCurrentUser: (u: User) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!email || !senha) {
      setError('Preencha todos os campos.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setCurrentUser({ 
          id: data.user.id,
          name: data.user.name, 
          email: data.user.email,
          matricula: data.user.matricula,
          role: data.user.role 
        });
        goTo('cantinas');
      } else {
        setError(data.error || 'Erro ao fazer login.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doLogin();
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">🍽️ OrderPoint</div>
        <p className="auth-subtitle">Sistema de retirada de pedidos da cantina universitária</p>
        <div className="form">
          <label>E-mail institucional
            <input 
              type="email" 
              placeholder="123456@facens.br" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              onKeyDown={handleKeyDown}
            />
          </label>
          <label>Senha
            <input 
              type="password" 
              placeholder="••••••••" 
              value={senha} 
              onChange={e => setSenha(e.target.value)} 
              onKeyDown={handleKeyDown}
            />
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--orange)', cursor: 'pointer' }} onClick={() => goTo('esqueci-senha')}>Esqueci minha senha</span>
            </div>
          </label>
          <button className="btn-orange btn-full" onClick={doLogin} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <button className="btn-outline btn-full" onClick={() => goTo('login-gestor')}>Entrar como Gestor</button>
        </div>
        <div className="auth-link">Não tem conta? <span onClick={() => goTo('cadastro')}>Cadastre-se</span></div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  );
}

function ScreenLoginGestor({ goTo, setCurrentUser }: { goTo: (s: Screen) => void, setCurrentUser: (u: User) => void }) {
  const doLoginGestor = () => {
    setCurrentUser({ id: 999, name: 'Carlos (Gestor)', email: 'carlos@facens.br', role: 'manager' });
    goTo('gestor');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doLoginGestor();
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">🍽️ OrderPoint</div>
        <div className="tag tag-orange">Gestor da Cantina</div>
        <p className="auth-subtitle" style={{ marginTop: 8 }}>Acesse o painel de gerenciamento</p>
        <div className="form">
          <label>E-mail
            <input type="email" placeholder="gestor@facens.br" defaultValue="carlos@facens.br" onKeyDown={handleKeyDown} />
          </label>
          <label>Senha
            <input type="password" placeholder="••••••••" defaultValue="123456" onKeyDown={handleKeyDown} />
          </label>
          <button className="btn-orange btn-full" onClick={doLoginGestor}>Entrar como Gestor</button>
        </div>
        <div className="auth-link"><span onClick={() => goTo('login')}>← Voltar para login aluno</span></div>
      </div>
    </div>
  );
}

function ScreenCadastro({ goTo }: { goTo: (s: Screen) => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'verification'>('form');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const doRequestCode = async () => {
    if (!nome || !email || !senha || !confirmaSenha) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
    if (!nameRegex.test(nome)) {
      setError('O nome de usuário não pode conter números ou caracteres especiais, apenas letras.');
      return;
    }
    if (senha !== confirmaSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    if (senha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    const emailRegex = /^\d{6}@facens\.br$/;
    if (!emailRegex.test(email)) {
      setError('O e-mail deve ser institucional (@facens.br) e conter exatamente 6 dígitos numéricos antes do @ (seu RA).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep('verification');
        setError(null);
      } else {
        setError(data.error || 'Erro ao enviar código.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const doCadastro = async () => {
    if (!code || code.length !== 6) {
      setError('Digite o código de 6 dígitos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, email, senha, code })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => goTo('login'), 2000);
      } else {
        setError(data.error || 'Erro ao criar conta.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDownForm = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doRequestCode();
    }
  };

  const handleKeyDownVerification = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doCadastro();
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">🍽️ OrderPoint</div>
        <p className="auth-subtitle">Crie sua conta com e-mail institucional</p>
        <div className="form">
          {step === 'form' ? (
            <>
              <label>Nome completo
                <input type="text" placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={handleKeyDownForm} />
              </label>
              <label>E-mail institucional
                <input type="email" placeholder="123456@facens.br" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDownForm} />
              </label>
              <label>Senha
                <input type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={handleKeyDownForm} />
              </label>
              <label>Confirmar senha
                <input type="password" placeholder="Repita a senha" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} onKeyDown={handleKeyDownForm} />
              </label>
              <button className="btn-orange btn-full" onClick={doRequestCode} disabled={loading || success}>
                {loading ? 'Enviando código...' : 'Continuar'}
              </button>
            </>
          ) : (
            <>
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Enviamos um código de 6 dígitos para <strong>{email}</strong>.
              </div>
              <label>Código de Verificação
                <input 
                  type="text" 
                  placeholder="000000" 
                  maxLength={6}
                  value={code} 
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))} 
                  onKeyDown={handleKeyDownVerification}
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
                />
              </label>
              <button className="btn-orange btn-full" onClick={doCadastro} disabled={loading || success}>
                {loading ? 'Verificando...' : 'Confirmar e Criar Conta'}
              </button>
              <button className="btn-outline btn-full" onClick={() => setStep('form')} disabled={loading || success}>
                Voltar
              </button>
            </>
          )}
        </div>
        <div className="auth-link">Já tem conta? <span onClick={() => goTo('login')}>Entrar</span></div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && (
          <div className="alert alert-success">
            ✅ Conta criada! Redirecionando para o login...
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenEsqueciSenha({ goTo }: { goTo: (s: Screen) => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [step, setStep] = useState<'email' | 'verification'>('email');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const doRequestCode = async () => {
    if (!email) {
      setError('Preencha o e-mail.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep('verification');
        setError(null);
      } else {
        setError(data.error || 'Erro ao enviar código.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const doResetPassword = async () => {
    if (!code || code.length !== 6) {
      setError('Digite o código de 6 dígitos.');
      return;
    }
    if (!novaSenha || !confirmaSenha) {
      setError('Preencha a nova senha.');
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: novaSenha })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => goTo('login'), 2000);
      } else {
        setError(data.error || 'Erro ao redefinir senha.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDownEmail = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doRequestCode();
    }
  };

  const handleKeyDownReset = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doResetPassword();
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">🍽️ OrderPoint</div>
        <p className="auth-subtitle">Recuperação de Senha</p>
        <div className="form">
          {step === 'email' ? (
            <>
              <label>E-mail institucional
                <input type="email" placeholder="123456@facens.br" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDownEmail} />
              </label>
              <button className="btn-orange btn-full" onClick={doRequestCode} disabled={loading || success}>
                {loading ? 'Enviando código...' : 'Continuar'}
              </button>
            </>
          ) : (
            <>
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Enviamos um código de 6 dígitos para <strong>{email}</strong>.
              </div>
              <label>Código de Verificação
                <input 
                  type="text" 
                  placeholder="000000" 
                  maxLength={6}
                  value={code} 
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))} 
                  onKeyDown={handleKeyDownReset}
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
                />
              </label>
              <label>Nova Senha
                <input type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} onKeyDown={handleKeyDownReset} />
              </label>
              <label>Confirmar Nova Senha
                <input type="password" placeholder="Repita a nova senha" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} onKeyDown={handleKeyDownReset} />
              </label>
              <button className="btn-orange btn-full" onClick={doResetPassword} disabled={loading || success}>
                {loading ? 'Redefinindo...' : 'Redefinir Senha'}
              </button>
              <button className="btn-outline btn-full" onClick={() => setStep('email')} disabled={loading || success}>
                Voltar
              </button>
            </>
          )}
        </div>
        <div className="auth-link"><span onClick={() => goTo('login')}>← Voltar para o login</span></div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && (
          <div className="alert alert-success">
            ✅ Senha redefinida! Redirecionando para o login...
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenCantinas({ goTo, canteens, setSelectedCanteen }: { goTo: (s: Screen) => void, canteens: Canteen[], setSelectedCanteen: (c: Canteen) => void }) {
  const isCanteenOpen = (canteen: Canteen) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [openH, openM] = canteen.open_time.split(':').map(Number);
    const [closeH, closeM] = canteen.close_time.split(':').map(Number);
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;

    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime <= closeTime;
    }
    return currentTime >= openTime && currentTime <= closeTime;
  };

  return (
    <div className="page">
      <div className="hero">
        <h1>Escolha uma Cantina 🏪</h1>
        <p>Selecione a cantina onde deseja fazer seu pedido</p>
      </div>
      <div className="cantinas-grid">
        {canteens.map(canteen => {
          const isOpen = isCanteenOpen(canteen);
          return (
            <div 
              key={canteen.id} 
              className="cantina-card" 
              style={{ opacity: isOpen ? 1 : 0.6, cursor: isOpen ? 'pointer' : 'not-allowed' }}
              onClick={() => {
                if (isOpen) {
                  setSelectedCanteen(canteen);
                  goTo('catalogo');
                }
              }}
            >
              <div className="cantina-img" style={{ background: canteen.color }}>{canteen.emoji}</div>
              <div className="cantina-info">
                <h3>{canteen.name}</h3>
                {canteen.location && (
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>📍 {canteen.location}</p>
                )}
                <p>{canteen.desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#f59e0b', fontSize: 14 }}>★</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{Number(canteen.avg_rating).toFixed(1)}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>({canteen.rating_count} avaliações)</span>
                </div>
                <div>
                  <span className={`status-dot ${isOpen ? 'status-open' : 'status-closed'}`}></span>
                  <strong style={{ color: isOpen ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
                    {isOpen ? 'Aberta' : 'Fechada'}
                  </strong> 
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {' '}· {isOpen ? `Fecha às ${canteen.close_time}` : `Abre às ${canteen.open_time}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScreenCatalogo({ goTo, addToCart, products, selectedCanteen, categories }: { goTo: (s: Screen) => void, addToCart: (p: Product) => void, products: Product[], selectedCanteen: Canteen | null, categories: Category[] }) {
  const [activeCat, setActiveCat] = useState('todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addedProductId, setAddedProductId] = useState<number | null>(null);

  const activeProducts = products.filter(p => p.active === 1);
  const filteredProducts = activeCat === 'todos' ? activeProducts : activeProducts.filter(p => p.cat === activeCat);

  const handleAddToCart = (p: Product) => {
    addToCart(p);
    setAddedProductId(p.id);
    setTimeout(() => setAddedProductId(null), 500);
  };

  return (
    <div className="page">
      <div className="catalog-header">
        <div>
          <div className="tag tag-orange">{selectedCanteen?.name || 'Cantina Central'}</div>
          <h1 style={{ marginTop: 6 }}>Cardápio 🍽️</h1>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => goTo('cantinas')}>← Trocar cantina</button>
      </div>
      <div className="category-tabs">
        <div className={`cat-tab ${activeCat === 'todos' ? 'active' : ''}`} onClick={() => setActiveCat('todos')}>Todos</div>
        {categories.map(cat => (
          <div key={cat.id} className={`cat-tab ${activeCat === cat.name ? 'active' : ''}`} onClick={() => setActiveCat(cat.name)}>
            {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
          </div>
        ))}
      </div>
      <div className="products-grid">
        {filteredProducts.map(p => (
          <motion.div 
            className="product-card" 
            key={p.name}
            animate={addedProductId === p.id ? { scale: [1, 1.05, 1], borderColor: ['#e5e7eb', '#f97316', '#e5e7eb'] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div 
              className="product-emoji" 
              onClick={() => setSelectedProduct(p)}
              style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Ver detalhes"
            >
              {p.emoji}
            </div>
            <div className="product-info">
              <div className="product-name">{p.name}</div>
              <div className="product-desc">{p.desc}</div>
              <div className="product-footer">
                <span className="product-price">R$ {p.price.toFixed(2).replace('.', ',')}</span>
                <button 
                  className="btn-orange btn-sm" 
                  onClick={() => handleAddToCart(p)}
                  disabled={p.stock <= 0}
                  style={{ opacity: p.stock <= 0 ? 0.5 : 1, transition: 'all 0.2s', transform: addedProductId === p.id ? 'scale(1.1)' : 'scale(1)' }}
                >
                  {addedProductId === p.id ? '✓ Adicionado' : (p.stock <= 0 ? 'Esgotado' : '+ Adicionar')}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 24
            }}
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                background: 'var(--bg)',
                borderRadius: 24,
                padding: 32,
                maxWidth: 400,
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                textAlign: 'center',
                position: 'relative'
              }}
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'var(--bg-secondary)', border: 'none',
                  width: 32, height: 32, borderRadius: '50%',
                  cursor: 'pointer', fontSize: 16, fontWeight: 'bold',
                  color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ✕
              </button>
              
              <div style={{ 
                fontSize: 80, 
                lineHeight: 1, 
                marginBottom: 16,
                background: 'var(--primary-soft)',
                width: 140, height: 140,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px auto',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.05)'
              }}>
                {selectedProduct.emoji}
              </div>
              
              <h2 style={{ margin: '0 0 8px 0', fontSize: 24, color: 'var(--text)' }}>{selectedProduct.name}</h2>
              
              <div className="tag tag-orange" style={{ marginBottom: 16 }}>
                R$ {selectedProduct.price.toFixed(2).replace('.', ',')}
              </div>
              
              <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.5, margin: '0 0 24px 0' }}>
                {selectedProduct.desc}
              </p>
              
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button 
                  className="btn-orange" 
                  style={{ flex: 1, padding: '12px 24px', fontSize: 16, transition: 'all 0.2s', transform: addedProductId === selectedProduct.id ? 'scale(1.05)' : 'scale(1)' }}
                  onClick={() => {
                    handleAddToCart(selectedProduct);
                    setTimeout(() => setSelectedProduct(null), 500);
                  }}
                  disabled={selectedProduct.stock <= 0}
                >
                  {addedProductId === selectedProduct.id ? '✓ Adicionado' : (selectedProduct.stock <= 0 ? 'Esgotado' : 'Adicionar ao Carrinho')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScreenCarrinho({ goTo, cart, changeQty, clearCart, finalizarPedido }: { goTo: (s: Screen) => void, cart: CartItem[], changeQty: (i: number, d: number) => void, clearCart: () => void, finalizarPedido: () => void }) {
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="page">
      <div className="hero">
        <h1>🛒 Meu Carrinho</h1>
        <p>Revise seus itens antes de finalizar</p>
      </div>
      <div className="cart-layout">
        <div className="card">
          <div>
            {cart.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '20px 0' }}>Seu carrinho está vazio.</p>
            ) : (
              cart.map((item, idx) => (
                <div className="cart-item" key={item.name}>
                  <span className="cart-emoji">{item.emoji}</span>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">R$ {item.price.toFixed(2).replace('.', ',')}</div>
                  </div>
                  <div className="qty-ctrl">
                    <button className="qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                    <strong>{item.qty}</strong>
                    <button className="qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                  </div>
                  <strong style={{ minWidth: 64, textAlign: 'right', color: 'var(--success)' }}>
                    R$ {(item.price * item.qty).toFixed(2).replace('.', ',')}
                  </strong>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn-secondary btn-sm" onClick={() => goTo('catalogo')}>← Continuar comprando</button>
            <button className="btn-danger btn-sm" onClick={clearCart}>🗑 Limpar carrinho</button>
          </div>
        </div>
        <div>
          <div className="card order-summary">
            <h3>Resumo do Pedido</h3>
            <div>
              {cart.map(item => (
                <div className="summary-line" key={item.name}>
                  <span>{item.name} × {item.qty}</span>
                  <span>R$ {(item.price * item.qty).toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span style={{ color: 'var(--success)' }}>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
            <button className="btn-orange btn-full" style={{ marginTop: 20 }} onClick={finalizarPedido}>
              ✅ Finalizar Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenConfirmacao({ goTo, orderCode }: { goTo: (s: Screen) => void, orderCode: string }) {
  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <div className="tag tag-success">Pedido Confirmado!</div>
        <h2 style={{ margin: '16px 0 8px' }}>Seu pedido foi enviado para a cantina</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 28 }}>Apresente o QR Code abaixo na hora da retirada</p>
        <div className="qr-box">📱</div>
        <div style={{ margin: '16px 0', fontSize: 22, fontWeight: 'bold', letterSpacing: 4, color: 'var(--orange)' }}>
          {orderCode}
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
          Guarde este código — ele é único para o seu pedido
        </p>
        <button className="btn-orange btn-full" onClick={() => goTo('status')}>
          📍 Acompanhar Status do Pedido
        </button>
      </div>
    </div>
  );
}

function ScreenStatus({ goTo, orderCode }: { goTo: (s: Screen) => void, orderCode: string }) {
  const [status, setStatus] = useState<'aguardando' | 'preparo' | 'pronto' | 'retirado' | 'cancelado'>('aguardando');

  useEffect(() => {
    if (!orderCode) return;
    
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderCode}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
        }
      } catch (err) {
        console.error('Erro ao buscar status', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [orderCode]);

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="hero">
        <h1>📍 Status do Pedido</h1>
        <p>Código: <strong style={{ color: 'var(--orange)' }}>{orderCode}</strong></p>
      </div>
      <div className="card">
        {status === 'cancelado' ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>❌</div>
            <h3 style={{ color: 'var(--danger)' }}>Pedido Cancelado</h3>
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>Seu pedido foi cancelado pela cantina.</p>
          </div>
        ) : (
          <div className="status-steps">
            <div className="step done">
              <div className="step-icon">✓</div>
              <div className="step-text">
                <div className="step-label">Pedido Confirmado</div>
                <div className="step-sublabel">Código QR gerado com sucesso</div>
              </div>
            </div>
            <div className={`step ${status === 'aguardando' ? 'active' : 'done'}`}>
              <div className="step-icon">{status === 'aguardando' ? '⏳' : '✓'}</div>
              <div className="step-text">
                <div className="step-label">Aguardando Cantina</div>
                <div className="step-sublabel">Aguardando confirmação da cantina</div>
              </div>
            </div>
            <div className={`step ${status === 'preparo' ? 'active' : (status === 'pronto' || status === 'retirado' ? 'done' : '')}`}>
              <div className="step-icon">{status === 'preparo' ? '👨‍🍳' : (status === 'pronto' || status === 'retirado' ? '✓' : '⏳')}</div>
              <div className="step-text">
                <div className="step-label">Em Preparo</div>
                <div className="step-sublabel">Sua comida está sendo preparada...</div>
              </div>
            </div>
            <div className={`step ${status === 'pronto' ? 'active' : (status === 'retirado' ? 'done' : '')}`}>
              <div className="step-icon">{status === 'pronto' ? '🔔' : (status === 'retirado' ? '✓' : '⏳')}</div>
              <div className="step-text">
                <div className="step-label">Pronto para Retirada</div>
                <div className="step-sublabel">{status === 'pronto' ? 'Vá buscar seu pedido!' : 'Aguardando...'}</div>
              </div>
            </div>
            <div className={`step ${status === 'retirado' ? 'active' : ''}`}>
              <div className="step-icon">{status === 'retirado' ? '✅' : '⏳'}</div>
              <div className="step-text">
                <div className="step-label">Retirado</div>
                <div className="step-sublabel">{status === 'retirado' ? 'Pedido finalizado' : 'Aguardando...'}</div>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <button className="btn-secondary btn-sm" onClick={() => goTo('cantinas')}>Fazer novo pedido</button>
        </div>
      </div>
    </div>
  );
}

function ScreenMeusPedidos({ goTo, currentUser, setOrderCode, showToast, fetchCanteens }: { goTo: (s: Screen) => void, currentUser: User | null, setOrderCode: (c: string) => void, showToast: (msg: string) => void, fetchCanteens: () => void }) {
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const prevMyOrdersRef = useRef<Order[]>([]);

  const fetchMyOrders = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/orders/user/${encodeURIComponent(currentUser.id)}`, {
        headers: { 'X-User-Id': currentUser.id.toString() },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        
        if (prevMyOrdersRef.current.length > 0) {
          data.forEach((order: Order) => {
            const prevOrder = prevMyOrdersRef.current.find(p => p.id === order.id);
            if (prevOrder && prevOrder.status !== order.status) {
              playNotificationSound();
              showToast(`🔔 O status do seu pedido ${order.code} mudou para: ${getStatusText(order.status)}`);
            }
          });
        }
        
        prevMyOrdersRef.current = data;
        setMyOrders(data);
      }
    } catch (err) {
      console.error('Erro ao buscar meus pedidos', err);
    }
  };

  useEffect(() => {
    fetchMyOrders();
    const interval = setInterval(fetchMyOrders, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleRate = async (orderId: number, canteenId: number, score: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify({ order_id: orderId, canteen_id: canteenId, score })
      });
      if (res.ok) {
        showToast('⭐ Avaliação enviada com sucesso!');
        fetchMyOrders();
        fetchCanteens();
      } else {
        showToast('Erro ao enviar avaliação.');
      }
    } catch (err) {
      showToast('Erro ao enviar avaliação.');
    }
  };

  const getStatusText = (status: string) => {
    return new StatusPedidoContexto(status).comportamento_mostrarTexto();
  };

  const getStatusColor = (status: string) => {
    return new StatusPedidoContexto(status).comportamento_mostrarCor();
  };

  return (
    <div className="page">
      <div className="hero">
        <h1>📦 Meus Pedidos</h1>
        <p>Acompanhe o histórico e status dos seus pedidos</p>
      </div>
      <div className="orders-list" style={{ maxWidth: 800, margin: '0 auto' }}>
        {myOrders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: 'var(--muted)' }}>Você ainda não fez nenhum pedido.</p>
            <button className="btn-orange" style={{ marginTop: 16 }} onClick={() => goTo('cantinas')}>Fazer meu primeiro pedido</button>
          </div>
        ) : (
          myOrders.map(order => {
            const items: CartItem[] = JSON.parse(order.items);
            const itemsText = items.map(i => `${i.qty}x ${i.name}`).join(', ');
            
            return (
              <div className="order-card" key={order.id}>
                <div>
                  <div className="order-id">Pedido {order.code}</div>
                  <div className="order-meta" style={{ marginBottom: 8 }}>{itemsText}</div>
                  <div style={{ fontWeight: 600 }}>Total: R$ {order.total.toFixed(2).replace('.', ',')}</div>
                </div>
                <div className="order-actions-user">
                  <span className="tag" style={getStatusColor(order.status)}>{getStatusText(order.status)}</span>
                  {order.status !== 'retirado' && order.status !== 'cancelado' && (
                    <button 
                      className="btn-secondary btn-sm" 
                      onClick={() => {
                        setOrderCode(order.code);
                        goTo('status');
                      }}
                    >
                      Ver Detalhes
                    </button>
                  )}
                  {order.status === 'retirado' && !order.rating && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <span 
                          key={star} 
                          style={{ cursor: 'pointer', fontSize: 20, color: '#d1d5db' }}
                          onClick={() => handleRate(order.id, order.canteen_id, star)}
                          onMouseEnter={(e) => {
                            const siblings = e.currentTarget.parentElement?.children;
                            if (siblings) {
                              for (let i = 0; i < siblings.length; i++) {
                                (siblings[i] as HTMLElement).style.color = i < star ? '#f59e0b' : '#d1d5db';
                              }
                            }
                          }}
                          onMouseLeave={(e) => {
                            const siblings = e.currentTarget.parentElement?.children;
                            if (siblings) {
                              for (let i = 0; i < siblings.length; i++) {
                                (siblings[i] as HTMLElement).style.color = '#d1d5db';
                              }
                            }
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                  {order.status === 'retirado' && order.rating && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} style={{ fontSize: 16, color: star <= order.rating! ? '#f59e0b' : '#d1d5db' }}>★</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ScreenGestor({ products, fetchProducts, showToast, canteens, fetchCanteens, categories, fetchCategories }: { products: Product[], fetchProducts: () => void, showToast: (msg: string) => void, canteens: Canteen[], fetchCanteens: () => void, categories: Category[], fetchCategories: () => void }) {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'produtos' | 'cardapio' | 'config'>('pedidos');
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>('todos');
  
  // Settings state
  const myCanteen = canteens[0] || null; 
  const [canteenName, setCanteenName] = useState(myCanteen?.name || '');
  const [canteenDesc, setCanteenDesc] = useState(myCanteen?.desc || '');
  const [canteenLocation, setCanteenLocation] = useState(myCanteen?.location || '');
  const [canteenEmoji, setCanteenEmoji] = useState(myCanteen?.emoji || '');
  const [canteenColor, setCanteenColor] = useState(myCanteen?.color || '#ffffff');
  const [openTime, setOpenTime] = useState(myCanteen?.open_time || '08:00');
  const [closeTime, setCloseTime] = useState(myCanteen?.close_time || '18:00');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (myCanteen) {
      setCanteenName(myCanteen.name);
      setCanteenDesc(myCanteen.desc);
      setCanteenLocation(myCanteen.location || '');
      setCanteenEmoji(myCanteen.emoji);
      setCanteenColor(myCanteen.color);
      setOpenTime(myCanteen.open_time);
      setCloseTime(myCanteen.close_time);
    }
  }, [myCanteen]);

  const handleSaveSettings = async () => {
    if (!myCanteen) return;
    try {
      await fetch(`/api/canteens/${myCanteen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: canteenName,
          desc: canteenDesc,
          location: canteenLocation,
          emoji: canteenEmoji,
          color: canteenColor,
          open_time: openTime, 
          close_time: closeTime 
        })
      });
      showToast('✅ Configurações atualizadas!');
      fetchCanteens();
    } catch (err) {
      showToast('Erro ao atualizar configurações.');
    }
  };
  
  // States for the product form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formCat, setFormCat] = useState(categories.length > 0 ? categories[0].name : 'salgados');
  const [formPrice, setFormPrice] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEmoji, setFormEmoji] = useState('🍽️');
  const [formStock, setFormStock] = useState('10');
  const [showProductEmojiPicker, setShowProductEmojiPicker] = useState(false);
  
  // Category management
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [deleteCatConfirmId, setDeleteCatConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !formCat) {
      setFormCat(categories[0].name);
    }
  }, [categories]);

  const handleAddCategory = async () => {
    if (!newCatName) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.toLowerCase() })
      });
      if (res.ok) {
        showToast('✅ Categoria adicionada!');
        setNewCatName('');
        setIsAddingCat(false);
        fetchCategories();
      } else {
        showToast('Erro ao adicionar categoria.');
      }
    } catch (err) {
      showToast('Erro ao adicionar categoria.');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('🗑️ Categoria excluída!');
        setDeleteCatConfirmId(null);
        fetchCategories();
      } else {
        showToast('Erro ao excluir categoria.');
      }
    } catch (err) {
      showToast('Erro ao excluir categoria.');
    }
  };

  const handleEditClick = (p: Product) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormCat(p.cat);
    setFormPrice(p.price.toString());
    setFormDesc(p.desc);
    setFormEmoji(p.emoji);
    setFormStock(p.stock.toString());
    setActiveTab('cardapio');
  };

  const handleNewClick = () => {
    setEditingId(null);
    setFormName('');
    setFormCat('salgados');
    setFormPrice('');
    setFormDesc('');
    setFormEmoji('🍽️');
    setFormStock('10');
    setActiveTab('cardapio');
  };

  const handleSaveProduct = async () => {
    if (!formName || !formPrice) {
      showToast('Nome e preço são obrigatórios!');
      return;
    }

    const payload = {
      name: formName,
      cat: formCat,
      price: parseFloat(formPrice),
      desc: formDesc,
      emoji: formEmoji,
      stock: parseInt(formStock, 10) || 0
    };

    try {
      if (editingId) {
        await fetch(`/api/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('✅ Produto atualizado!');
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        showToast('✅ Produto adicionado!');
      }
      fetchProducts();
      setActiveTab('produtos');
    } catch (err) {
      showToast('Erro ao salvar produto.');
    }
  };

  const handleToggleStatus = async (p: Product) => {
    try {
      await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, active: p.active === 1 ? 0 : 1 })
      });
      fetchProducts();
    } catch (err) {
      showToast('Erro ao alterar status.');
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteOrderConfirmId, setDeleteOrderConfirmId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      showToast('🗑️ Produto excluído!');
      fetchProducts();
      setDeleteConfirmId(null);
    } catch (err) {
      showToast('Erro ao excluir produto.');
    }
  };

  const handleDeleteOrder = async (id: number) => {
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      showToast('🗑️ Pedido excluído!');
      fetchOrders();
      setDeleteOrderConfirmId(null);
    } catch (err) {
      showToast('Erro ao excluir pedido.');
    }
  };

  const prevOrdersRef = useRef<Order[]>([]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        
        if (prevOrdersRef.current.length > 0) {
          const newOrders = data.filter((o: Order) => !prevOrdersRef.current.find(prev => prev.id === o.id));
          if (newOrders.length > 0) {
            playNotificationSound();
            showToast(`🔔 Novo pedido recebido! (${newOrders[0].code})`);
          }
        }
        
        prevOrdersRef.current = data;
        setOrders(data);
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos', err);
    }
  };

  const updateOrderStatus = async (id: number, status: string) => {
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchOrders();
      if (status === 'cancelado') {
        fetchProducts();
      }
    } catch (err) {
      showToast('Erro ao atualizar status.');
    }
  };

  useEffect(() => {
    if (activeTab === 'pedidos') {
      fetchOrders();
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  return (
    <div className="page">
      <div className="hero">
        <div className="tag tag-orange">Painel do Gestor</div>
        <h1>{myCanteen?.name || 'Cantina Central'} {myCanteen?.emoji || '🍽️'}</h1>
        <p>Gerencie pedidos e produtos da sua cantina</p>
      </div>

      <div className="gestor-tabs">
        <button className={`gestor-tab ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => setActiveTab('pedidos')}>📋 Pedidos</button>
        <button className={`gestor-tab ${activeTab === 'produtos' ? 'active' : ''}`} onClick={() => setActiveTab('produtos')}>🥘 Produtos</button>
        <button className={`gestor-tab ${activeTab === 'cardapio' ? 'active' : ''}`} onClick={() => setActiveTab('cardapio')}>📝 Cardápio</button>
        <button className={`gestor-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>⚙️ Configurações</button>
      </div>

      {activeTab === 'config' && (
        <div className="gestor-panel active">
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Configurações da Cantina</h3>
            
            {myCanteen && (
              <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <strong>Avaliação Atual: </strong>
                <span style={{ color: '#f59e0b' }}>★</span> {Number(myCanteen.avg_rating).toFixed(1)} ({myCanteen.rating_count} avaliações)
              </div>
            )}

            <div className="form">
              <label>Nome da Cantina
                <input type="text" value={canteenName} onChange={e => setCanteenName(e.target.value)} />
              </label>
              <label>Descrição
                <input type="text" value={canteenDesc} onChange={e => setCanteenDesc(e.target.value)} />
              </label>
              <label>Localização
                <input type="text" value={canteenLocation} onChange={e => setCanteenLocation(e.target.value)} />
              </label>
              <label style={{ position: 'relative' }}>Emoji
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={canteenEmoji} readOnly style={{ width: 60, textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
                  <button className="btn-secondary" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>Escolher Emoji</button>
                </div>
                {showEmojiPicker && (
                  <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, marginTop: 4 }}>
                    <EmojiPicker onEmojiClick={(emojiData) => {
                      setCanteenEmoji(emojiData.emoji);
                      setShowEmojiPicker(false);
                    }} />
                  </div>
                )}
              </label>
              <label>Cor de Fundo
                <input type="color" value={canteenColor} onChange={e => setCanteenColor(e.target.value)} style={{ height: 40, padding: 0, cursor: 'pointer' }} />
              </label>
              <label>Horário de Abertura
                <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
              </label>
              <label>Horário de Fechamento
                <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
              </label>
              <button className="btn-orange" style={{ marginTop: 12 }} onClick={handleSaveSettings}>Salvar Configurações</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pedidos' && (
        <div className="gestor-panel active">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className={`btn-sm ${orderFilter === 'todos' ? 'btn-orange' : 'btn-outline'}`} onClick={() => setOrderFilter('todos')}>Todos</button>
            <button className={`btn-sm ${orderFilter === 'aguardando' ? 'btn-orange' : 'btn-outline'}`} onClick={() => setOrderFilter('aguardando')}>Aguardando</button>
            <button className={`btn-sm ${orderFilter === 'preparo' ? 'btn-orange' : 'btn-outline'}`} onClick={() => setOrderFilter('preparo')}>Em Preparo</button>
            <button className={`btn-sm ${orderFilter === 'pronto' ? 'btn-orange' : 'btn-outline'}`} onClick={() => setOrderFilter('pronto')}>Pronto</button>
          </div>
          <div className="orders-list">
            {orders.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Nenhum pedido ativo no momento.</p>
            ) : (
              orders
                .filter(o => orderFilter === 'todos' || o.status === orderFilter)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map(order => {
                  const items: CartItem[] = JSON.parse(order.items);
                  const itemsText = items.map(i => `${i.name} × ${i.qty}`).join(' + ');
                  const orderTime = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div className="order-card" key={order.id}>
                      <div>
                        <div className="order-id">
                          Pedido {order.code} <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>🕒 {orderTime}</span>
                        </div>
                        <div className="order-meta">{order.user_name} · {itemsText} · R$ {order.total.toFixed(2).replace('.', ',')}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {new StatusPedidoContexto(order.status).comportamento_renderGestorActions(order.id, {
                          updateOrderStatus,
                          setDeleteOrderConfirmId
                        })}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {activeTab === 'produtos' && (
        <div className="gestor-panel active">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3>Produtos cadastrados</h3>
            <button className="btn-orange btn-sm" onClick={handleNewClick}>+ Novo Produto</button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {products.map(p => (
              <div className="order-card" key={p.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                  <div>
                    <div className="order-id">{p.name}</div>
                    <div className="order-meta">{p.cat} · R$ {p.price.toFixed(2).replace('.', ',')} · Estoque: {p.stock}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {p.active === 1 ? (
                    <>
                      <span className="tag tag-success">Disponível</span>
                      <button className="btn-danger btn-sm" onClick={() => handleToggleStatus(p)}>Pausar</button>
                    </>
                  ) : (
                    <>
                      <span className="tag" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>Pausado</span>
                      <button className="btn-success btn-sm" onClick={() => handleToggleStatus(p)}>Ativar</button>
                    </>
                  )}
                  <button className="btn-secondary btn-sm" onClick={() => handleEditClick(p)}>Editar</button>
                  <button className="btn-danger btn-sm" onClick={() => setDeleteConfirmId(p.id)}>Excluir</button>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p style={{ color: 'var(--muted)' }}>Nenhum produto cadastrado.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'cardapio' && (
        <div className="gestor-panel active">
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>{editingId ? 'Editar Produto' : 'Adicionar ao Cardápio'}</h3>
            <div className="form">
              <label style={{ position: 'relative' }}>Emoji
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={formEmoji} readOnly style={{ width: 60, textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowProductEmojiPicker(!showProductEmojiPicker)} />
                  <button className="btn-secondary" onClick={() => setShowProductEmojiPicker(!showProductEmojiPicker)}>Escolher Emoji</button>
                </div>
                {showProductEmojiPicker && (
                  <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, marginTop: 4 }}>
                    <EmojiPicker onEmojiClick={(emojiData) => {
                      setFormEmoji(emojiData.emoji);
                      setShowProductEmojiPicker(false);
                    }} />
                  </div>
                )}
              </label>
              <label>Nome do produto
                <input type="text" placeholder="Ex: Pão de Queijo" value={formName} onChange={e => setFormName(e.target.value)} />
              </label>
              <label>Categoria
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={formCat} onChange={e => setFormCat(e.target.value)} style={{ flex: 1 }}>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</option>
                    ))}
                  </select>
                  <button className="btn-secondary btn-sm" onClick={() => setIsAddingCat(!isAddingCat)}>
                    {isAddingCat ? 'Cancelar' : '+ Nova'}
                  </button>
                </div>
              </label>
              
              {isAddingCat && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <input type="text" placeholder="Nome da categoria" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ flex: 1, marginBottom: 0 }} />
                  <button className="btn-orange btn-sm" onClick={handleAddCategory}>Salvar</button>
                </div>
              )}

              {categories.length > 0 && !isAddingCat && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Gerenciar Categorias:</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                      <div key={cat.id} className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'white', border: '1px solid var(--line)', color: 'var(--text)' }}>
                        {cat.name}
                        <span style={{ cursor: 'pointer', color: 'var(--danger)', marginLeft: 4, padding: '0 4px', fontWeight: 'bold' }} onClick={() => setDeleteCatConfirmId(cat.id)}>×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label>Preço (R$)
                <input type="number" placeholder="0.00" step="0.50" value={formPrice} onChange={e => setFormPrice(e.target.value)} />
              </label>
              <label>Estoque Atual
                <input type="number" placeholder="Ex: 10" value={formStock} onChange={e => setFormStock(e.target.value)} />
              </label>
              <label>Descrição
                <input type="text" placeholder="Descreva o produto" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn-orange" style={{ flex: 1 }} onClick={handleSaveProduct}>
                  {editingId ? 'Salvar Alterações' : 'Adicionar Produto'}
                </button>
                {editingId && (
                  <button className="btn-secondary" onClick={handleNewClick}>Cancelar</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {deleteOrderConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card"
              style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}
            >
              <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Excluir Pedido</h3>
              <p style={{ marginBottom: 24, color: 'var(--muted)' }}>
                Tem certeza que deseja excluir este pedido? <strong>Esta ação não poderá ser desfeita.</strong>
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setDeleteOrderConfirmId(null)}>Cancelar</button>
                <button className="btn-danger" onClick={() => handleDeleteOrder(deleteOrderConfirmId)}>Sim, Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card"
              style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}
            >
              <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Atenção!</h3>
              <p style={{ marginBottom: 24, color: 'var(--muted)' }}>
                Tem certeza que deseja excluir este produto? <strong>Esta ação não poderá ser desfeita.</strong>
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancelar</button>
                <button className="btn-danger" onClick={() => handleDelete(deleteConfirmId)}>Sim, Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {deleteCatConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card"
              style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}
            >
              <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Excluir Categoria</h3>
              <p style={{ marginBottom: 24, color: 'var(--muted)' }}>
                Tem certeza que deseja excluir esta categoria? Os produtos associados a ela podem ficar sem categoria. <strong>Esta ação não poderá ser desfeita.</strong>
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setDeleteCatConfirmId(null)}>Cancelar</button>
                <button className="btn-danger" onClick={() => handleDeleteCategory(deleteCatConfirmId)}>Sim, Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
