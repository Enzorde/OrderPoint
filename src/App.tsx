import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker from 'emoji-picker-react';

type User = {
  id?: number;
  name: string;
  email?: string;
  matricula?: string;
  role: 'student' | 'manager';
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

type Category = {
  id: number;
  name: string;
};

function ScreenPerfil({ goTo, currentUser, setCurrentUser, showToast }: { goTo: (s: Screen) => void, currentUser: User | null, setCurrentUser: (u: User) => void, showToast: (msg: string) => void }) {
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [senha, setSenha] = useState('');
  const [totalOrders, setTotalOrders] = useState(0);

  const matricula = email.endsWith('@facens.br') ? email.replace('@facens.br', '') : (currentUser?.matricula || '');

  useEffect(() => {
    if (currentUser?.name) {
      fetch(`/api/orders/user/${currentUser.name}`)
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
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, senha })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Perfil atualizado com sucesso!');
        setCurrentUser({ ...currentUser, name, email, matricula: data.matricula });
        setSenha(''); // Clear password field after save
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
          <label>Nova Senha (deixe em branco para não alterar)
            <input type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} />
          </label>
          <button className="btn-orange" style={{ marginTop: 12 }} onClick={handleSave}>Salvar Alterações</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);


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
};

  const logout = () => {
    setCart([]);
    setCurrentUser(null);
    goTo('login');
  };

const authScreens = ['login', 'cadastro', 'login-gestor'];
  const showNavbar = !authScreens.includes(currentScreen);

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
            <input type="email" placeholder="seu@faculdade.edu.br" value={email} onChange={e => setEmail(e.target.value)} />
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
    setCurrentUser({ id: 999, name: 'Carlos (Gestor)', email: 'carlos@faculdade.edu.br', role: 'manager' });
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
            <input type="email" placeholder="gestor@faculdade.edu.br" defaultValue="carlos@faculdade.edu.br" />
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
    if (!email.endsWith('@facens.br')) {
      setError('O e-mail deve ser institucional (@facens.br).');
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
            <input type="email" placeholder="seu@faculdade.edu.br" value={email} onChange={e => setEmail(e.target.value)} />
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

  const activeProducts = products.filter(p => p.active === 1);
  const filteredProducts = activeCat === 'todos' ? activeProducts : activeProducts.filter(p => p.cat === activeCat);

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
          <div className="product-card" key={p.name}>
            <div className="product-emoji">{p.emoji}</div>
            <div className="product-info">
              <div className="product-name">{p.name}</div>
              <div className="product-desc">{p.desc}</div>
              <div className="product-footer">
                <span className="product-price">R$ {p.price.toFixed(2).replace('.', ',')}</span>
                <button 
                  className="btn-orange btn-sm" 
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  style={{ opacity: p.stock <= 0 ? 0.5 : 1 }}
                >
                  {p.stock <= 0 ? 'Esgotado' : '+ Adicionar'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenGestor({ products, fetchProducts, showToast, canteens, fetchCanteens, categories, fetchCategories }: { products: Product[], fetchProducts: () => void, showToast: (msg: string) => void, canteens: Canteen[], fetchCanteens: () => void, categories: Category[], fetchCategories: () => void }) {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'produtos' | 'cardapio' | 'config'>('pedidos');
  const [orders, setOrders] = useState<Order[]>([]);
  
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



