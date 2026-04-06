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

type Screen = 'login' | 'login-gestor' | 'cadastro' | 'cantinas' | 'catalogo' | 'carrinho' | 'confirmacao' | 'status' | 'gestor' | 'meus-pedidos' | 'perfil';

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
      fetch(`/api/orders/user/${currentUser.id}`)
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
        headers: { 'Content-Type': 'application/json' },
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
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchCanteens = async () => {
    try {
      const res = await fetch('/api/canteens');
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

  const authScreens = ['login', 'cadastro', 'login-gestor'];
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

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">🍽️ OrderPoint</div>
        <p className="auth-subtitle">Sistema de retirada de pedidos da cantina universitária</p>
        <div className="form">
          <label>E-mail institucional
            <input type="email" placeholder="123456@facens.br" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>Senha
            <input type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} />
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

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">🍽️ OrderPoint</div>
        <div className="tag tag-orange">Gestor da Cantina</div>
        <p className="auth-subtitle" style={{ marginTop: 8 }}>Acesse o painel de gerenciamento</p>
        <div className="form">
          <label>E-mail
            <input type="email" placeholder="gestor@facens.br" defaultValue="carlos@facens.br" />
          </label>
          <label>Senha
            <input type="password" placeholder="••••••••" defaultValue="123456" />
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const doCadastro = async () => {
    if (!nome || !email || !senha || !confirmaSenha) {
      setError('Preencha todos os campos obrigatórios.');
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
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nome, email, senha })
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

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">🍽️ OrderPoint</div>
        <p className="auth-subtitle">Crie sua conta com e-mail institucional</p>
        <div className="form">
          <label>Nome completo
            <input type="text" placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} />
          </label>
          <label>E-mail institucional
            <input type="email" placeholder="123456@facens.br" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>Senha
            <input type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} />
          </label>
          <label>Confirmar senha
            <input type="password" placeholder="Repita a senha" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)} />
          </label>
          <button className="btn-orange btn-full" onClick={doCadastro} disabled={loading || success}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
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
        <div className="tag tag-orange">RF2 — Menus Interativos</div>
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
      const res = await fetch(`/api/orders/user/${encodeURIComponent(currentUser.id)}`);
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
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    switch(status) {
      case 'aguardando': return '⏳ Aguardando Cantina';
      case 'preparo': return '👨‍🍳 Em Preparo';
      case 'pronto': return '🔔 Pronto para Retirada';
      case 'retirado': return '✅ Retirado';
      case 'cancelado': return '❌ Cancelado';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'aguardando': return { background: '#f0f7ff', color: 'var(--primary)' };
      case 'preparo': return { background: '#fff4e6', color: 'var(--orange)' };
      case 'pronto': return { background: '#e6f4ea', color: 'var(--success)' };
      case 'retirado': return { background: '#f1f3f4', color: 'var(--muted)' };
      case 'cancelado': return { background: '#fce8e6', color: 'var(--danger)' };
      default: return {};
    }
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
  const myCanteen = canteens[0] || null; // Assume gestor manages the first canteen
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
