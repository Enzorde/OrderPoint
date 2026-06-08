import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { globalEventBus, OrderStatusFactory, CartItem, showToast as globalShowToast, OrderActionConfig } from './patterns';
import EmojiPicker from 'emoji-picker-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './cropUtils';
import Markdown from 'react-markdown';
import ChatWidget from './components/ChatWidget';

function LazyMedia({ imageUrl, emoji, alt, className, style, onClick, onMouseEnter, onMouseLeave, title }: { imageUrl?: string, emoji?: string, alt?: string, className?: string, style?: React.CSSProperties, onClick?: () => void, onMouseEnter?: (e: React.MouseEvent) => void, onMouseLeave?: (e: React.MouseEvent) => void, title?: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      const t = setTimeout(() => setLoaded(true), 150);
      return () => clearTimeout(t);
    }
  }, [imageUrl]);

  if (imageUrl) {
    return (
      <div className={className} style={{ ...style, position: 'relative', overflow: 'hidden' }} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} title={title}>
        {!loaded && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-secondary)', animation: 'pulse 1.5s infinite' }} />}
        <img 
          src={imageUrl} 
          alt={alt} 
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }} 
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ ...style, position: 'relative', overflow: 'hidden' }} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} title={title}>
      {!loaded && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-secondary)', animation: 'pulse 1.5s infinite' }} />}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s', fontSize: 'inherit', position: 'relative', zIndex: 1 }}>
        {emoji}
      </div>
    </div>
  );
}

type User = {
  id?: string | number;
  name: string;
  email?: string;
  matricula?: string;
  role: 'student' | 'manager' | 'superadmin' | string;
  points?: number;
  canteen_id?: string | number;
};

type Product = {
  id: string | number;
  name: string;
  desc: string;
  price: number;
  emoji: string;
  cat: string;
  active: number;
  stock: number;
  points_price?: number;
  canteen_id?: string | number;
  tags?: string;
  isReward?: boolean;
  image_url?: string;
};

type Tag = {
  id: string | number;
  name: string;
  color: string;
  canteen_id: string | number;
};

type Coupon = {
  id: string | number;
  code: string;
  discount_pct: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  min_value: number;
  canteen_id: string | number;
  active: number;
};

type Canteen = {
  id: string | number;
  name: string;
  desc: string;
  location: string;
  emoji: string;
  color: string;
  open_time: string;
  close_time: string;
  avg_rating: number;
  rating_count: number;
  points_enabled?: number;
  maintenance_mode?: number;
  global_warning?: string;
  image_url?: string;
};

type Order = {
  id: string | number;
  code: string;
  user_name: string;
  items: string; // JSON string
  total: number;
  status: 'aguardando' | 'preparo' | 'pronto' | 'retirado' | 'cancelado';
  canteen_id: string | number;
  rating?: number;
  created_at: string;
  cancel_reason?: string;
};

type Category = {
  id: string | number;
  name: string;
  canteen_id?: string | number;
};

type Screen = 'login' | 'login-gestor' | 'cadastro' | 'esqueci-senha' | 'cantinas' | 'catalogo' | 'carrinho' | 'confirmacao' | 'status' | 'gestor' | 'meus-pedidos' | 'perfil' | 'pontos' | 'superadmin';

export const formatBrazilTime = (dateString: string | number) => {
  const d = typeof dateString === 'number' ? new Date(dateString) : (dateString.includes('Z') ? new Date(dateString) : new Date(dateString.replace(' ', 'T') + 'Z'));
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
};

export const formatBrazilDate = (dateString: string | number) => {
  const d = typeof dateString === 'number' ? new Date(dateString) : (dateString.includes('Z') ? new Date(dateString) : new Date(dateString.replace(' ', 'T') + 'Z'));
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

function EmptyState({ title, description, emoji = '🤷' }: { title: string, description?: string, emoji?: string }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px dashed var(--line)' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{emoji}</div>
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text)' }}>{title}</h3>
      {description && <p style={{ color: 'var(--muted)', fontSize: '14px' }}>{description}</p>}
    </div>
  );
}

function ScrollableRow({ children, className = "", wrapperClassName = "", style }: { children: React.ReactNode, className?: string, wrapperClassName?: string, style?: React.CSSProperties }) {
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 5);
    setShowRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5);
  }, []);

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    setTimeout(handleScroll, 100);
    return () => window.removeEventListener('resize', handleScroll);
  }, [children, handleScroll]);

  return (
    <div className={`scrollable-wrapper ${wrapperClassName}`} style={style}>
      <div className={`scroll-hint left ${showLeft ? 'visible' : ''}`}><span>←</span></div>
      <div className={`scrollable-content ${className}`} ref={scrollRef} onScroll={handleScroll}>
        {children}
      </div>
      <div className={`scroll-hint right ${showRight ? 'visible' : ''}`}><span>→</span></div>
    </div>
  );
}

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

function ScreenPontos({ goTo, currentUser, setCurrentUser, showToast }: { goTo: (s: Screen) => void, currentUser: User | null, setCurrentUser: (u: User) => void, showToast: (msg: string) => void }) {
  const points = currentUser?.points || 0;
  const [pointHistory, setPointHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetch(`/api/users/${currentUser.id}`, { headers: { 'X-User-Id': currentUser.id.toString() } })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(() => {});

      fetch(`/api/users/${currentUser.id}/points-history`, { headers: { 'X-User-Id': currentUser.id.toString() } })
        .then(res => res.json())
        .then(data => {
          setPointHistory(data);
          setLoadingHistory(false);
        })
        .catch(() => setLoadingHistory(false));
    }
  }, [currentUser?.id, setCurrentUser]);

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="hero">
        <h1>⭐️ Meus Pontos</h1>
        <p>Acompanhe e resgate seus pontos por produtos</p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '40px 20px', marginBottom: 24, background: 'linear-gradient(135deg, var(--orange), #f97316)', color: 'white' }}>
        <h2 style={{ fontSize: 48, margin: '0 0 8px 0', border: 'none', color: 'white' }}>{points}</h2>
        <p style={{ opacity: 0.9, margin: 0, fontSize: 16 }}>Pontos disponíveis</p>
        <div style={{ marginTop: 24, fontSize: 14, opacity: 0.8 }}>
          Ganhe 1 ponto a cada R$ 1,00 gasto na cantina. Os pontos são adicionados após a retirada do pedido.
        </div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7, fontStyle: 'italic' }}>
          *Atenção: Algumas cantinas podem não participar do programa de pontos.
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📋</span> Histórico de Pontos
        </h2>
        
        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Carregando histórico...</div>
        ) : pointHistory.length === 0 ? (
          <EmptyState title="Nenhum histórico" description="Você ainda não ganhou ou gastou pontos." emoji="📝" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pointHistory.map((log) => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg-color)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {log.description}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: 16,
                  color: log.type === 'earned' ? 'var(--success)' : 'var(--danger)'
                }}>
                  {log.type === 'earned' ? '+' : '-'}{log.amount} PTS
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
    if (name.trim().split(/\s+/).length < 2) {
      showToast('Erro: Por favor, informe nome e sobrenome.');
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
      if (getPasswordStrength(senha) < 4) {
        showToast('Erro: A senha deve conter ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial.');
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

function ToastNotifier() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    return globalEventBus.subscribe('TOAST_NOTIFICATION', (msg: string) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 3000);
    });
  }, []);

  return (
    <AnimatePresence>
      {toastMsg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          style={{
            position: 'fixed', bottom: 24, right: 24,
            background: 'var(--card)', color: 'var(--text)',
            padding: '12px 20px', borderRadius: 12,
            fontWeight: 'bold', fontSize: 14,
            zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }}
        >
          {toastMsg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role === 'superadmin') return 'superadmin';
        if (parsed && (parsed.role === 'manager' || parsed.role === 'gestor')) return 'gestor';
        if (parsed) return 'cantinas';
      } catch (e) {
        return 'login';
      }
    }
    return 'login';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
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
  const [confirmedOrders, setConfirmedOrders] = useState<{code: string, canteenName: string, checkoutUrl?: string}[]>([]);
  const [couponCodeState, setCouponCodeState] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('cantinahub_theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('cantinahub_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const updateCart = (action: React.SetStateAction<CartItem[]>) => {
    setCart((prev) => {
      const newCart = typeof action === 'function' ? (action as any)(prev) : action;
      if (currentUserRef.current) {
        localStorage.setItem(`cart_${currentUserRef.current.id}`, JSON.stringify(newCart));
      }
      return newCart;
    });
  };

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

  const [allCoupons, setAllCoupons] = useState<Coupon[]>([]);

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      const data = await res.json();
      setGlobalSettings(data);
    } catch(err) {}
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Erro ao carregar produtos", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Erro ao carregar categorias", err);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data = await res.json();
        setTags(data);
      }
    } catch (err) {
      console.error("Erro ao carregar tags", err);
    }
  };

  const fetchAllCoupons = async () => {
    try {
      const res = await fetch('/api/coupons', { headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
      if (res.ok) {
        const data = await res.json();
        setAllCoupons(data);
      }
    } catch (err) {
      console.error("Erro ao carregar cupons", err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCanteens();
    fetchCategories();
    fetchTags();
    fetchGlobalSettings();
    fetchAllCoupons();
    
    // Polling para manter o catálogo e estoque atualizados em tempo real
    const interval = setInterval(() => {
      fetchProducts();
      fetchCanteens();
      fetchTags();
      fetchGlobalSettings();
      fetchAllCoupons();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHelpModalOpen) {
        setIsHelpModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHelpModalOpen]);

  const fetchCanteens = async () => {
    try {
      const res = await fetch('/api/canteens', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCanteens(data);
      }
    } catch (err) {
      console.error("Erro ao carregar cantinas", err);
    }
  };

  const goTo = (screen: Screen) => {
    setPreviousScreen(currentScreen);
    setCurrentScreen(screen);
    window.scrollTo(0, 0);
  };

  const showToast = globalShowToast;

  const addToCart = (product: Product & { isReward?: boolean }) => {
    const existing = cart.find(i => i.id === product.id && i.isReward === product.isReward);
    if (existing && existing.qty + 1 > product.stock) {
      showToast(`⚠️ Limite de estoque atingido!`);
      return;
    }
    if (!existing && product.stock < 1) {
      showToast('⚠️ Produto esgotado!');
      return;
    }

    updateCart(prev => {
      const ex = prev.find(i => i.id === product.id && i.isReward === product.isReward);
      if (ex) {
        return prev.map(i => (i.id === product.id && i.isReward === product.isReward) ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1, canteen_id: product.canteen_id, isReward: product.isReward, points_price: product.points_price }];
    });
    showToast(`✅ ${product.name} adicionado!`);
  };

  const handleRemoveFromCart = (productId: string, use_points?: boolean) => {
    const item = cart.find(i => i.id.toString() === productId.toString() && !!i.isReward === !!use_points);
    if (item) {
      updateCart(prev => prev.filter(i => !(i.id.toString() === productId.toString() && !!i.isReward === !!use_points)));
      showToast(`❌ ${item.name} removido!`);
    }
  };

  const changeQty = (index: number, delta: number) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.id);
    
    if (delta > 0 && product && item.qty + delta > product.stock) {
      showToast(`⚠️ Limite de estoque atingido!`);
      return;
    }

    updateCart(prev => {
      const newCart = [...prev];
      newCart[index] = { ...newCart[index], qty: newCart[index].qty + delta };
      if (newCart[index].qty <= 0) {
        newCart.splice(index, 1);
      }
      return newCart;
    });
  };

  const handleGoBackFromCart = () => {
    if (previousScreen === 'catalogo') {
      if (selectedCanteen && !isCanteenOpen(selectedCanteen)) {
         showToast('A cantina que você estava navegando está fechada. Redirecionando para cantinas.');
         goTo('cantinas');
      } else {
         setCurrentScreen('catalogo');
         window.scrollTo(0, 0);
      }
    } else {
       if (previousScreen && previousScreen !== 'carrinho') {
         setCurrentScreen(previousScreen);
       } else {
         setCurrentScreen('cantinas');
       }
       window.scrollTo(0, 0);
    }
  };

  const clearCart = () => {
    updateCart([]);
    setAppliedCoupon(null);
    setCouponCodeState('');
    setCouponError('');
  };

  const handleApplyCoupon = async (code: string) => {
    if (!code) {
       setAppliedCoupon(null);
       setCouponCodeState('');
       setCouponError('');
       return;
    }
    setCouponError('');
    try {
      // Find which canteen we are applying for, if cart is empty we don't know
      if (cart.length === 0) return;
      const canteenIds = [...new Set(cart.map(item => String(item.canteen_id || products.find(p => p.id === item.id)?.canteen_id || '1')))];
      
      let applicable: any = null;
      let errorMsg = 'Cupom inválido para as cantinas do carrinho.';

      for (const cid of canteenIds) {
        const applicableItems = cart.filter(item => String((item.canteen_id || products.find(p => p.id === item.id)?.canteen_id || '1')) === cid && !item.isReward);
        if (applicableItems.length === 0) {
          errorMsg = 'Nenhum item válido para desconto nesta cantina.';
          continue;
        }
        const canteenTotal = applicableItems.reduce((sum, item) => sum + item.price * item.qty, 0);

        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code.toUpperCase(), canteen_id: cid, cart_total: canteenTotal })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          applicable = data.coupon;
          break;
        } else {
          if (data.error !== 'Cupom inválido.') {
            errorMsg = data.error;
          }
        }
      }

      if (applicable) {
        setAppliedCoupon(applicable);
        setCouponCodeState(applicable.code);
        setCouponError('');
        showToast(`✅ Cupom ${applicable.code} de ${applicable.discount_pct}% aplicado!`);
      } else {
        setCouponError(errorMsg);
        setAppliedCoupon(null);
      }
    } catch (e) {
      setCouponError('Erro ao validar cupom.');
      setAppliedCoupon(null);
    }
  };

  const finalizarPedido = async () => {
    if (cart.length === 0) {
      showToast('Adicione pelo menos um item ao carrinho!');
      return;
    }
    
    setIsSubmitting(true);
    // Group items by canteen
    const ordersByCanteen: Record<string, CartItem[]> = {};
    for (const item of cart) {
      const cid = String(item.canteen_id || products.find(p => p.id === item.id)?.canteen_id || '1');
      if (!ordersByCanteen[cid]) ordersByCanteen[cid] = [];
      ordersByCanteen[cid].push(item);
    }
    
    try {
      let createdCodes: string[] = [];
      let newConfirmedOrders: { code: string, canteenName: string }[] = [];
      let totalPointsDeducted = 0;
      for (const [canteen_id, items] of Object.entries(ordersByCanteen)) {
        const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const applicableTotal = items.filter(i => !i.isReward).reduce((sum, item) => sum + item.price * item.qty, 0);
        const pointsDeducted = items.reduce((sum, item) => sum + (item.isReward && item.points_price ? item.points_price * item.qty : 0), 0);

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
          body: JSON.stringify({
            user_name: currentUser?.name || 'Aluno',
            user_id: currentUser?.id,
            items: items,
            total: total,
            canteen_id: canteen_id,
            coupon_code: appliedCoupon && String(appliedCoupon.canteen_id) === canteen_id && applicableTotal >= (appliedCoupon.min_value || 0) && applicableTotal > 0 ? appliedCoupon.code : undefined
          })
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
           createdCodes.push(data.code);
           const canteenName = canteens.find((c) => String(c.id) === String(canteen_id))?.name || 'Cantina';
           newConfirmedOrders.push({ code: data.code, canteenName });
           totalPointsDeducted += pointsDeducted;
           
           if (data.checkoutUrl) {
             window.localStorage.setItem('cartToClear', 'true');
             window.location.href = data.checkoutUrl;
             return;
           }
        } else {
           throw new Error(data.error || 'Erro ao finalizar pedido.');
        }
      }

      if (totalPointsDeducted > 0 && currentUser) {
        setCurrentUser({ ...currentUser, points: Math.max(0, (currentUser.points || 0) - totalPointsDeducted) });
      }

      setOrderCode(createdCodes.join(', '));
      setConfirmedOrders(newConfirmedOrders);
      if (window.localStorage.getItem('cartToClear') !== 'true') {
        updateCart([]);
      } else {
        window.localStorage.removeItem('cartToClear');
        updateCart([]);
      }
      setAppliedCoupon(null);
      setCouponCodeState('');
      goTo('confirmacao');
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get('session_id');
    const action = query.get('action');

    if (action === 'payment_success' && sessionId) {
      fetch(`/api/verify-checkout-session?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast('Pagamento confirmado com sucesso!');
            window.history.replaceState({}, document.title, window.location.pathname);
            setOrderCode(data.code || '');
            const canteenName = canteens.find((c) => String(c.id) === String(data.canteen_id))?.name || 'Cantina';
            if (data.code) {
              setConfirmedOrders([{ code: data.code, canteenName }]);
            }
            goTo('confirmacao'); // Show order confirmation
            updateCart([]);
            window.localStorage.removeItem('cartToClear');
          }
        })
        .catch(console.error);
    } else if (action === 'payment_cancelled') {
        showToast('Pagamento cancelado.');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [canteens]);

  const logout = () => {
    setCart([]);
    setCurrentUser(null);
    goTo('login');
  };

  const authScreens = ['login', 'cadastro', 'login-gestor', 'esqueci-senha'];
  const showNavbar = !authScreens.includes(currentScreen);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  if (globalSettings?.global_maintenance === '1' && (!currentUser || currentUser.role !== 'superadmin')) {
    if (currentScreen !== 'login') {
       return (
         <div className="page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
           <h1 style={{ fontSize: 48, marginBottom: 16 }}>🚧</h1>
           <h2 style={{ marginBottom: 12 }}>Sistema em Manutenção</h2>
           <p style={{ color: 'var(--muted)', maxWidth: 400, lineHeight: 1.5, marginBottom: 24 }}>
             O CantinaHUB está temporariamente indisponível para atualizações importantes. Por favor, retorne mais tarde.
           </p>
           {currentUser && (
             <button className="btn-secondary" onClick={logout}>Sair da Conta</button>
           )}
           {!currentUser && (
             <button className="btn-secondary" onClick={() => setCurrentScreen('login')}>Voltar ao Login</button>
           )}
         </div>
       );
    }
  }

  return (
    <>
      {globalSettings?.global_warning && globalSettings.global_warning.trim() !== '' && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fca5a5', color: '#b91c1c', padding: 12, fontSize: 14, textAlign: 'center', zIndex: 100, position: 'relative' }}>
          ⚠️ <strong>Aviso da Facens:</strong> {globalSettings.global_warning}
        </div>
      )}
      {globalSettings?.global_maintenance === '1' && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', color: '#b45309', padding: 12, fontSize: 14, textAlign: 'center', zIndex: 100, position: 'relative' }}>
          ⛔ <strong>Sistema em manutenção:</strong> {currentUser?.role === 'superadmin' ? 'Você é um superadmin, pode navegar.' : 'O sistema está bloqueado para novos pedidos e logins no momento.'}
        </div>
      )}
      {showNavbar && (
        <nav id="navbar">
          <div className="nav-logo" onClick={() => goTo(currentUser?.role === 'superadmin' ? 'superadmin' : currentUser?.role === 'manager' ? 'gestor' : 'cantinas')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><img src="/logo.png" alt="Logo" style={{ height: 32, objectFit: 'contain' }} /> <img src="/op.png" alt="OrderPoint" style={{ height: 24, objectFit: 'contain' }} /></div>
          <ScrollableRow wrapperClassName="nav-right-wrapper" className="nav-right">
              <button
                className="btn-outline"
                style={{ padding: '6px 12px', fontSize: 13, border: 'none', background: 'var(--card)' }}
                onClick={() => setIsHelpModalOpen(true)}
                title="Ajuda e Documentação"
              >
                ❓ Ajuda
              </button>
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
                <>
                  <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => goTo('pontos')}>
                    ⭐️ Meus Pontos ({currentUser.points || 0})
                  </button>
                  <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => goTo('meus-pedidos')}>
                    📦 Meus Pedidos
                  </button>
                  <button className="cart-btn" onClick={() => goTo('carrinho')}>
                    🛒 Carrinho <span className="cart-badge" id="cart-count">{cartCount}</span>
                  </button>
                </>
              )}
              <button 
                className="btn-secondary" 
                style={{ width: 36, height: 36, padding: 0, fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }} 
                onClick={() => setIsDarkMode(!isDarkMode)}
                title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={logout}>Sair</button>
          </ScrollableRow>
        </nav>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {currentScreen === 'login' && <ScreenLogin goTo={goTo} setCurrentUser={setCurrentUser} />}
          {currentScreen === 'login-gestor' && <ScreenLoginGestor goTo={goTo} setCurrentUser={setCurrentUser} showToast={showToast} />}
          {currentScreen === 'cadastro' && <ScreenCadastro goTo={goTo} />}
          {currentScreen === 'esqueci-senha' && <ScreenEsqueciSenha goTo={goTo} />}
          {currentScreen === 'cantinas' && <ScreenCantinas goTo={goTo} canteens={canteens} setSelectedCanteen={setSelectedCanteen} currentUser={currentUser} />}
          {currentScreen === 'catalogo' && <ScreenCatalogo goTo={goTo} addToCart={addToCart} products={products} selectedCanteen={selectedCanteen} categories={categories} tags={tags} currentUser={currentUser} cart={cart} showToast={showToast} />}
          {currentScreen === 'carrinho' && <ScreenCarrinho goBack={handleGoBackFromCart} cart={cart} changeQty={changeQty} clearCart={clearCart} finalizarPedido={finalizarPedido} isSubmitting={isSubmitting} couponCodeState={couponCodeState} setCouponCodeState={setCouponCodeState} handleApplyCoupon={handleApplyCoupon} appliedCoupon={appliedCoupon} couponError={couponError} setCouponError={setCouponError} selectedCanteen={selectedCanteen} products={products} />}
          {currentScreen === 'confirmacao' && <ScreenConfirmacao goTo={goTo} orderCode={orderCode} confirmedOrders={confirmedOrders} />}
          {currentScreen === 'status' && <ScreenStatus goTo={goTo} orderCode={orderCode} />}
          {currentScreen === 'meus-pedidos' && <ScreenMeusPedidos goTo={goTo} currentUser={currentUser} setOrderCode={setOrderCode} showToast={showToast} fetchCanteens={fetchCanteens} canteens={canteens} />}
          {currentScreen === 'gestor' && <ScreenGestor products={products} tags={tags} fetchTags={fetchTags} currentUser={currentUser} fetchProducts={fetchProducts} showToast={showToast} canteens={canteens} fetchCanteens={fetchCanteens} categories={categories} fetchCategories={fetchCategories} />}
          {currentScreen === 'superadmin' && <ScreenSuperadmin goTo={goTo} currentUser={currentUser} showToast={showToast} fetchCanteens={fetchCanteens} globalSettings={globalSettings} fetchGlobalSettings={fetchGlobalSettings} />}
          {currentScreen === 'perfil' && <ScreenPerfil goTo={goTo} currentUser={currentUser} setCurrentUser={setCurrentUser} showToast={showToast} />}
          {currentScreen === 'pontos' && <ScreenPontos goTo={goTo} currentUser={currentUser} setCurrentUser={setCurrentUser} showToast={showToast} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {isHelpModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
            onClick={() => setIsHelpModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: 'var(--card)', padding: 30, borderRadius: 16, width: '100%', maxWidth: 600,
                maxHeight: '90vh', overflowY: 'auto'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: 16 }}>❓ Ajuda e Funcionalidades</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, lineHeight: '1.6', color: 'var(--text)' }}>
                {currentUser?.role === 'manager' ? (
                  <>
                    <p>Bem-vindo ao <strong>OrderPoint (Painel do Gestor)</strong>! Aqui estão as principais funcionalidades e dicas para o dia a dia da sua cantina:</p>
                    
                    <div>
                      <strong>📋 Gestão de Pedidos (Kanban)</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Acompanhe os pedidos em tempo real. Mova os cards pelas colunas "Aguardando", "Preparo", e "Pronto". Para entregar o pedido e garantir a segurança, solicite o <strong>código de retirada</strong> ao aluno e verifique se bate com o código exibido no card.
                      </p>
                    </div>

                    <div>
                      <strong>🍔 Gerenciamento de Produtos e Categorias</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Na aba "Produtos", você pode adicionar itens, editar preços, definir o estoque e pausar produtos esgotados. Crie categorias, e adicione tags (como "Vegano", "Sem Glúten") para ajudar os alunos a encontrarem o que desejam.
                      </p>
                    </div>

                    <div>
                      <strong>🎟️ Cupons de Desconto</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Crie códigos promocionais na aba "Cupons" para atrair vendas. Você pode definir o desconto em porcentagem, o limite de vezes que o cupom pode ser usado, data de validade e o valor mínimo de compra para ativá-lo.
                      </p>
                    </div>

                    <div>
                      <strong>🎁 Sistema de Recompensas (Pontos)</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Na aba "Recompensas", defina produtos que os alunos poderão trocar por pontos (gratuitamente). O aluno ganha 1 ponto a cada R$ 1 gasto na plataforma automaticamente, aumentando a fidelidade.
                      </p>
                    </div>

                    <div style={{ padding: 12, background: 'var(--primary-soft)', borderRadius: 8 }}>
                      <strong>💡 Dica importante:</strong>
                      <p style={{ margin: 0, color: 'var(--primary)', fontSize: 14 }}>
                        O código de retirada (ex: A7K2) garante a segurança da entrega e evita filas. Ele também serve para encontrar o pedido rapidamente no seu painel.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Bem-vindo ao <strong>OrderPoint</strong>! Aqui estão as principais funcionalidades e dicas para uma experiência mais rápida na cantina:</p>

                    <div>
                      <strong>🍔 Como Fazer um Pedido (Pule a Fila!)</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Navegue pelo cardápio, escolha o que deseja comer, e adicione ao carrinho. Após confirmar seu pedido, um <strong>Código de retirada (ex: A7K2)</strong> será gerado. Guarde ele, você vai precisar para pegar o seu lanche!
                      </p>
                    </div>

                    <div>
                      <strong>🏷️ Acompanhe o Status</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Vá em "Meus Pedidos" para ver em tempo real se a sua refeição está "Aguardando", "Em Preparo" ou "Pronto". Quando estiver pronto, vá até o balcão e apenas fale o seu código de retirada. Pronto! O lanche é seu.
                      </p>
                    </div>

                    <div>
                      <strong>🎟️ Uso de Cupons</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Fique de olho em promoções das cantinas! Você pode aplicar grandes descontos usando cupons fornecidos pelos gestores. Cole o código do cupom no carrinho antes de encerrar sua compra de lanches.
                      </p>
                    </div>

                    <div>
                      <strong>⭐️ Ganhando e Resgatando Pontos</strong>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        A cada R$ 1,00 gasto em pedidos não cancelados, você ganha 1 ponto (PTS). Vá na aba "Meus Pontos" para descobrir o saldo, e visualize diretamente nos cardápios quais itens você pode resgatar "de graça" usando os pontos acumulados!
                      </p>
                    </div>

                    <div style={{ padding: 12, background: 'var(--primary-soft)', borderRadius: 8 }}>
                      <strong>⚠️ Lembrete Importante:</strong>
                      <p style={{ margin: 0, color: 'var(--primary)', fontSize: 14 }}>
                        Não esqueça seu código de retirada! Ele é de uso único em todo o app pelo período de um dia e é sua garantia para pegar o pedido correto sem confusões na cantina!
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <button className="btn-outline" onClick={() => setIsHelpModalOpen(false)}>Fechar (Esc)</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastNotifier />

      {(currentUser && currentUser.role === 'student' && currentScreen !== 'login' && currentScreen !== 'cadastro' && currentScreen !== 'esqueci-senha' && currentScreen !== 'login-gestor') && (
        <ChatWidget 
          products={products} 
          canteens={canteens} 
          cart={cart} 
          points={currentUser?.points || 0} 
          coupons={allCoupons.filter(c => c.active === 1)}
          handleAddToCart={addToCart} 
          handleRemoveFromCart={handleRemoveFromCart}
          handleApplyCoupon={handleApplyCoupon}
        />
      )}
    </>
  );
}

function ScreenLogin({ goTo, setCurrentUser }: { goTo: (s: Screen) => void, setCurrentUser: (u: User) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [saveLogin, setSaveLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [savedAccounts, setSavedAccounts] = useState<{email: string, name: string, token: string, role?: string}[]>(() => {
    try {
      const stored = localStorage.getItem('cantinahub_saved_logins_student');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const doLogin = async (overrideEmail?: string, overridePwd?: string) => {
    const e = overrideEmail || email;
    const p = overridePwd || senha;
    if (!e || !p) {
      setError('Preencha todos os campos.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, senha: p })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (saveLogin && !overrideEmail) {
          const newSaved = [...savedAccounts.filter(a => a.email !== data.user.email), {
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            token: btoa(p)
          }];
          setSavedAccounts(newSaved);
          localStorage.setItem('cantinahub_saved_logins_student', JSON.stringify(newSaved));
        }

        setCurrentUser({ 
          canteen_id: data.user.canteen_id,
          id: data.user.id,
          name: data.user.name, 
          email: data.user.email,
          matricula: data.user.matricula,
          role: data.user.role,
          points: data.user.points || 0
        });
        if (data.user.role === 'superadmin') {
          goTo('superadmin');
        } else if (data.user.role === 'manager') {
          goTo('gestor');
        } else {
          goTo('cantinas');
        }
      } else {
        setError(data.error || 'Erro ao fazer login.');
        if (overrideEmail) {
           const newSaved = savedAccounts.filter(a => a.email !== overrideEmail);
           setSavedAccounts(newSaved);
           localStorage.setItem('cantinahub_saved_logins_student', JSON.stringify(newSaved));
        }
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
        <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}><img src="/logo.png" alt="Logo" style={{ height: 56, objectFit: 'contain' }} /><img src="/op.png" alt="OrderPoint" style={{ height: 40, objectFit: 'contain' }} /></div>
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
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '4px 0 16px 0', fontSize: 14 }}>
            <input 
              type="checkbox" 
              checked={saveLogin} 
              onChange={e => setSaveLogin(e.target.checked)} 
              style={{ width: 'auto', margin: 0 }}
            />
            Lembrar neste dispositivo
          </label>

          <button className="btn-orange btn-full" onClick={() => doLogin()} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        {savedAccounts.length > 0 && (
          <div style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
            <p className="auth-subtitle" style={{ marginBottom: 12 }}>Entrar rapidamente:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {savedAccounts.map(acc => (
                <div 
                  key={acc.email}
                  onClick={() => !loading && doLogin(acc.email, atob(acc.token))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
                    transition: 'background 0.2s', opacity: loading ? 0.6 : 1,
                    background: 'var(--bg-secondary)'
                  }}
                  className="saved-account-card"
                >
                  <div style={{ fontSize: 20 }}>{acc.role === 'superadmin' ? '👑' : acc.role === 'manager' ? '👨‍💼' : '👤'}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{acc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{acc.email}</div>
                  </div>
                  <button 
                    className="btn-outline btn-sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSaved = savedAccounts.filter(a => a.email !== acc.email);
                      setSavedAccounts(newSaved);
                      localStorage.setItem('cantinahub_saved_logins_student', JSON.stringify(newSaved));
                    }}
                    style={{ padding: '4px 8px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="auth-link" style={{ marginTop: 20 }}>Não tem conta? <span onClick={() => goTo('cadastro')}>Cadastre-se</span></div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  );
}

function ScreenSuperadmin({ goTo, currentUser, showToast, fetchCanteens, globalSettings, fetchGlobalSettings }: { goTo: (s: Screen) => void, currentUser: User | null, showToast: (msg: string) => void, fetchCanteens: () => void, globalSettings: Record<string, string>, fetchGlobalSettings: () => void }) {
  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
          <h2>Acesso Restrito</h2>
          <p>Apenas administradores do sistema podem acessar esta tela.</p>
          <button className="btn-orange" onClick={() => goTo('cantinas')} style={{ marginTop: 16 }}>Voltar ao Início</button>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'gerenciar_usuarios' | 'gerenciar_cantinas' | 'criar_cantina' | 'criar_conta' | 'configuracoes'>('gerenciar_usuarios');
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerSenha, setNewManagerSenha] = useState('');
  const [newManagerCanteen, setNewManagerCanteen] = useState<string>('');
  
  const [settingsMaintenance, setSettingsMaintenance] = useState(false);
  const [settingsWarning, setSettingsWarning] = useState('');

  useEffect(() => {
    if (globalSettings) {
      setSettingsMaintenance(globalSettings.global_maintenance === '1');
      setSettingsWarning(globalSettings.global_warning || '');
    }
  }, [globalSettings]);

  const saveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser?.id?.toString() || ''
        },
        body: JSON.stringify({
          global_maintenance: settingsMaintenance,
          global_warning: settingsWarning
        })
      });
      if (res.ok) {
        showToast('✅ Configurações globais salvas!');
        fetchGlobalSettings();
      } else {
        showToast('Erro ao salvar configurações.');
      }
    } catch (e) {
      showToast('Erro de conexão ao salvar.');
    }
  };
  const [newManagerRole, setNewManagerRole] = useState<'manager' | 'superadmin' | 'student'>('manager');
  const [newManagerMatricula, setNewManagerMatricula] = useState('');

  const [editingUser, setEditingUser] = useState<string | number | null>(null);
  const [editUserForm, setEditUserForm] = useState<Partial<User>>({});

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('todos');

  const [newCanteenName, setNewCanteenName] = useState('');
  const [newCanteenLocation, setNewCanteenLocation] = useState('');
  const [newCanteenDesc, setNewCanteenDesc] = useState('');
  const [newCanteenColor, setNewCanteenColor] = useState('#ffffff');
  const [newCanteenOpenTime, setNewCanteenOpenTime] = useState('08:00');
  const [newCanteenCloseTime, setNewCanteenCloseTime] = useState('18:00');
  const [newCanteenPointsEnabled, setNewCanteenPointsEnabled] = useState(true);

  const [editingCanteen, setEditingCanteen] = useState<string | number | null>(null);
  const [editCanteenForm, setEditCanteenForm] = useState<Partial<Canteen>>({});

  const [deletingUser, setDeletingUser] = useState<string | number | null>(null);
  const [deletingCanteen, setDeletingCanteen] = useState<string | number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [canteensRes, usersRes] = await Promise.all([
        fetch('/api/canteens', { headers: { 'X-User-Id': currentUser?.id?.toString() || '' }}),
        fetch('/api/users', { headers: { 'X-User-Id': currentUser?.id?.toString() || '' }})
      ]);
      if (canteensRes.ok) setCanteens(await canteensRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      fetchData();
    }
  }, [currentUser]);

  const handleCreateManager = async () => {
    if (!newManagerName || !newManagerEmail || !newManagerSenha) return showToast('Preencha os campos obrigatórios (Nome, E-mail, Senha)');
    if (newManagerRole === 'manager' && !newManagerCanteen) return showToast('Selecione a Cantina que o Gestor irá administrar');
    const res = await fetch('/api/users/manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
      body: JSON.stringify({ 
        name: newManagerName, 
        email: newManagerEmail, 
        senha: newManagerSenha, 
        canteen_id: newManagerCanteen,
        role: newManagerRole,
        matricula: newManagerMatricula
      })
    });
    if (res.ok) {
      setNewManagerName('');
      setNewManagerEmail('');
      setNewManagerSenha('');
      setNewManagerCanteen('');
      setNewManagerMatricula('');
      setNewManagerRole('manager');
      fetchData();
      showToast('Conta criada com sucesso!');
    } else {
      const data = await res.json();
      showToast(data.error || 'Erro ao criar conta');
    }
  };

  const handleUpdateUser = async (id: string | number) => {
    if (!editUserForm.name || !editUserForm.email) return showToast('Nome e e-mail são obrigatórios!');
    const res = await fetch(`/api/users/admin/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
      body: JSON.stringify(editUserForm)
    });
    if (res.ok) {
      setEditingUser(null);
      fetchData();
      showToast('Usuário atualizado com sucesso!');
    } else {
      const data = await res.json();
      showToast(data.error || 'Erro ao atualizar usuário');
    }
  };

  const handleDeleteUser = async (id: string | number) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': currentUser?.id?.toString() || '' }
    });
    setDeletingUser(null);
    if (res.ok) {
      showToast('Usuário apagado com sucesso!');
      fetchData();
    } else {
      showToast('Erro ao apagar usuário.');
    }
  };

  const handleCreateCanteen = async () => {
    if (!newCanteenName) return showToast('Nome da cantina é obrigatório');
    // Remove the equality restriction completely.
    const res = await fetch('/api/canteens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
      body: JSON.stringify({ 
        name: newCanteenName, 
        location: newCanteenLocation, 
        emoji: '',
        desc: newCanteenDesc,
        color: newCanteenColor,
        open_time: newCanteenOpenTime,
        close_time: newCanteenCloseTime,
        points_enabled: newCanteenPointsEnabled ? 1 : 0
      })
    });
    if (res.ok) {
      setNewCanteenName('');
      setNewCanteenLocation('');
      setNewCanteenDesc('');
      setNewCanteenColor('#ffffff');
      setNewCanteenOpenTime('08:00');
      setNewCanteenCloseTime('18:00');
      setNewCanteenPointsEnabled(true);
      fetchData();
      fetchCanteens(); // update app menus
      showToast('Cantina criada com sucesso!');
    } else {
      showToast('Erro ao criar cantina');
    }
  };

  const openEditCanteen = (c: Canteen) => {
    setEditingCanteen(c.id);
    setEditCanteenForm(c);
  };

  const handleUpdateCanteen = async (id: string | number) => {
    if (!editCanteenForm.name) return showToast('Nome da cantina é obrigatório');
    const res = await fetch(`/api/canteens/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
      body: JSON.stringify({ ...editCanteenForm })
    });
    if (res.ok) {
      setEditingCanteen(null);
      fetchData();
      fetchCanteens(); // update app menus
      showToast('Cantina atualizada com sucesso!');
    } else {
      showToast('Erro ao atualizar cantina');
    }
  };

  const handleDeleteCanteen = async (id: string | number) => {
    const res = await fetch(`/api/canteens/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': currentUser?.id?.toString() || '' }
    });
    setDeletingCanteen(null);
    if (res.ok) {
      showToast('Cantina apagada com sucesso!');
      fetchData();
      fetchCanteens();
    } else {
      const data = await res.json().catch(() => ({error: 'Erro desconhecido'}));
      showToast(data.error || 'Erro ao apagar cantina.');
    }
  };

  if (currentUser?.role !== 'superadmin') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        Acesso negado. Apenas superadmins podem ver esta página.
        <br/><button className="btn-outline" style={{ marginTop: 20 }} onClick={() => goTo('login')}>Voltar</button>
      </div>
    );
  }
  
  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div className="tag tag-orange">Acesso Restrito</div>
        <h2 style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>👑 Painel Superadmin</h2>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>Gerencie cantinas e contas de acesso ao sistema.</p>
      </div>

      <div className="superadmin-layout">
        <ScrollableRow wrapperClassName="superadmin-sidebar-wrapper" className="superadmin-sidebar" style={{ '--gradient-bg': 'var(--surface)' } as React.CSSProperties}>
          <button className={`superadmin-tab ${activeTab === 'gerenciar_usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('gerenciar_usuarios')}>👥 Gerenciar Usuários</button>
          <button className={`superadmin-tab ${activeTab === 'gerenciar_cantinas' ? 'active' : ''}`} onClick={() => setActiveTab('gerenciar_cantinas')}>🏪 Gerenciar Cantinas</button>
          <button className={`superadmin-tab ${activeTab === 'criar_cantina' ? 'active' : ''}`} onClick={() => setActiveTab('criar_cantina')}>➕ Criar Cantina</button>
          <button className={`superadmin-tab ${activeTab === 'criar_conta' ? 'active' : ''}`} onClick={() => setActiveTab('criar_conta')}>➕ Criar Gestor</button>
          <button className={`superadmin-tab ${activeTab === 'configuracoes' ? 'active' : ''}`} onClick={() => setActiveTab('configuracoes')}>⚙️ Configurações</button>
        </ScrollableRow>

        <div style={{ flex: 1, minWidth: 0 }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Carregando dados...</div>
      ) : (
        <>
          {activeTab === 'gerenciar_usuarios' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 'bold' }}>Lista de Usuários ({users.length})</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou e-mail..." 
                    value={userSearch} 
                    onChange={e => setUserSearch(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 14, minWidth: 200, flex: 1 }}
                  />
                  <select 
                    value={userRoleFilter} 
                    onChange={e => setUserRoleFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
                  >
                    <option value="todos">Todos</option>
                    <option value="student">Estudantes</option>
                    <option value="manager">Gestores</option>
                    <option value="superadmin">Superadmins</option>
                  </select>
                </div>
              </div>
                <div style={{ overflowX: 'auto', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>ID</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>NOME</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>E-MAIL</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>TIPO</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter(u => userRoleFilter === 'todos' || u.role === userRoleFilter)
                        .filter(u => userSearch === '' || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                        .sort((a,b) => b.id - a.id)
                        .map(user => (
                        <tr key={user.id} style={{ borderBottom: '1px solid var(--line)', background: editingUser === user.id ? 'var(--bg)' : 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontSize: 14 }}>{user.id}</td>
                          {editingUser === user.id ? (
                            <td colSpan={4} style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
                                <label className="form-label">Nome<input type="text" className="form-input" value={editUserForm.name || ''} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} /></label>
                                <label className="form-label">E-mail<input type="email" className="form-input" value={editUserForm.email || ''} onChange={e => setEditUserForm({...editUserForm, email: e.target.value})} /></label>
                                <label className="form-label">Tipo
                                  <select className="form-input" value={editUserForm.role || 'student'} onChange={e => setEditUserForm({...editUserForm, role: e.target.value as any})} >
                                    <option value="student">Estudante</option>
                                    <option value="manager">Gestor</option>
                                    <option value="superadmin">Superadmin</option>
                                  </select>
                                </label>
                                {editUserForm.role === 'manager' && (
                                  <label className="form-label">Cantina
                                    <select className="form-input" value={editUserForm.canteen_id || ''} onChange={e => setEditUserForm({...editUserForm, canteen_id: e.target.value})} >
                                      <option value="">Selecione...</option>
                                      {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </label>
                                )}
                                {editUserForm.role === 'student' && (
                                  <label className="form-label">Matrícula
                                    <input type="text" className="form-input" value={editUserForm.matricula || ''} onChange={e => setEditUserForm({...editUserForm, matricula: e.target.value})} />
                                  </label>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <button className="btn-success btn-sm" onClick={() => handleUpdateUser(user.id)}>Salvar</button>
                                <button className="btn-secondary btn-sm" onClick={() => setEditingUser(null)}>Cancelar</button>
                                <div style={{ flex: 1 }}></div>
                                {user.id !== currentUser?.id && deletingUser !== user.id && (
                                  <button className="btn-sm" style={{ background: 'transparent', color: 'var(--danger)', textDecoration: 'underline', border: 'none' }} onClick={() => setDeletingUser(user.id)}>Excluir Definitivamente</button>
                                )}
                                {deletingUser === user.id && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, color: 'var(--danger)' }}>Tem certeza?</span>
                                    <button className="btn-danger btn-sm" onClick={() => user.id && handleDeleteUser(user.id)}>Sim, excluir</button>
                                    <button className="btn-secondary btn-sm" onClick={() => setDeletingUser(null)}>Não</button>
                                  </div>
                                )}
                              </div>
                            </td>
                          ) : (
                            <>
                              <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500 }}>{user.name}</td>
                              <td style={{ padding: '12px 16px', fontSize: 14 }}>{user.email}</td>
                              <td style={{ padding: '12px 16px', fontSize: 14 }}>
                                {user.role === 'superadmin' ? <span className="tag" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>👑 Superadmin</span> : 
                                 user.role === 'manager' ? <span className="tag tag-orange">Gestor {user.canteen_id ? `(C${user.canteen_id})` : ''}</span> : 
                                 <span className="tag" style={{ background: 'var(--card)', color: 'var(--text)' }}>Estudante</span>}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: 14 }}>
                                <button className="btn-outline btn-sm" onClick={() => {
                                  setEditingUser(user.id);
                                  setEditUserForm(user);
                                }}>✏️ Editar</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          )}

          {activeTab === 'gerenciar_cantinas' && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Lista de Cantinas ({canteens.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {canteens.map(c => (
                    <div key={c.id} style={{ padding: 16, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--line)' }}>
                      {editingCanteen === c.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <h4 style={{ fontWeight: 'bold' }}>Editar Parâmetros da Cantina</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
                            <label className="form-label">Nome<input type="text" className="form-input" value={editCanteenForm.name || ''} onChange={e => setEditCanteenForm({...editCanteenForm, name: e.target.value})} /></label>
                            <label className="form-label">Localização<input type="text" className="form-input" value={editCanteenForm.location || ''} onChange={e => setEditCanteenForm({...editCanteenForm, location: e.target.value})} /></label>
                            <label className="form-label">Cor<input type="color" className="form-input" value={editCanteenForm.color || '#ffffff'} onChange={e => setEditCanteenForm({...editCanteenForm, color: e.target.value})} style={{ padding: 2, height: 44 }} /></label>
                            <label className="form-label">Abertura<input type="time" className="form-input" value={editCanteenForm.open_time || ''} onChange={e => setEditCanteenForm({...editCanteenForm, open_time: e.target.value})} /></label>
                            <label className="form-label">Fechamento<input type="time" className="form-input" value={editCanteenForm.close_time || ''} onChange={e => setEditCanteenForm({...editCanteenForm, close_time: e.target.value})} /></label>
                          </div>
                          <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, marginTop: 12 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', margin: 0 }}>
                              <input type="checkbox" checked={editCanteenForm.points_enabled === 1} onChange={e => setEditCanteenForm({...editCanteenForm, points_enabled: e.target.checked ? 1 : 0})} style={{ width: 18, height: 18 }} />
                              <span style={{ fontWeight: 500 }}>Programa de Pontos Ativo</span>
                            </label>
                            <p style={{ margin: '4px 0 0 30px', fontSize: 13, color: 'var(--muted)' }}>Alunos poderão acumular e resgatar pontos nesta cantina.</p>
                          </div>
                          <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, marginTop: 12 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', margin: 0 }}>
                              <input type="checkbox" checked={editCanteenForm.maintenance_mode === 1} onChange={e => setEditCanteenForm({...editCanteenForm, maintenance_mode: e.target.checked ? 1 : 0})} style={{ width: 18, height: 18 }} />
                              <span style={{ fontWeight: 500 }}>Modo Manutenção</span>
                            </label>
                            <p style={{ margin: '4px 0 0 30px', fontSize: 13, color: 'var(--muted)' }}>Bloqueia a compra de itens nesta cantina temporariamente.</p>
                          </div>
                          <label className="form-label" style={{ marginTop: 12 }}>Aviso Global
                            <textarea className="form-input" value={editCanteenForm.global_warning || ''} onChange={e => setEditCanteenForm({...editCanteenForm, global_warning: e.target.value})} rows={2} placeholder="Ex: Faltou energia..." />
                          </label>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button className="btn-success btn-sm" onClick={() => handleUpdateCanteen(c.id)}>Salvar Alterações</button>
                            <button className="btn-secondary btn-sm" onClick={() => setEditingCanteen(null)}>Cancelar</button>
                            <div style={{ flex: 1 }}></div>
                            {deletingCanteen !== c.id && (
                              <button className="btn-sm" style={{ background: 'transparent', color: 'var(--danger)', textDecoration: 'underline', border: 'none' }} onClick={() => setDeletingCanteen(c.id)}>Excluir Cantina</button>
                            )}
                            {deletingCanteen === c.id && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, color: 'var(--danger)' }}>Órfãos podem ser criados. Excluir?</span>
                                <button className="btn-danger btn-sm" onClick={() => c.id && handleDeleteCanteen(c.id)}>Sim, excluir</button>
                                <button className="btn-secondary btn-sm" onClick={() => setDeletingCanteen(null)}>Não</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div className="canteen-icon-bg" style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.color || '#eee', borderRadius: '50%', position: 'relative', overflow: 'hidden' }}>
                              {c.image_url ? (
                                <img src={c.image_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ position: 'relative', zIndex: 1, fontSize: 16, fontWeight: 'bold', color: '#333' }}>{c.name.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: 16 }}>{c.name} (ID: {c.id})</div>
                              <div style={{ color: 'var(--muted)', fontSize: 14 }}>{c.location || 'Sem localização descrita'} • {c.open_time} - {c.close_time}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-outline btn-sm" onClick={() => openEditCanteen(c)}>Editar Parâmetros</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
          )}

          {activeTab === 'criar_cantina' && (
            <div style={{ padding: 24, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Nova Cantina</h3>
              <div style={{ maxWidth: 600 }}>
                <label className="form-label">Nome
                  <input type="text" className="form-input" value={newCanteenName} onChange={e => setNewCanteenName(e.target.value)} />
                </label>
                <label className="form-label">Localização
                  <input type="text" className="form-input" value={newCanteenLocation} onChange={e => setNewCanteenLocation(e.target.value)} />
                </label>
                <label className="form-label">Cor (Hexadecimal)
                  <input type="color" className="form-input" value={newCanteenColor} onChange={e => setNewCanteenColor(e.target.value)} style={{ padding: 4, height: 44 }} />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12, marginBottom: 12 }}>
                  <label className="form-label">Abertura
                    <input type="time" className="form-input" value={newCanteenOpenTime} onChange={e => setNewCanteenOpenTime(e.target.value)} />
                  </label>
                  <label className="form-label">Fechamento
                    <input type="time" className="form-input" value={newCanteenCloseTime} onChange={e => setNewCanteenCloseTime(e.target.value)} />
                  </label>
                </div>
                <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={newCanteenPointsEnabled} onChange={e => setNewCanteenPointsEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
                    <span style={{ fontWeight: 500 }}>Programa de Pontos Ativo</span>
                  </label>
                  <p style={{ margin: '4px 0 0 30px', fontSize: 13, color: 'var(--muted)' }}>Alunos poderão acumular pontos nesta cantina e trocar por recompensas.</p>
                </div>
                <button className="btn-orange btn-full" onClick={handleCreateCanteen}>Criar Cantina</button>
              </div>
            </div>
          )}

          {activeTab === 'criar_conta' && (
            <div style={{ padding: 24, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Criar Nova Conta / Gestor</h3>
              <div style={{ maxWidth: 600 }}>
                <label className="form-label">Nome
                  <input type="text" className="form-input" value={newManagerName} onChange={e => setNewManagerName(e.target.value)} />
                </label>
                <label className="form-label">E-mail
                  <input type="email" className="form-input" value={newManagerEmail} onChange={e => setNewManagerEmail(e.target.value)} />
                </label>
                <label className="form-label" style={{ marginBottom: 4 }}>Senha
                  <input type="text" className="form-input" value={newManagerSenha} onChange={e => setNewManagerSenha(e.target.value)} />
                </label>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map(idx => (
                    <div key={idx} style={{ flex: 1, height: 4, borderRadius: 2, background: newManagerSenha.length > 0 && idx <= getPasswordStrength(newManagerSenha) ? ['#e5e7eb', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'][getPasswordStrength(newManagerSenha)] : '#e5e7eb', transition: 'background 0.3s' }}></div>
                  ))}
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: 12, color: newManagerSenha.length > 0 ? ['#e5e7eb', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'][getPasswordStrength(newManagerSenha)] : 'var(--muted)' }}>
                  {newManagerSenha.length > 0 ? ['Muito Fraca', 'Fraca', 'Razoável', 'Forte', 'Muito Forte'][getPasswordStrength(newManagerSenha)] : 'Use maiúsculas, minúsculas, números e símbolos'}
                </p>
                <label className="form-label">Tipo de Conta
                  <select className="form-input" value={newManagerRole} onChange={e => setNewManagerRole(e.target.value as any)}>
                    <option value="student">Estudante</option>
                    <option value="manager">Gestor</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </label>
                {newManagerRole === 'manager' && (
                  <label className="form-label">Cantina Vinculada
                    <select className="form-input" value={newManagerCanteen} onChange={e => setNewManagerCanteen(e.target.value)}>
                      <option value="">Selecione...</option>
                      {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                {newManagerRole === 'student' && (
                  <label className="form-label">Matrícula (opcional)
                    <input type="text" className="form-input" value={newManagerMatricula} onChange={e => setNewManagerMatricula(e.target.value)} />
                  </label>
                )}
                <button className="btn-orange btn-full" onClick={handleCreateManager}>Criar Conta</button>
              </div>
            </div>
          )}

          {activeTab === 'configuracoes' && (
            <div style={{ padding: 24, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Configurações Globais do HUB</h3>
              
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', marginBottom: 24 }}>
                <div className="card" style={{ padding: 16 }}>
                  <h4>🚧 Modo de Manutenção Global</h4>
                  <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, marginBottom: 16 }}>Bloqueia o login e o acesso para todos os alunos e gestores. Apenas superadmins conseguirão entrar no sistema.</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={settingsMaintenance} 
                      onChange={e => setSettingsMaintenance(e.target.checked)} 
                      style={{ width: 20, height: 20, accentColor: 'var(--orange)' }}
                    />
                    <span style={{ fontWeight: 600 }}>Ativar Modo Manutenção</span>
                  </label>
                </div>
                
                <div className="card" style={{ padding: 16 }}>
                  <h4>📢 Aviso Global da Universidade</h4>
                  <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8, marginBottom: 16 }}>Escreva um banner de aviso que aparecerá no topo da tela para todos os usuários logados no site inteiro (ex: Feriado na faculdade).</p>
                  <textarea 
                    value={settingsWarning}
                    onChange={e => setSettingsWarning(e.target.value)}
                    placeholder="Ex: Não haverá aulas e as cantinas estarão fechadas neste feriado."
                    rows={3}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <button className="btn-success" onClick={saveSettings}>Salvar Configurações Globais</button>
            </div>
          )}
        </>
      )}
      </div>
      </div>
    </div>
  );
}

function ScreenLoginGestor({ goTo, setCurrentUser, showToast }: { goTo: (s: Screen) => void, setCurrentUser: (u: User) => void, showToast: (msg: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customSenha, setCustomSenha] = useState('');
  const [saveLogin, setSaveLogin] = useState(false);

  const [savedAccounts, setSavedAccounts] = useState<{email: string, name: string, emoji: string, token: string}[]>(() => {
    try {
      const stored = localStorage.getItem('cantinahub_saved_logins_gestor');
      if (stored) return JSON.parse(stored);
      return [
        { email: 'central@facens.br', name: 'Cantina Central', emoji: '🍕', token: btoa('123456') },
        { email: 'blocob@facens.br', name: 'Cantina Bloco B', emoji: '🥗', token: btoa('123456') },
        { email: 'leste@facens.br', name: 'Cantina Leste', emoji: '☕', token: btoa('123456') },
        { email: 'sadmin@facens.br', name: 'Super Admin', emoji: '👑', token: btoa('224641') }
      ];
    } catch (e) {
      return [];
    }
  });

  const handleLoginResponse = (data: any, passwordUsed?: string) => {
      if (passwordUsed && saveLogin && !savedAccounts.some(a => a.email === data.user.email)) {
        const newSaved = [...savedAccounts, {
          email: data.user.email,
          name: data.user.name,
          emoji: data.user.role === 'superadmin' ? '👑' : '👨‍💼',
          token: btoa(passwordUsed)
        }];
        setSavedAccounts(newSaved);
        localStorage.setItem('cantinahub_saved_logins_gestor', JSON.stringify(newSaved));
      }

      if (data.user.role === 'superadmin') {
        setCurrentUser(data.user);
        goTo('superadmin');
      } else {
        setCurrentUser(data.user);
        goTo('gestor');
      }
  };

  const doAutoLogin = async (acc: typeof savedAccounts[0]) => {
    setLoading(true);
    setError(null);
    try {
      const decodedPassword = atob(acc.token);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, senha: decodedPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleLoginResponse(data, decodedPassword);
      } else {
        const errorMsg = data.error || 'Erro ao fazer login. Senha pode ter sido alterada.';
        setError(errorMsg);
        showToast(errorMsg);
        const newSaved = savedAccounts.filter(a => a.email !== acc.email);
        setSavedAccounts(newSaved);
        localStorage.setItem('cantinahub_saved_logins_gestor', JSON.stringify(newSaved));
      }
    } catch (e) {
      setError('Erro de conexão.');
      showToast('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const doManualLogin = async () => {
    if (!customEmail || !customSenha) {
      const msg = 'Preencha e-mail e senha.';
      setError(msg);
      showToast(msg);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: customEmail, senha: customSenha })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleLoginResponse(data, customSenha);
      } else {
        const errorMsg = data.error || 'Erro ao fazer login.';
        setError(errorMsg);
        showToast(errorMsg);
      }
    } catch (e) {
      setError('Erro de conexão.');
      showToast('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doManualLogin();
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}><img src="/logo.png" alt="Logo" style={{ height: 56, objectFit: 'contain' }} /><img src="/op.png" alt="OrderPoint" style={{ height: 40, objectFit: 'contain' }} /></div>
        <div className="tag tag-orange">Acesso Restrito</div>
        
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: 12 }}>E-mail
            <input 
              type="email" 
              placeholder="central@facens.br" 
              value={customEmail} 
              onChange={e => setCustomEmail(e.target.value)} 
              onKeyDown={handleKeyDown}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 16 }}>Senha
            <input 
              type="password" 
              placeholder="••••••" 
              value={customSenha} 
              onChange={e => setCustomSenha(e.target.value)} 
              onKeyDown={handleKeyDown}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '4px 0 16px 0', fontSize: 14 }}>
            <input 
              type="checkbox" 
              checked={saveLogin} 
              onChange={e => setSaveLogin(e.target.checked)} 
              style={{ width: 'auto', margin: 0 }}
            />
            Lembrar neste dispositivo
          </label>
          <button className="btn-orange btn-full" onClick={doManualLogin} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        {savedAccounts.length > 0 && (
          <div style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
            <p className="auth-subtitle" style={{ marginBottom: 12 }}>Entrar rapidamente:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {savedAccounts.map(acc => (
                <div 
                  key={acc.email}
                  onClick={() => !loading && doAutoLogin(acc)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                    border: '1px solid var(--line)', borderRadius: 12, cursor: 'pointer',
                    transition: 'background 0.2s', opacity: loading ? 0.6 : 1
                  }}
                  className="saved-account-card"
                >
                  <div style={{ fontSize: 24 }}>{acc.emoji}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{acc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{acc.email}</div>
                  </div>
                  <button 
                    className="btn-outline btn-sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSaved = savedAccounts.filter(a => a.email !== acc.email);
                      setSavedAccounts(newSaved);
                      localStorage.setItem('cantinahub_saved_logins_gestor', JSON.stringify(newSaved));
                    }}
                    style={{ padding: '4px 8px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="auth-link" style={{ marginTop: 24 }}>
          <span onClick={() => goTo('login')}>← Voltar para login de aluno</span>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  );
}

function getPasswordStrength(pass: string) {
  let score = 0;
  if (/[A-Z]/.test(pass)) score++;
  if (/[a-z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
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
  const [devMsg, setDevMsg] = useState<string | null>(null);

  const pwdScore = getPasswordStrength(senha);
  const strengthColors = ['#e5e7eb', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const strengthLabels = ['Muito Fraca', 'Fraca', 'Razoável', 'Forte', 'Muito Forte'];

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
    if (nome.trim().split(/\s+/).length < 2) {
      setError('Por favor, insira nome e sobrenome.');
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
    if (pwdScore < 4) {
      setError('A senha deve conter ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial.');
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
        if (data.message) {
          globalShowToast(data.message);
        }
        setDevMsg(null);
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
        <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}><img src="/logo.png" alt="Logo" style={{ height: 56, objectFit: 'contain' }} /><img src="/op.png" alt="OrderPoint" style={{ height: 40, objectFit: 'contain' }} /></div>
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
              <label style={{ marginBottom: 4 }}>Senha
                <input type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={handleKeyDownForm} />
              </label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map(idx => (
                  <div key={idx} style={{ flex: 1, height: 4, borderRadius: 2, background: senha.length > 0 && idx <= pwdScore ? strengthColors[pwdScore] : '#e5e7eb', transition: 'background 0.3s' }}></div>
                ))}
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: senha.length > 0 ? strengthColors[pwdScore] : 'var(--muted)' }}>
                {senha.length > 0 ? strengthLabels[pwdScore] : 'Use maiúsculas, minúsculas, números e símbolos'}
              </p>
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
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>Se não encontrar na caixa de entrada, verifique também a sua caixa de <strong>Spam</strong> ou Lixo Eletrônico.</div>
              </div>
              {devMsg && (
                <div className="alert alert-warning" style={{ marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                  {devMsg}
                </div>
              )}
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
              <button className="btn-secondary btn-full" style={{ marginTop: 8 }} onClick={doRequestCode} disabled={loading || success}>
                {loading ? 'Aguarde...' : 'Reenviar código'}
              </button>
              <button className="btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => setStep('form')} disabled={loading || success}>
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
  const [devMsg, setDevMsg] = useState<string | null>(null);

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
        if (data.message) {
          globalShowToast(data.message);
        }
        setDevMsg(null);
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
        <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}><img src="/logo.png" alt="Logo" style={{ height: 56, objectFit: 'contain' }} /><img src="/op.png" alt="OrderPoint" style={{ height: 40, objectFit: 'contain' }} /></div>
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
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>Se não encontrar na caixa de entrada, verifique também a sua caixa de <strong>Spam</strong> ou Lixo Eletrônico.</div>
              </div>
              {devMsg && (
                <div className="alert alert-warning" style={{ marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                  {devMsg}
                </div>
              )}
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
              <button className="btn-secondary btn-full" style={{ marginTop: 8 }} onClick={doRequestCode} disabled={loading || success}>
                {loading ? 'Aguarde...' : 'Reenviar código'}
              </button>
              <button className="btn-outline btn-full" style={{ marginTop: 8 }} onClick={() => setStep('email')} disabled={loading || success}>
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

export const isCanteenOpen = (canteen: Canteen) => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [openH, openM] = canteen.open_time.split(':').map(Number);
  const [closeH, closeM] = canteen.close_time.split(':').map(Number);
  const openTime = openH * 60 + openM;
  const closeTime = closeH * 60 + closeM;

  if (openTime === closeTime) {
    return true; // 24 hours open
  }

  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }
  return currentTime >= openTime && currentTime <= closeTime;
};

function ScreenCantinas({ goTo, canteens, setSelectedCanteen, currentUser }: { goTo: (s: Screen) => void, canteens: Canteen[], setSelectedCanteen: (c: Canteen) => void, currentUser: User | null }) {
  const visibleCanteens = currentUser?.role === 'manager' && currentUser.canteen_id 
    ? canteens.filter(c => String(c.id) === String(currentUser.canteen_id))
    : canteens;

  return (
    <div className="page">
      <div className="hero">
        <h1>Escolha uma Cantina 🏪</h1>
        <p>Selecione a cantina onde deseja fazer seu pedido</p>
      </div>
      <div className="cantinas-grid">
        {visibleCanteens.map(canteen => {
          const isOpen = isCanteenOpen(canteen);
          const isMaintenance = canteen.maintenance_mode === 1;
          return (
            <div 
              key={canteen.id} 
              className="cantina-card" 
              style={{ opacity: isOpen || isMaintenance ? 1 : 0.6, cursor: isOpen || isMaintenance ? 'pointer' : 'not-allowed', position: 'relative' }}
              onClick={() => {
                if (isOpen || isMaintenance) {
                  setSelectedCanteen(canteen);
                  goTo('catalogo');
                }
              }}
            >
              {isMaintenance && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 'bold', padding: '4px 8px', borderRadius: 4, zIndex: 2 }}>
                  MANUTENÇÃO
                </div>
              )}
              {canteen.image_url ? (
                <img className="cantina-img" src={canteen.image_url} alt={canteen.name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '16px 16px 0 0', background: canteen.color }} />
              ) : (
                <div className="cantina-img" style={{ background: canteen.color || '#eee', width: '100%', height: 120, borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 36, fontWeight: 'bold', color: '#1f2937' }}>{canteen.name.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
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
                    {' '}· {canteen.open_time === canteen.close_time ? '24 Horas' : (isOpen ? `Fecha às ${canteen.close_time}` : `Abre às ${canteen.open_time}`)}
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

function ScreenCatalogo({ goTo, addToCart, products, selectedCanteen, categories, tags, currentUser, cart, showToast }: { goTo: (s: Screen) => void, addToCart: (p: Product) => void, products: Product[], selectedCanteen: Canteen | null, categories: Category[], tags: Tag[], currentUser: User | null, cart: CartItem[], showToast: (msg: string) => void }) {
  const [activeCat, setActiveCat] = useState('todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addedProductId, setAddedProductId] = useState<number | null>(null);

  const activeProducts = products.filter(p => p.active === 1 && (!selectedCanteen || String(p.canteen_id || '1') === String(selectedCanteen.id)));
  const filteredProducts = activeCat === 'todos' ? activeProducts : activeProducts.filter(p => p.cat === activeCat);

  const points = currentUser?.points || 0;
  const currentRewardPointsInCart = cart ? cart.reduce((sum, item) => sum + (item.isReward && item.points_price ? item.points_price * item.qty : 0), 0) : 0;

  const handleAddToCart = (p: Product) => {
    if (selectedCanteen?.maintenance_mode === 1) {
      showToast('⚠️ A cantina está em modo de manutenção e não está aceitando pedidos no momento.');
      return;
    }
    addToCart(p);
    setAddedProductId(p.id);
    setTimeout(() => setAddedProductId(null), 500);
  };

  const handleAddToCartWithPoints = (p: Product) => {
    if (selectedCanteen?.maintenance_mode === 1) {
      showToast('⚠️ A cantina está em modo de manutenção e não está aceitando pedidos no momento.');
      return;
    }
    if (!currentUser?.id) return;
    if (points - currentRewardPointsInCart < (p.points_price || 0)) {
      showToast('⚠️ Pontos insuficientes para adicionar mais este item!');
      return;
    }
    
    addToCart({ ...p, price: 0, isReward: true, points_price: p.points_price });
    setAddedProductId(p.id);
    setTimeout(() => setAddedProductId(null), 500);
    showToast(`✅ ${p.name} adicionado ao carrinho usando pontos!`);
  };

  return (
    <div className="page">
      {selectedCanteen?.global_warning && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⚠️ <strong>Aviso da Cantina:</strong> {selectedCanteen.global_warning}
        </div>
      )}
      {selectedCanteen?.maintenance_mode === 1 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ⛔ <strong>Modo Manutenção:</strong> Esta cantina não está aceitando novos pedidos temporariamente.
        </div>
      )}
      <div className="catalog-header">
        <div>
          <div className="tag tag-orange">{selectedCanteen?.name || 'Cantina Central'}</div>
          <h1 style={{ marginTop: 6 }}>Cardápio 🍽️</h1>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => goTo('cantinas')}>← Trocar cantina</button>
      </div>
      <div className="category-tabs">
        <div className={`cat-tab ${activeCat === 'todos' ? 'active' : ''}`} onClick={() => setActiveCat('todos')}>Todos</div>
        {categories.filter(c => String(c.canteen_id || '1') === String(selectedCanteen?.id || '1')).map(cat => (
          <div key={cat.id} className={`cat-tab ${activeCat === cat.name ? 'active' : ''}`} onClick={() => setActiveCat(cat.name)}>
            {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
          </div>
        ))}
      </div>
      <div className="products-grid">
        <AnimatePresence>
          {filteredProducts.map(p => (
            <motion.div 
              className="product-card" 
              key={p.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, ...(addedProductId === p.id ? { scale: [1, 1.05, 1], borderColor: ['var(--line)', '#f97316', 'var(--line)'] } : {}) }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
            >
            <LazyMedia 
              className="product-emoji" 
              onClick={() => setSelectedProduct(p)}
              style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Ver detalhes"
              emoji={p.emoji}
              imageUrl={p.image_url}
              alt={p.name}
            />
            <div className="product-info">
              <div className="product-name">{p.name}</div>
              <div className="product-desc">{p.desc}</div>
              {p.tags && p.tags !== '[]' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 12 }}>
                  {(() => {
                    try {
                      const tagIds = JSON.parse(p.tags) as number[];
                      return tagIds.map(id => {
                        const t = tags.find(tag => tag.id === id);
                        if (!t) return null;
                        return (
                          <span key={id} style={{ 
                            background: t.color, 
                            color: '#ffffff', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            fontWeight: 600,
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            border: '1px solid rgba(0,0,0,0.1)'
                          }}>
                            {t.name}
                          </span>
                        );
                      });
                    } catch (e) { return null; }
                  })()}
                </div>
              )}
              <div className="product-footer" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="product-price">R$ {p.price.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button 
                    className="btn-orange btn-sm" 
                    onClick={() => handleAddToCart(p)}
                    disabled={p.stock <= 0}
                    style={{ 
                      opacity: p.stock <= 0 ? 0.5 : 1, 
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                      transform: addedProductId === p.id ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: addedProductId === p.id ? '0 0 20px rgba(249, 115, 22, 0.6), 0 0 10px rgba(249, 115, 22, 0.4)' : 'none',
                      backgroundColor: addedProductId === p.id ? '#ea580c' : 'var(--orange)',
                      width: '100%',
                      padding: '10px'
                    }}
                  >
                    {addedProductId === p.id ? '✓ Adicionado' : (p.stock <= 0 ? 'Esgotado' : '+ Adicionar')}
                  </button>
                  {p.points_price && p.points_price > 0 ? (
                    <button 
                      className="btn-outline btn-sm" 
                      onClick={() => handleAddToCartWithPoints(p)}
                      disabled={p.stock <= 0}
                      style={{ 
                        opacity: p.stock <= 0 || points - currentRewardPointsInCart < p.points_price ? 0.5 : 1,
                        borderColor: 'var(--success)',
                        color: 'var(--success)',
                        width: '100%',
                        padding: '10px'
                      }}
                      title={`Resgatar usando ${p.points_price} pontos`}
                    >
                      🎟️ {p.points_price} PTS
                    </button>
                  ) : (
                    <button className="btn-outline btn-sm" style={{ visibility: 'hidden', pointerEvents: 'none', padding: '10px' }} aria-hidden="true">
                      &nbsp;
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
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
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.05)',
                overflow: 'hidden'
              }}>
                <LazyMedia emoji={selectedProduct.emoji} imageUrl={selectedProduct.image_url} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              
              <h2 style={{ margin: '0 0 8px 0', fontSize: 24, color: 'var(--text)' }}>{selectedProduct.name}</h2>
              
              <div className="tag tag-orange" style={{ marginBottom: 16 }}>
                R$ {selectedProduct.price.toFixed(2).replace('.', ',')}
              </div>
              
              <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.5, margin: '0 0 24px 0' }}>
                {selectedProduct.desc}
              </p>

              {selectedProduct.tags && selectedProduct.tags !== '[]' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
                  {(() => {
                    try {
                      const tagIds = JSON.parse(selectedProduct.tags) as number[];
                      return tagIds.map(id => {
                        const t = tags.find(tag => tag.id === id);
                        if (!t) return null;
                        return (
                          <span key={id} style={{ 
                            background: t.color, 
                            color: '#ffffff', 
                            padding: '4px 12px', 
                            borderRadius: '16px', 
                            fontSize: '13px',
                            fontWeight: 600,
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            border: '1px solid rgba(0,0,0,0.1)'
                          }}>
                            {t.name}
                          </span>
                        );
                      });
                    } catch (e) { return null; }
                  })()}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexDirection: 'column' }}>
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
                {selectedProduct.points_price && selectedProduct.points_price > 0 && (
                  <button 
                    className="btn-outline" 
                    style={{ 
                      flex: 1, 
                      padding: '12px 24px', 
                      fontSize: 16, 
                      borderColor: 'var(--success)', 
                      color: 'var(--success)',
                      opacity: selectedProduct.stock <= 0 || points - currentRewardPointsInCart < selectedProduct.points_price ? 0.5 : 1
                    }}
                    onClick={() => {
                      handleAddToCartWithPoints(selectedProduct);
                      setTimeout(() => setSelectedProduct(null), 500);
                    }}
                    disabled={selectedProduct.stock <= 0}
                  >
                    🎟️ Usar {selectedProduct.points_price} Pontos
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScreenCarrinho({ goBack, cart, changeQty, clearCart, finalizarPedido, isSubmitting, couponCodeState, setCouponCodeState, handleApplyCoupon, appliedCoupon, couponError, setCouponError, selectedCanteen, products }: { goBack: () => void, cart: CartItem[], changeQty: (i: number, d: number) => void, clearCart: () => void, finalizarPedido: () => void, isSubmitting: boolean, couponCodeState: string, setCouponCodeState: (s: string) => void, handleApplyCoupon: (c: string) => void, appliedCoupon: any, couponError: string, setCouponError: (e: string) => void, selectedCanteen: Canteen | null, products: Product[] }) {
  const isMaintenanceMode = selectedCanteen?.maintenance_mode === 1;
  const [confirmClear, setConfirmClear] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalPoints = cart.reduce((sum, item) => sum + (item.isReward && item.points_price ? item.points_price * item.qty : 0), 0);
  
  let discountAmount = 0;
  const applicableTotal = appliedCoupon ? cart.filter(item => (String(item.canteen_id) === String(appliedCoupon.canteen_id) || (!item.canteen_id && String(appliedCoupon.canteen_id) === '1')) && !item.isReward).reduce((sum, i) => sum + i.price * i.qty, 0) : 0;
  const isCouponValid = appliedCoupon && applicableTotal >= (appliedCoupon.min_value || 0) && applicableTotal > 0;
  
  if (isCouponValid) {
    discountAmount = applicableTotal * (appliedCoupon.discount_pct / 100);
  }
  const finalTotal = Math.max(0, total - discountAmount);
  const pointsEarned = selectedCanteen?.points_enabled !== 0 ? Math.floor(finalTotal) : 0;

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
              <EmptyState title="Seu carrinho está vazio" description="Que tal adicionar alguns lanches da cantina?" emoji="🛒" />
            ) : (
              cart.map((item, idx) => (
                <div className="cart-item" key={`${idx}-${item.name}`}>
                  <div className="cart-emoji" style={{ overflow: 'hidden', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LazyMedia emoji={item.emoji} imageUrl={(products.find(p => p.name === item.name) || {}).image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">
                      {item.price === 0 ? <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{item.points_price} PTS</span> : `R$ ${item.price.toFixed(2).replace('.', ',')}`}
                    </div>
                  </div>
                  <div className="qty-ctrl">
                    <button className="qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                    <strong>{item.qty}</strong>
                    {!item.isReward ? (
                      <button className="qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                    ) : (
                      <div style={{ width: 28 }}></div>
                    )}
                  </div>
                  <strong style={{ minWidth: 64, textAlign: 'right', color: 'var(--success)' }}>
                    {item.price === 0 ? (item.points_price ? `${item.points_price * item.qty} PTS` : 'Grátis') : `R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}`}
                  </strong>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn-secondary btn-sm" onClick={goBack}>← Voltar</button>
            {!confirmClear ? (
              <button className="btn-danger btn-sm" onClick={() => setConfirmClear(true)}>🗑 Esvaziar carrinho</button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--danger-soft)', padding: '4px 8px', borderRadius: 8 }}>
                <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 'bold' }}>Tem certeza?</span>
                <button className="btn-danger btn-sm" onClick={() => { clearCart(); setConfirmClear(false); }}>Sim</button>
                <button className="btn-secondary btn-sm" onClick={() => setConfirmClear(false)}>Não</button>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="card order-summary">
            <h3>Resumo do Pedido</h3>
            <div>
              {cart.map((item, idx) => (
                <div className="summary-line" key={`${idx}-${item.name}`}>
                  <span>{item.name} × {item.qty}</span>
                  <span>{item.price === 0 ? (item.points_price ? `${item.points_price * item.qty} PTS` : 'Grátis') : `R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}`}</span>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: 24, padding: '16px', background: 'var(--background)', borderRadius: '12px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Cupom de Desconto</p>
              
              {!appliedCoupon ? (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="text" 
                      value={couponCodeState} 
                      onChange={e => {
                        setCouponCodeState(e.target.value.toUpperCase());
                        if (couponError) setCouponError('');
                      }}
                      placeholder="Seu cupom..."
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: `1px solid ${couponError ? 'red' : '#e2e8f0'}`, outline: 'none' }}
                    />
                    <button className="btn-outline btn-sm" onClick={() => handleApplyCoupon(couponCodeState)}>Aplicar</button>
                  </div>
                  {couponError && (
                     <p style={{ marginTop: 8, fontSize: 13, color: 'red', display: 'flex', alignItems: 'center' }}>
                        ❌ {couponError}
                     </p>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isCouponValid ? '#ecfdf5' : '#fee2e2', borderRadius: '8px', border: `1px solid ${isCouponValid ? '#a7f3d0' : '#fca5a5'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🎟️</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: isCouponValid ? '#065f46' : '#991b1b', margin: 0 }}>{appliedCoupon.code}</p>
                      {isCouponValid ? (
                        <p style={{ fontSize: 13, color: '#059669', margin: 0 }}>{appliedCoupon.discount_pct}% OFF aplicado!</p>
                      ) : (
                        <p style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>
                           Valor mínimo: R$ {(appliedCoupon.min_value || 0).toFixed(2).replace('.', ',')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button className="btn-outline btn-sm" style={{ borderColor: 'transparent', color: '#ef4444', padding: '4px 8px' }} onClick={() => handleApplyCoupon('')}>Remover</button>
                </div>
              )}
            </div>

            <div style={{ marginTop: '24px', borderTop: '2px dashed #e2e8f0', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--muted)' }}>
                <span>Subtotal</span>
                <span>R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
              {isCouponValid && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--success)', fontWeight: 500 }}>
                  <span>Desconto</span>
                  <span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="summary-total" style={{ marginTop: '8px', borderTop: 'none', paddingTop: 0 }}>
                <span>Total</span>
                <span style={{ color: 'var(--success)' }}>R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
            
            {totalPoints > 0 && (
              <div style={{ marginTop: '16px', borderTop: '2px dashed #e2e8f0', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--muted)' }}>
                  <span>Subtotal em Pontos</span>
                  <span><span style={{ color: 'var(--orange)', fontWeight: 600 }}>{totalPoints}</span> pts</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: 'var(--orange)' }}>
                  <span>Total de Pontos a deduzir</span>
                  <span>- {totalPoints} pts</span>
                </div>
              </div>
            )}
            
            {isMaintenanceMode && (
              <div style={{ marginTop: 16, background: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309', padding: 12, borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
                ⛔ <strong>A cantina está em manutenção.</strong><br/>Não é possível finalizar pedidos no momento.
              </div>
            )}

            {pointsEarned > 0 && !isMaintenanceMode && (
              <div style={{ marginTop: 16, background: 'var(--card)', border: '1px solid var(--orange)', color: 'var(--orange)', padding: 12, borderRadius: 8, fontSize: 13, textAlign: 'center', fontWeight: 'bold' }}>
                ⭐️ Você ganhará +{pointsEarned} pontos com esta compra!
              </div>
            )}

            {!isMaintenanceMode && finalTotal > 0 && (
              <div style={{ marginTop: 16, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E3A8A', padding: 12, borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
                ℹ️ <strong>Sistema em Fase de Testes</strong><br/>Os pagamentos são apenas simulados. Nenhuma cobrança real será efetuada no seu cartão.
              </div>
            )}
            
            <button 
              className="btn-orange btn-full" 
              style={{ marginTop: 20 }} 
              onClick={finalizarPedido} 
              disabled={isMaintenanceMode || isSubmitting}
            >
              {isSubmitting ? 'Finalizando...' : '✅ Finalizar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenConfirmacao({ goTo, orderCode, confirmedOrders }: { goTo: (s: Screen) => void, orderCode: string, confirmedOrders?: { code: string, canteenName: string, checkoutUrl?: string }[] }) {
  const isMultiple = orderCode.includes(',');
  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <div className="tag tag-success">{isMultiple ? 'Pedidos Confirmados!' : 'Pedido Confirmado!'}</div>
        <h2 style={{ margin: '16px 0 8px' }}>{isMultiple ? 'Seus pedidos foram enviados' : 'Seu pedido foi enviado para a cantina'}</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 20 }}>{isMultiple ? 'Apresente os códigos abaixo na hora da retirada' : 'Apresente o QR Code abaixo na hora da retirada'}</p>
        
        {confirmedOrders && confirmedOrders.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
            {confirmedOrders.map((o, i) => (
              <div key={i} style={{ padding: '16px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '8px' }}>{o.canteenName}</div>
                <div style={{ fontSize: 22, fontWeight: 'bold', letterSpacing: 4, color: 'var(--orange)' }}>
                  {o.code || 'PENDENTE'}
                </div>
                {o.checkoutUrl && (
                  <a href={o.checkoutUrl} target="_blank" className="btn-full" style={{ display: 'inline-block', marginTop: 12, padding: '12px', background: '#635BFF', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 'bold' }}>
                    💳 Pagar com Stripe
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="qr-box">📱</div>
            <div style={{ margin: '16px 0', fontSize: 22, fontWeight: 'bold', letterSpacing: 4, color: 'var(--orange)' }}>
              {orderCode}
            </div>
          </>
        )}

        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
          {isMultiple ? 'Guarde estes códigos — eles são únicos para os seus pedidos' : 'Guarde este código — ele é único para o seu pedido'}
        </p>
        <button className="btn-orange btn-full" onClick={() => goTo(isMultiple ? 'meus-pedidos' : 'status')}>
          📍 {isMultiple ? 'Acompanhar Meus Pedidos' : 'Acompanhar Status do Pedido'}
        </button>
      </div>
    </div>
  );
}

function ScreenStatus({ goTo, orderCode }: { goTo: (s: Screen) => void, orderCode: string }) {
  const [status, setStatus] = useState<'pagamento_pendente' | 'aguardando' | 'preparo' | 'pronto' | 'retirado' | 'cancelado'>('aguardando');
  const [orderInfo, setOrderInfo] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderCode) return;
    
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${orderCode}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          setOrderInfo(data);
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
        <p>Código de retirada: <strong style={{ color: 'var(--orange)' }}>{orderCode}</strong></p>
      </div>
      <div className="card">
        {status === 'cancelado' ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>❌</div>
            <h3 style={{ color: 'var(--danger)' }}>Pedido Cancelado</h3>
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>Seu pedido foi cancelado pela cantina.</p>
            {orderInfo?.cancel_reason && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 8, textAlign: 'left' }}>
                <strong>Motivo:</strong> {orderInfo.cancel_reason}
              </div>
            )}
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
            <div className={`step ${status === 'pagamento_pendente' ? 'active' : 'done'}`}>
              <div className="step-icon">{status === 'pagamento_pendente' ? '💳' : '✓'}</div>
              <div className="step-text">
                <div className="step-label">Pagamento</div>
                <div className="step-sublabel">{status === 'pagamento_pendente' ? 'Aguardando pagamento' : 'Pagamento confirmado'}</div>
              </div>
            </div>
            <div className={`step ${status === 'aguardando' ? 'active' : (status === 'pagamento_pendente' ? '' : 'done')}`}>
              <div className="step-icon">{status === 'aguardando' ? '⏳' : (status === 'pagamento_pendente' ? '⏳' : '✓')}</div>
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

function ScreenMeusPedidos({ goTo, currentUser, setOrderCode, showToast, fetchCanteens, canteens }: { goTo: (s: Screen) => void, currentUser: User | null, setOrderCode: (c: string) => void, showToast: (msg: string) => void, fetchCanteens: () => void, canteens: Canteen[] }) {
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
    return OrderStatusFactory.createStrategy(status).getText();
  };

  const getStatusColor = (status: string) => {
    return OrderStatusFactory.createStrategy(status).getStyles();
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
            <EmptyState title="Nenhum pedido" description="Você ainda não fez nenhum pedido no OrderPoint." emoji="📦" />
            <button className="btn-orange" style={{ marginTop: 16 }} onClick={() => goTo('cantinas')}>Fazer meu primeiro pedido</button>
          </div>
        ) : (
          myOrders.map(order => {
            const items: CartItem[] = JSON.parse(order.items);
            const itemsText = items.map(i => `${i.qty}x ${i.name}`).join(', ');
            const orderTime = formatBrazilTime(order.created_at);
            const orderDateFormatted = formatBrazilDate(order.created_at);
            const canteenName = canteens.find(c => Number(c.id) === Number(order.canteen_id))?.name || 'Cantina';
            
            return (
              <div className="order-card" key={order.id}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="order-id">
                    {order.code ? `Pedido ${order.code}` : 'Pedido Pendente'} <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 'normal', marginLeft: 8 }}>· {canteenName}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 'normal', display: 'block', marginTop: 4 }}>📅 {orderDateFormatted} às {orderTime}</span>
                  </div>
                  <div className="order-meta" style={{ marginBottom: 4 }}>{itemsText}</div>
                  <div style={{ fontWeight: 600 }}>Total: R$ {order.total.toFixed(2).replace('.', ',')}</div>
                </div>
                <div className="order-actions-user" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <span className="tag" style={getStatusColor(order.status)}>{getStatusText(order.status)}</span>
                    {order.status !== 'retirado' && order.status !== 'cancelado' && order.code && (
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
                {order.status === 'cancelado' && order.cancel_reason && (
                  <div style={{ padding: 12, background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 8, fontSize: 14 }}>
                    <strong>Motivo do cancelamento:</strong> {order.cancel_reason}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DashboardView({ orders, myCanteen }: { orders: Order[], myCanteen: Canteen | null }) {
  const [revenuePeriod, setRevenuePeriod] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [productPeriod, setProductPeriod] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [leastSoldPeriod, setLeastSoldPeriod] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [hourlyPeriod, setHourlyPeriod] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [weekdayPeriod, setWeekdayPeriod] = useState<'semana' | 'mes' | 'semestre' | 'ano'>('mes');
  const [cardRevenuePeriod, setCardRevenuePeriod] = useState<'anual' | 'semestral'>('anual');

  const activeOrders = orders.filter(o => (o.status === 'retirado' || o.status === 'pronto') && String(o.canteen_id || '1') === String(myCanteen?.id));
  const now = new Date();

  const getOrderDate = (created_at: string | number) => {
    return typeof created_at === 'number' ? new Date(created_at) : new Date(created_at.replace(' ', 'T') + (created_at.includes('Z') ? '' : 'Z'));
  };

  const getBrazilDateString = (d: Date) => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  };

  const getBrazilHour = (d: Date) => {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(d));
  };

  const getBrazilWeekday = (d: Date) => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(d);
    const map: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    return map[wd] ?? d.getDay();
  };

  const filterByPeriod = (orderDateStr: string | number, period: 'dia' | 'semana' | 'mes' | 'semestre' | 'ano') => {
    const orderDate = getOrderDate(orderDateStr);
    const nowLocal = new Date();
    const diffTime = nowLocal.getTime() - orderDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (period === 'dia') return diffDays <= 1;
    if (period === 'semana') return diffDays <= 7;
    if (period === 'mes') return diffDays <= 30;
    if (period === 'semestre') return diffDays <= 180;
    return diffDays <= 365;
  };

  const todayStr = getBrazilDateString(now);
  const todayOrders = activeOrders.filter(o => getBrazilDateString(getOrderDate(o.created_at)) === todayStr);
  const todayRevenue = todayOrders.reduce((acc, o) => acc + o.total, 0);

  const cardOrders = activeOrders.filter(o => filterByPeriod(o.created_at, cardRevenuePeriod === 'anual' ? 'ano' : 'semestre'));
  const cardRevenue = cardOrders.reduce((acc, o) => acc + o.total, 0);

  // Revenue Chart Data
  const groupedRevenue: Record<string, number> = {};
  const revenueOrders = activeOrders.filter(o => filterByPeriod(o.created_at, revenuePeriod));

  revenueOrders.forEach(o => {
    const day = getBrazilDateString(getOrderDate(o.created_at));
    groupedRevenue[day] = (groupedRevenue[day] || 0) + o.total;
  });

  
  const lineChartData = Object.keys(groupedRevenue).sort().map(date => ({
    date: date.substring(5).split('-').reverse().join('/'),
    receita: Number(groupedRevenue[date].toFixed(2))
  }));

  // Products Chart Data
  const productCountPeriod: Record<string, number> = {};
  const productOrders = activeOrders.filter(o => filterByPeriod(o.created_at, productPeriod));
  productOrders.forEach(o => {
    try {
      const items: CartItem[] = JSON.parse(o.items);
      items.forEach(i => {
        productCountPeriod[i.name] = (productCountPeriod[i.name] || 0) + i.qty;
      });
    } catch(e) {}
  });

  const barChartData = Object.entries(productCountPeriod)
    .map(([name, qty]) => ({ name, quantidade: qty }))
    .sort((a,b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // Least Sold Products Chart Data
  const leastSoldProductCount: Record<string, number> = {};
  const leastSoldOrders = activeOrders.filter(o => filterByPeriod(o.created_at, leastSoldPeriod));
  leastSoldOrders.forEach(o => {
    try {
      const items: CartItem[] = JSON.parse(o.items);
      items.forEach(i => {
        leastSoldProductCount[i.name] = (leastSoldProductCount[i.name] || 0) + i.qty;
      });
    } catch(e) {}
  });

  const barChartDataBottom = Object.entries(leastSoldProductCount)
    .map(([name, qty]) => ({ name, quantidade: qty }))
    .sort((a,b) => a.quantidade - b.quantidade)
    .slice(0, 5);

  // Hourly Chart Data
  const salesByHour = Array(24).fill(0);
  const hourlyOrders = activeOrders.filter(o => filterByPeriod(o.created_at, hourlyPeriod));
  hourlyOrders.forEach(o => {
    // get hours in local time
    const hour = getBrazilHour(getOrderDate(o.created_at));
    // It's possible that 24 shows up if the locale is weird, check bounds
    if (hour >= 0 && hour < 24) salesByHour[hour]++;
  });

  let minHour = 24;
  let maxHour = -1;
  salesByHour.forEach((count, h) => {
    if (count > 0) {
      if (h < minHour) minHour = h;
      if (h > maxHour) maxHour = h;
    }
  });
  if (minHour > maxHour) { minHour = 8; maxHour = 18; }
  else {
    minHour = Math.max(0, minHour - 1);
    maxHour = Math.min(23, maxHour + 1);
  }

  const hourlyChartData = [];
  for (let i = minHour; i <= maxHour; i++) {
    hourlyChartData.push({ hour: `${i}h`, pedidos: salesByHour[i] });
  }

  // Weekday Chart Data
  const salesByWeekday = Array(7).fill(0);
  const weekdayOrders = activeOrders.filter(o => filterByPeriod(o.created_at, weekdayPeriod));
  weekdayOrders.forEach(o => {
    const day = getBrazilWeekday(getOrderDate(o.created_at));
    salesByWeekday[day] += o.total;
  });
  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const weekdayChartData = salesByWeekday.map((total, idx) => ({
    name: daysOfWeek[idx],
    receita: Number(total.toFixed(2))
  }));

  const statusCount = {
    'Aguardando': orders.filter(o => o.status === 'aguardando').length,
    'Em Preparo': orders.filter(o => o.status === 'preparo').length,
    'Prontos/Retirados': orders.filter(o => o.status === 'pronto' || o.status === 'retirado').length,
    'Cancelados': orders.filter(o => o.status === 'cancelado').length,
  };

  const pieData = [
    { name: 'Aguardando', value: statusCount['Aguardando'] },
    { name: 'Em Preparo', value: statusCount['Em Preparo'] },
    { name: 'Prontos/Retirados', value: statusCount['Prontos/Retirados'] },
    { name: 'Cancelados', value: statusCount['Cancelados'] }
  ].filter(d => d.value > 0);

  const statusColors: Record<string, string> = {
    'Aguardando': '#3b82f6',
    'Em Preparo': '#f59e0b',
    'Prontos/Retirados': '#10b981',
    'Cancelados': '#ef4444'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Vendas Hoje</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: 'var(--orange)' }}>R$ {todayRevenue.toFixed(2)}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>{todayOrders.length} pedidos hoje</div>
        </div>
        <div 
          className="card" 
          style={{ padding: 24, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none' }} 
          onClick={() => setCardRevenuePeriod(prev => prev === 'anual' ? 'semestral' : 'anual')}
          title="Clique para alternar período"
        >
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {cardRevenuePeriod === 'anual' ? 'Faturamento Anual' : 'Faturamento Semestral'}
            <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 6 }}>🔄</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: 'var(--success)' }}>R$ {cardRevenue.toFixed(2)}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>{cardOrders.length} pedidos confirmados</div>
        </div>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Avaliação da Cantina</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#f59e0b' }}>⭐ {myCanteen?.avg_rating ? Number(myCanteen.avg_rating).toFixed(1) : 'N/A'}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>{myCanteen?.rating_count || 0} avaliações recebidas</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h4 style={{ fontWeight: 'bold', margin: 0 }}>Faturamento Geral</h4>
            <select className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }} value={revenuePeriod} onChange={(e) => setRevenuePeriod(e.target.value as any)}>
              <option value="dia">Último dia</option>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Últimos 30 dias</option>
            </select>
          </div>
          {lineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineChartData} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <YAxis width={60} tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                <RechartsTooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--text)' }} formatter={(value: number) => [`R$ ${value}`, 'Faturamento']} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                <Line type="monotone" dataKey="receita" stroke="var(--orange)" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState title="Sem Faturamento" description="Nenhum faturamento no período" emoji="📈" />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h4 style={{ fontWeight: 'bold', margin: 0 }}>Top 5 Produtos Mais Vendidos</h4>
            <select className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }} value={productPeriod} onChange={(e) => setProductPeriod(e.target.value as any)}>
              <option value="dia">Último dia</option>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Últimos 30 dias</option>
            </select>
          </div>
          {barChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--text)' }} formatter={(value: number) => [`${value} unidades`, 'Vendas']} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                <Bar dataKey="quantidade" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Sem vendas no período selecionado</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h4 style={{ fontWeight: 'bold', margin: 0 }}>Distribuição de Horários</h4>
            <select className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }} value={hourlyPeriod} onChange={(e) => setHourlyPeriod(e.target.value as any)}>
              <option value="dia">Último dia</option>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Últimos 30 dias</option>
            </select>
          </div>
          {hourlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="hour" tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--text)' }} formatter={(value: number) => [`${value} pedidos`, 'Volume']} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                <Bar dataKey="pedidos" fill="var(--orange)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState title="Sem Pedidos" description="Nenhum pedido no período" emoji="📊" />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h4 style={{ fontWeight: 'bold', margin: 0 }}>Top 5 Produtos Menos Vendidos</h4>
            <select className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }} value={leastSoldPeriod} onChange={(e) => setLeastSoldPeriod(e.target.value as any)}>
              <option value="dia">Último dia</option>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Últimos 30 dias</option>
            </select>
          </div>
          {barChartDataBottom.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartDataBottom} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--text)' }} formatter={(value: number) => [`${value} unidades`, 'Vendas']} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                <Bar dataKey="quantidade" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Sem vendas no período selecionado</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h4 style={{ fontWeight: 'bold', margin: 0 }}>Faturamento por Dia da Semana</h4>
            <select className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }} value={weekdayPeriod} onChange={(e) => setWeekdayPeriod(e.target.value as any)}>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Últimos 30 dias</option>
              <option value="semestre">Últimos 6 meses</option>
              <option value="ano">Último ano</option>
            </select>
          </div>
          {weekdayChartData.some(d => d.receita > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weekdayChartData} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} />
                <YAxis width={60} tick={{fontSize: 12, fill: 'var(--text)'}} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                <RechartsTooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--text)' }} formatter={(value: number) => [`R$ ${value}`, 'Faturamento']} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                <Bar dataKey="receita" fill="var(--success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Sem vendas no período selecionado</div>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h4 style={{ marginBottom: 16, fontWeight: 'bold', textAlign: 'center' }}>Pedidos por Status</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5}>
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColors[entry.name]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--text)' }} formatter={(value: number) => [`${value} pedidos`, 'Quantidade']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            {pieData.map((entry, idx) => (
               <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                 <div style={{ width: 12, height: 12, borderRadius: '50%', background: statusColors[entry.name] }} />
                 {entry.name} ({entry.value})
               </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenGestor({ products, tags, currentUser, fetchProducts, showToast, canteens, fetchCanteens, categories, fetchCategories, fetchTags }: { products: Product[], tags: Tag[], currentUser: User | null, fetchProducts: () => void, showToast: (msg: string) => void, canteens: Canteen[], fetchCanteens: () => void, categories: Category[], fetchCategories: () => void, fetchTags: () => void }) {
  if (currentUser?.role !== 'manager' && currentUser?.role !== 'superadmin') {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
          <h2>Acesso Negado</h2>
          <p>Apenas gestores da cantina e administradores podem acessar esta área.</p>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'dashboard' | 'pedidos' | 'gerenciar_produtos' | 'config' | 'cupons' | 'relatorio'>('dashboard');

  const myCanteen = canteens.find(c => String(c.id) === String(currentUser?.canteen_id)) || canteens[0] || null;

  const [reportData, setReportData] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (myCanteen) {
      const saved = localStorage.getItem(`canteen_saved_report_${myCanteen.id}`);
      if (saved) setReportData(saved);
      else setReportData(null);
    }
  }, [myCanteen]);

  const generateReport = async () => {
    if (!myCanteen) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: orders,
          canteen: myCanteen,
          products: products.filter(p => p.canteen_id === myCanteen.id)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data.report);
        localStorage.setItem(`canteen_saved_report_${myCanteen.id}`, data.report);
      } else {
        showToast("❌ Erro ao gerar relatório");
      }
    } catch (e) {
      showToast("❌ Erro ao gerar relatório");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadReport = () => {
    if (!reportData) return;
    const blob = new Blob([reportData], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-cantina-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<string>('todos');
  const getBrazilDateString = (d: Date) => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  };
  const [orderDateFilter, setOrderDateFilter] = useState<string>(getBrazilDateString(new Date()));
  const [orderSortMethod, setOrderSortMethod] = useState<'desc' | 'asc'>('desc');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [isProductFormVisible, setIsProductFormVisible] = useState(false);
  const [orderToCancelId, setOrderToCancelId] = useState<number | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  
  // Settings state
  const filteredProducts = products.filter(p => String(p.canteen_id || '1') === String(myCanteen?.id));

  const [canteenName, setCanteenName] = useState(myCanteen?.name || '');
  const [canteenDesc, setCanteenDesc] = useState(myCanteen?.desc || '');
  const [canteenLocation, setCanteenLocation] = useState(myCanteen?.location || '');
  const [canteenEmoji, setCanteenEmoji] = useState(myCanteen?.emoji || '');
  const [canteenImageUrl, setCanteenImageUrl] = useState(myCanteen?.image_url || '');
  const [unCroppedImageUrl, setUnCroppedImageUrl] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [canteenColor, setCanteenColor] = useState(myCanteen?.color || '#ffffff');
  const [openTime, setOpenTime] = useState(myCanteen?.open_time || '08:00');
  const [closeTime, setCloseTime] = useState(myCanteen?.close_time || '18:00');
  const [pointsEnabled, setPointsEnabled] = useState(myCanteen?.points_enabled !== undefined ? myCanteen.points_enabled === 1 : true);
  const [maintenanceMode, setMaintenanceMode] = useState(myCanteen?.maintenance_mode !== undefined ? myCanteen.maintenance_mode === 1 : false);
  const [globalWarning, setGlobalWarning] = useState(myCanteen?.global_warning || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (myCanteen) {
      setCanteenName(myCanteen.name);
      setCanteenDesc(myCanteen.desc);
      setCanteenLocation(myCanteen.location || '');
      setCanteenEmoji(myCanteen.emoji);
      setCanteenImageUrl(myCanteen.image_url || '');
      setCanteenColor(myCanteen.color);
      setOpenTime(myCanteen.open_time);
      setCloseTime(myCanteen.close_time);
      setPointsEnabled(myCanteen.points_enabled !== undefined ? myCanteen.points_enabled === 1 : true);
      setMaintenanceMode(myCanteen.maintenance_mode !== undefined ? myCanteen.maintenance_mode === 1 : false);
      setGlobalWarning(myCanteen.global_warning || '');
    }
  }, [myCanteen?.id]);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const generateCroppedImage = async () => {
    try {
      const croppedImage = await getCroppedImg(unCroppedImageUrl, croppedAreaPixels);
      setCanteenImageUrl(croppedImage || '');
      setIsCropping(false);
      setUnCroppedImageUrl('');
    } catch (e) {
      console.error(e);
      globalShowToast('Erro ao recortar imagem');
      setIsCropping(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUnCroppedImageUrl(event.target?.result as string);
      setIsCropping(true);
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onProductCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setProductCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const generateCroppedProductImage = async () => {
    try {
      const croppedImage = await getCroppedImg(unCroppedProductImageUrl, productCroppedAreaPixels);
      setFormImageUrl(croppedImage || '');
      setIsCroppingProduct(false);
      setUnCroppedProductImageUrl('');
    } catch (e) {
      console.error(e);
      globalShowToast('Erro ao recortar imagem');
      setIsCroppingProduct(false);
    }
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUnCroppedProductImageUrl(event.target?.result as string);
      setIsCroppingProduct(true);
      setProductZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    if (!myCanteen) return;
    try {
      await fetch(`/api/canteens/${myCanteen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
        body: JSON.stringify({ 
          name: canteenName,
          desc: canteenDesc,
          location: canteenLocation,
          emoji: canteenEmoji,
          image_url: canteenImageUrl,
          color: canteenColor,
          open_time: openTime, 
          close_time: closeTime,
          points_enabled: pointsEnabled ? 1 : 0,
          maintenance_mode: maintenanceMode ? 1 : 0,
          global_warning: globalWarning
        })
      });
      showToast('✅ Configurações atualizadas!');
      fetchCanteens();
    } catch (err) {
      showToast('Erro ao atualizar configurações.');
    }
  };
  
  // States for the product form
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [formName, setFormName] = useState('');
  const myCategories = categories.filter(c => String(c.canteen_id || '1') === String(myCanteen?.id));
  const [formCat, setFormCat] = useState(myCategories.length > 0 ? myCategories[0].name : 'salgados');
  const [formCanteenId, setFormCanteenId] = useState(canteens.length > 0 ? canteens[0].id.toString() : '1');
  const [formPrice, setFormPrice] = useState('');
  const [formPointsPrice, setFormPointsPrice] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEmoji, setFormEmoji] = useState('🍽️');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [unCroppedProductImageUrl, setUnCroppedProductImageUrl] = useState('');
  const [productCrop, setProductCrop] = useState({ x: 0, y: 0 });
  const [productZoom, setProductZoom] = useState(1);
  const [productCroppedAreaPixels, setProductCroppedAreaPixels] = useState<any>(null);
  const [isCroppingProduct, setIsCroppingProduct] = useState(false);
  const [formStock, setFormStock] = useState('10');
  const [formTags, setFormTags] = useState<number[]>([]);
  const [showProductEmojiPicker, setShowProductEmojiPicker] = useState(false);
  
  // Tag management
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#e5e7eb');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [deleteTagConfirmId, setDeleteTagConfirmId] = useState<string | number | null>(null);

  // Category management
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [deleteCatConfirmId, setDeleteCatConfirmId] = useState<string | number | null>(null);

  // Coupons management
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [formCouponCode, setFormCouponCode] = useState('');
  const [formCouponPct, setFormCouponPct] = useState('');
  const [formCouponUses, setFormCouponUses] = useState('');
  const [formCouponDate, setFormCouponDate] = useState('');
  const [formCouponMinVal, setFormCouponMinVal] = useState('');
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | number | null>(null);
  const [deleteCouponId, setDeleteCouponId] = useState<string | number | null>(null);

  const handleEditCoupon = (coupon: Coupon) => {
    setFormCouponCode(coupon.code);
    setFormCouponPct(coupon.discount_pct.toString());
    setFormCouponUses(coupon.max_uses ? coupon.max_uses.toString() : '');
    setFormCouponDate(coupon.expires_at ? coupon.expires_at.split('T')[0] : '');
    setFormCouponMinVal(coupon.min_value ? coupon.min_value.toString() : '');
    setEditingCouponId(coupon.id);
    setIsAddingCoupon(true);
  };

  const fetchCoupons = async () => {
    try {
      const cid = myCanteen?.id;
      if (!cid) return;
      const res = await fetch(`/api/coupons/canteen/${encodeURIComponent(String(cid))}`, { headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
      if (res.ok) {
        setCoupons(await res.json());
      }
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'cupons') fetchCoupons();
  }, [activeTab]);

  const handleSaveCoupon = async () => {
    if (!formCouponCode || !formCouponPct) {
      showToast('Preencha código e desconto.');
      return;
    }
    
    let expiresAt = null;
    if (formCouponDate) {
      expiresAt = formCouponDate + 'T23:59:59.999Z';
    }

    const isEditing = editingCouponId !== null;
    const url = isEditing ? `/api/coupons/${editingCouponId}` : '/api/coupons';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
        body: JSON.stringify({
          code: formCouponCode.toUpperCase(),
          discount_pct: parseFloat(formCouponPct),
          max_uses: formCouponUses ? parseInt(formCouponUses) : null,
          expires_at: expiresAt,
          canteen_id: myCanteen?.id,
          active: isEditing ? coupons.find(c => c.id === editingCouponId)?.active : 1,
          min_value: formCouponMinVal ? parseFloat(formCouponMinVal) : 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(isEditing ? '🎟️ Cupom atualizado!' : '🎟️ Cupom criado!');
        setIsAddingCoupon(false);
        setEditingCouponId(null);
        setFormCouponCode('');
        setFormCouponPct('');
        setFormCouponUses('');
        setFormCouponDate('');
        fetchCoupons();
      } else {
        showToast(data.error || 'Erro ao salvar cupom.');
      }
    } catch {
      showToast('Erro ao salvar cupom.');
    }
  };

  const handleDeleteCoupon = async (id: string | number) => {
    try {
      await fetch(`/api/coupons/${id}`, { method: 'DELETE', headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
      showToast('🗑️ Cupom excluído!');
      setDeleteCouponId(null);
      fetchCoupons();
    } catch {
      showToast('Erro ao excluir cupom.');
    }
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      await fetch(`/api/coupons/${coupon.id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
        body: JSON.stringify({ active: coupon.active ? 0 : 1 })
      });
      fetchCoupons();
    } catch {
      showToast('Erro ao atualizar cupom.');
    }
  };

  useEffect(() => {
    if (myCategories.length > 0 && !formCat) {
      setFormCat(myCategories[0].name);
    }
  }, [categories, myCanteen?.id]);

  const handleAddCategory = async () => {
    if (!newCatName || !myCanteen) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
        body: JSON.stringify({ name: newCatName.toLowerCase(), canteen_id: myCanteen.id })
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

  const handleDeleteCategory = async (id: string | number) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE', headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
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
    setFormPointsPrice(p.points_price?.toString() || '');
    setFormDesc(p.desc);
    setFormEmoji(p.emoji);
    setFormImageUrl(p.image_url || '');
    setFormStock(p.stock.toString());
    setFormCanteenId(p.canteen_id?.toString() || '1');
    try { setFormTags(JSON.parse(p.tags || '[]')); } catch (e) { setFormTags([]); }
    setIsProductFormVisible(true);
  };

  const handleNewClick = () => {
    setEditingId(null);
    setFormName('');
    setFormCat('salgados');
    setFormCanteenId(myCanteen ? myCanteen.id.toString() : '1');
    setFormPrice('');
    setFormPointsPrice('');
    setFormDesc('');
    setFormEmoji('🍽️');
    setFormImageUrl('');
    setFormStock('10');
    setFormTags([]);
    setIsProductFormVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!formName || !formPrice) {
      showToast('Nome e preço são obrigatórios!');
      return;
    }

    const payload = {
      name: formName,
      cat: formCat,
      canteen_id: formCanteenId,
      price: parseFloat(formPrice),
      points_price: formPointsPrice ? parseInt(formPointsPrice, 10) : null,
      desc: formDesc,
      emoji: formEmoji,
      image_url: formImageUrl,
      stock: parseInt(formStock, 10) || 0,
      tags: JSON.stringify(formTags)
    };

    try {
      if (editingId) {
        await fetch(`/api/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
          body: JSON.stringify(payload)
        });
        showToast('✅ Produto atualizado!');
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
          body: JSON.stringify(payload)
        });
        showToast('✅ Produto adicionado!');
      }
      fetchProducts();
      setIsProductFormVisible(false);
    } catch (err) {
      showToast('Erro ao salvar produto.');
    }
  };

  const handleToggleStatus = async (p: Product) => {
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
        body: JSON.stringify({ ...p, active: p.active === 1 ? 0 : 1 })
      });
      if (!res.ok) {
         const data = await res.json();
         showToast(`Erro: ${data.error}`);
         return;
      }
      fetchProducts();
    } catch (err: any) {
      showToast(`Erro ao alterar status: ${err.message}`);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [deleteOrderConfirmId, setDeleteOrderConfirmId] = useState<string | number | null>(null);

  const handleDelete = async (id: string | number) => {
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
      showToast('🗑️ Produto excluído!');
      fetchProducts();
      setDeleteConfirmId(null);
    } catch (err) {
      showToast('Erro ao excluir produto.');
    }
  };

  const handleDeleteOrder = async (id: string | number) => {
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE', headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
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
      const cid = myCanteen?.id;
      if (!cid) return;
      const res = await fetch(`/api/orders/canteen/${encodeURIComponent(String(cid))}`, { headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
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

  const updateOrderStatus = async (id: number | string, status: string, cancelReason?: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
        body: JSON.stringify({ status, cancel_reason: cancelReason })
      });
      if (res.ok) {
        fetchOrders();
        if (status === 'cancelado') {
          fetchProducts();
        }
        showToast(`Status atualizado para ${status}`);
      } else {
        showToast('Erro ao atualizar status do pedido.');
      }
    } catch (err) {
      showToast('Erro ao atualizar status.');
    }
  };

  useEffect(() => {
    if (activeTab === 'pedidos' || activeTab === 'dashboard') {
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

      <ScrollableRow className="gestor-tabs" style={{ '--gradient-bg': 'var(--bg)' } as React.CSSProperties}>
        <button className={`gestor-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📈 Dashboard</button>
        <button className={`gestor-tab ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => setActiveTab('pedidos')}>📋 Pedidos</button>
        <button className={`gestor-tab ${activeTab === 'gerenciar_produtos' ? 'active' : ''}`} onClick={() => { setActiveTab('gerenciar_produtos'); setIsProductFormVisible(false); }}>🥘 Gerenciar Produtos</button>
        <button className={`gestor-tab ${activeTab === 'cupons' ? 'active' : ''}`} onClick={() => setActiveTab('cupons')}>🎟️ Cupons</button>
        <button className={`gestor-tab ${activeTab === 'relatorio' ? 'active' : ''}`} onClick={() => setActiveTab('relatorio')}>📑 Relatório IA</button>
        <button className={`gestor-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>⚙️ Configurações</button>
      </ScrollableRow>

      {activeTab === 'dashboard' && (
        <DashboardView orders={orders} myCanteen={myCanteen} />
      )}

      {activeTab === 'relatorio' && (
        <div className="gestor-panel active" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Relatório Inteligente</h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>Deixe nossa IA analisar os dados da sua cantina e gerar um resumo executivo.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {reportData && (
                  <button onClick={handleDownloadReport} className="btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Baixar Relatório">
                    ⬇️
                  </button>
                )}
                <button onClick={generateReport} disabled={isGeneratingReport} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isGeneratingReport ? '⏳ Gerando Relatório...' : '✨ Gerar Relatório'}
                </button>
              </div>
            </div>
            {reportData && (
              <div className="card markdown-body" style={{ marginTop: '16px', background: 'var(--bg)', padding: '24px', fontSize: '14px', lineHeight: '1.6' }}>
                <Markdown>{reportData}</Markdown>
              </div>
            )}
            {!reportData && !isGeneratingReport && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', background: 'var(--bg)', borderRadius: '12px', marginTop: '16px' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 16px 0' }}>🤖</p>
                <p style={{ fontWeight: 500, margin: 0 }}>Nenhum relatório gerado ainda.</p>
                <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>Clique no botão acima para iniciar a análise.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="gestor-panel active">
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Configurações da Cantina</h3>

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
              <label>Cor de Fundo (Secundária)
                <input type="color" value={canteenColor} onChange={e => setCanteenColor(e.target.value)} style={{ height: 40, padding: 0, cursor: 'pointer' }} />
              </label>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Imagem da Cantina</label>
                <div 
                  style={{ 
                    border: '2px dashed var(--line)', 
                    borderRadius: 12, 
                    textAlign: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    background: 'var(--bg-secondary)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 120,
                    padding: canteenImageUrl ? 0 : 32
                  }}
                  onClick={() => document.getElementById('canteenImageUpload')?.click()}
                >
                  {canteenImageUrl ? (
                    <>
                      <div style={{ width: '100%' }}>
                        <img src={canteenImageUrl} alt="Preview" style={{ width: '100%', aspectRatio: '35 / 12', objectFit: 'cover', borderRadius: 12, background: canteenColor, display: 'block' }} />
                      </div>
                      <div className="hover-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: '#fff', fontWeight: 'bold' }} 
                        onMouseEnter={e => e.currentTarget.style.opacity='1'} 
                        onMouseLeave={e => e.currentTarget.style.opacity='0'}>
                        Trocar Imagem
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 40 }}>📸</span>
                      <span style={{ fontWeight: 500 }}>Clique para adicionar a foto da cantina</span>
                      <span style={{ fontSize: 12 }}>Formatos aceitos: JPG, PNG, GIF</span>
                    </div>
                  )}
                  <input id="canteenImageUpload" type="file" accept="image/*" onChange={(e) => { handleImageUpload(e); e.target.value = ''; }} style={{ display: 'none' }} />
                </div>
                {canteenImageUrl && (
                  <div style={{ marginTop: 8, textAlign: 'center' }}>
                    <button type="button" className="btn-danger btn-sm" onClick={() => setCanteenImageUrl('')}>Remover Imagem</button>
                  </div>
                )}
                {isCropping && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 800, height: '70vh', background: '#000' }}>
                      <Cropper
                        image={unCroppedImageUrl}
                        crop={crop}
                        zoom={zoom}
                        maxZoom={3}
                        aspect={350 / 120}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        style={{ containerStyle: { background: '#222' } }}
                      />
                    </div>
                    <div style={{ padding: 20, display: 'flex', gap: 16, background: 'var(--card)', width: '100%', maxWidth: 800, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ color: 'var(--text)', fontSize: 14 }}>Zoom</span>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
                      </div>
                      <button className="btn-secondary" onClick={() => setIsCropping(false)}>Cancelar</button>
                      <button className="btn-orange" onClick={generateCroppedImage}>Confirmar Recorte</button>
                    </div>
                  </div>
                )}
              </div>
              <label>Horário de Abertura
                <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
              </label>
              <label>Horário de Fechamento
                <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
              </label>

              <div style={{ marginTop: 12, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={pointsEnabled} 
                    onChange={e => setPointsEnabled(e.target.checked)} 
                    style={{ width: 20, height: 20, accentColor: 'var(--orange)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>Ativar acúmulo de pontos</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 'normal', marginTop: 2 }}>Se estiver desligado, compras nesta cantina não darão pontos aos alunos.</div>
                  </div>
                </label>
              </div>

              <div style={{ marginTop: 12, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={maintenanceMode} 
                    onChange={e => setMaintenanceMode(e.target.checked)} 
                    style={{ width: 20, height: 20, accentColor: 'var(--orange)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>Modo Manutenção</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 'normal', marginTop: 2 }}>Bloqueia a compra de itens nesta cantina temporariamente.</div>
                  </div>
                </label>
              </div>

              <label style={{ marginTop: 12 }}>Aviso Global
                <textarea 
                  value={globalWarning} 
                  onChange={e => setGlobalWarning(e.target.value)} 
                  placeholder="Ex: Faltou energia, não estamos servindo lanches quentes."
                  rows={2}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit' }}
                />
              </label>

              <button className="btn-orange" style={{ marginTop: 12 }} onClick={handleSaveSettings}>Salvar Configurações</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cupons' && (
        <div className="gestor-panel active">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3>Cupons de Desconto</h3>
            <button className="btn-orange btn-sm" onClick={() => setIsAddingCoupon(true)}>+ Novo Cupom</button>
          </div>

          {isAddingCoupon && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 12 }}>{editingCouponId ? 'Editar Cupom' : 'Criar Cupom'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Código <span style={{ color: 'red' }}>*</span></label>
                  <input type="text" value={formCouponCode} onChange={e => setFormCouponCode(e.target.value.toUpperCase())} placeholder="EX: VERAO20" className="w-full" style={{ padding: '8px 12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Desconto (%) <span style={{ color: 'red' }}>*</span></label>
                  <input type="number" min="1" max="100" value={formCouponPct} onChange={e => setFormCouponPct(e.target.value)} placeholder="15" className="w-full" style={{ padding: '8px 12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Uso Máximo (Opcional)</label>
                  <input type="number" min="1" value={formCouponUses} onChange={e => setFormCouponUses(e.target.value)} placeholder="Vezes (deixe em branco p/ ∞)" className="w-full" style={{ padding: '8px 12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Data Limite (Opcional)</label>
                  <input type="date" value={formCouponDate} onChange={e => setFormCouponDate(e.target.value)} className="w-full" style={{ padding: '8px 12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Valor Mínimo (Opcional)</label>
                  <input type="number" min="0" step="0.01" value={formCouponMinVal} onChange={e => setFormCouponMinVal(e.target.value)} placeholder="0.00" className="w-full" style={{ padding: '8px 12px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-outline btn-sm" onClick={() => { setIsAddingCoupon(false); setEditingCouponId(null); }}>Cancelar</button>
                <button className="btn-orange btn-sm" onClick={handleSaveCoupon}>Salvar Cupom</button>
              </div>
            </div>
          )}

          <div className="product-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {coupons.map(coupon => (
              <div key={coupon.id} className="card coupon-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 'bold', fontSize: 16 }}>{coupon.code}</span>
                    <span className="tag tag-success">{coupon.discount_pct}% OFF</span>
                    {!coupon.active && <span className="tag" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>Inativo</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Usos: {coupon.used_count} {coupon.max_uses ? `/ ${coupon.max_uses}` : ''}</span>
                    <span>Validade: {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('pt-BR') : 'Sem validade'}</span>
                    {coupon.min_value > 0 && <span>Mínimo: R$ {coupon.min_value.toFixed(2).replace('.', ',')}</span>}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className="btn-outline btn-sm" onClick={() => handleEditCoupon(coupon)}>✏️</button>
                  <button className="btn-outline btn-sm" onClick={() => toggleCouponStatus(coupon)}>
                    {coupon.active ? 'Desativar' : 'Ativar'}
                  </button>
                  {deleteCouponId === coupon.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-orange btn-sm" onClick={() => handleDeleteCoupon(coupon.id)}>Confirma?</button>
                      <button className="btn-outline btn-sm" onClick={() => setDeleteCouponId(null)}>x</button>
                    </div>
                  ) : (
                    <button className="btn-outline btn-sm" onClick={() => setDeleteCouponId(coupon.id)} style={{ color: 'red', borderColor: 'red' }}>Excluir</button>
                  )}
                </div>
              </div>
            ))}
            
            {coupons.length === 0 && !isAddingCoupon && (
              <EmptyState title="Nenhum cupom cadastrado" description="Crie cupons de desconto para sua cantina." emoji="🎟️" />
            )}
          </div>
        </div>
      )}

      {activeTab === 'pedidos' && (
        <div className="gestor-panel active">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }} className="gestor-filters-container">
            <span style={{ fontSize: 14, fontWeight: 500, display: 'block', width: '100%', marginBottom: 4 }}>Filtros:</span>
            <input 
              type="text" 
              placeholder="Buscar por cliente ou pedido..."
              value={orderSearchQuery}
              onChange={e => setOrderSearchQuery(e.target.value)}
              className="form-input"
              style={{ padding: '8px 12px', flex: '1 1 200px' }}
            />
            <input 
              type="date" 
              value={orderDateFilter} 
              onChange={e => setOrderDateFilter(e.target.value)} 
              className="form-input"
              style={{ padding: '8px 12px', flex: '1 1 150px' }}
            />
            <button className="btn-outline btn-sm" style={{ flex: '1 1 auto' }} onClick={() => setOrderDateFilter('')}>Limpar Data</button>
            <button 
              className="btn-outline btn-sm" 
              style={{ flex: '1 1 auto' }}
              onClick={() => setOrderSortMethod(prev => prev === 'desc' ? 'asc' : 'desc')}
            >
               Ordenação: {orderSortMethod === 'desc' ? 'Recentes ↓' : 'Antigos ↑'}
            </button>
          </div>
          <ScrollableRow className="gestor-tabs" style={{ marginBottom: 16, '--gradient-bg': 'var(--bg)' } as React.CSSProperties}>
            <button className={`gestor-tab ${orderFilter === 'todos' ? 'active' : ''}`} onClick={() => setOrderFilter('todos')}>Todos (Ativos)</button>
            <button className={`gestor-tab ${orderFilter === 'aguardando' ? 'active' : ''}`} onClick={() => setOrderFilter('aguardando')}>Aguardando</button>
            <button className={`gestor-tab ${orderFilter === 'preparo' ? 'active' : ''}`} onClick={() => setOrderFilter('preparo')}>Em Preparo</button>
            <button className={`gestor-tab ${orderFilter === 'pronto' ? 'active' : ''}`} onClick={() => setOrderFilter('pronto')}>Pronto</button>
            <button className={`gestor-tab ${orderFilter === 'retirado' ? 'active' : ''}`} onClick={() => setOrderFilter('retirado')}>Retirado</button>
            <button className={`gestor-tab ${orderFilter === 'cancelado' ? 'active' : ''}`} onClick={() => setOrderFilter('cancelado')}>Cancelados</button>
            <button className={`gestor-tab ${orderFilter === 'historico' ? 'active' : ''}`} onClick={() => setOrderFilter('historico')}>Histórico</button>
          </ScrollableRow>
          {orderFilter === 'historico' && (
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', marginBottom: 16, border: '1px solid var(--line)' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                O Histórico contém todos os pedidos finalizados (Retirados, Cancelados). 
                Utilize a barra de busca acima para filtrar por usuário, ou selecione uma data.
              </p>
            </div>
          )}
          <div className="orders-list">
            {orders.length === 0 ? (
              <EmptyState title="Nenhum pedido" description="Não há pedidos no momento para esta visualização." emoji="📋" />
            ) : (
              orders
                .filter(o => String(o.canteen_id || '1') === String(myCanteen?.id))
                .filter(o => {
                  if (!orderSearchQuery) return true;
                  const q = orderSearchQuery.toLowerCase();
                  const codeStr = o.code || '';
                  return codeStr.toLowerCase().includes(q) || o.user_name.toLowerCase().includes(q);
                })
                .filter(o => {
                  if (!orderDateFilter) return true;
                  const orderDateObj = typeof o.created_at === 'number' ? new Date(o.created_at) : new Date(o.created_at.replace(' ', 'T') + (o.created_at.includes('Z') ? '' : 'Z'));
                  const orderDateFormatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(orderDateObj);
                  return orderDateFormatted === orderDateFilter;
                })
                .filter(o => {
                  if (orderFilter === 'todos') {
                    return o.status === 'aguardando' || o.status === 'preparo' || o.status === 'pronto';
                  }
                  if (orderFilter === 'historico') {
                    return o.status === 'retirado' || o.status === 'cancelado';
                  }
                  return o.status === orderFilter;
                })
                .sort((a, b) => {
                  const tA = typeof a.created_at === 'number' ? a.created_at : new Date(a.created_at.replace(' ', 'T') + (a.created_at.includes('Z') ? '' : 'Z')).getTime();
                  const tB = typeof b.created_at === 'number' ? b.created_at : new Date(b.created_at.replace(' ', 'T') + (b.created_at.includes('Z') ? '' : 'Z')).getTime();
                  return orderSortMethod === 'desc' ? tB - tA : tA - tB;
                })
                .map(order => {
                  const items: CartItem[] = JSON.parse(order.items);
                  const itemsText = items.map(i => `${i.name} × ${i.qty}`).join(' + ');
                  const orderTime = formatBrazilTime(order.created_at);
                  const orderDateFormatted = formatBrazilDate(order.created_at);
                  
                  return (
                    <div className="order-card" key={order.id}>
                      <div>
                        <div className="order-id">
                          {order.code ? `Pedido ${order.code}` : 'Pedido Pendente'} <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>📅 {orderDateFormatted} às {orderTime}</span>
                        </div>
                        <div className="order-meta">{order.user_name} · {itemsText} · R$ {order.total.toFixed(2).replace('.', ',')}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {(() => {
                          const actionConfig = OrderStatusFactory.createStrategy(order.status).getActions(order.id, {
                            updateOrderStatus,
                            setDeleteOrderConfirmId,
                            promptCancelReason: (id) => setOrderToCancelId(id)
                          });
                          if (!actionConfig) return null;
                          return (
                            <React.Fragment>
                              <span className={actionConfig.tag.className || "tag"} style={actionConfig.tag.style}>{actionConfig.tag.text}</span>
                              {actionConfig.buttons && actionConfig.buttons.length > 0 && (
                                <div className="order-actions">
                                  {actionConfig.buttons.map((btn: any, idx: number) => (
                                    <button key={idx} className={btn.className} onClick={btn.action}>{btn.label}</button>
                                  ))}
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {activeTab === 'gerenciar_produtos' && !isProductFormVisible && (
        <div className="gestor-panel active">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3>Produtos cadastrados</h3>
            <button className="btn-orange btn-sm" onClick={handleNewClick}>+ Novo Produto</button>
          </div>
          <div style={{ marginBottom: 16 }}>
            <input 
              type="text" 
              placeholder="Pesquisar por nome, categoria ou tags..." 
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '100%', maxWidth: 400 }}
            />
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredProducts
              .filter(p => 
                productSearchQuery === '' || 
                p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                p.cat.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                (p.tags && p.tags.toLowerCase().includes(productSearchQuery.toLowerCase()))
              )
              .map(p => (
              <div className="order-card" key={p.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--line)' }}>
                    <LazyMedia emoji={p.emoji} imageUrl={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <div className="order-id" style={{ fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                    <div className="order-meta">{p.cat} · R$ {p.price.toFixed(2).replace('.', ',')} · Estoque: {p.stock}</div>
                  </div>
                </div>
                <div className="order-actions" style={{ flexWrap: 'wrap', marginTop: 8 }}>
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
            {filteredProducts.length === 0 && (
              <EmptyState title="Nenhum produto" description="Sua cantina ainda não tem produtos ou não encontramos o termo buscado." emoji="🍔" />
            )}
          </div>
        </div>
      )}

      {activeTab === 'gerenciar_produtos' && isProductFormVisible && (
        <div className="gestor-panel active">
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <button 
                className="btn-secondary btn-sm" 
                style={{ marginRight: 12, padding: '4px 8px' }} 
                onClick={() => setIsProductFormVisible(false)}
              >
                ← Voltar
              </button>
              <h3 style={{ margin: 0 }}>{editingId ? 'Editar Produto' : 'Adicionar ao Cardápio'}</h3>
            </div>
            <div className="form">
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Imagem do Produto</label>
              <div 
                style={{ 
                  border: '2px dashed var(--line)', 
                  borderRadius: 12, 
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 120,
                  padding: formImageUrl ? 0 : 32
                }}
                onClick={() => document.getElementById('productImageUpload')?.click()}
              >
                {formImageUrl ? (
                  <>
                    <div style={{ width: '100%' }}>
                      <img src={formImageUrl} alt="Preview" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 12, display: 'block', maxWidth: 160, margin: '0 auto' }} />
                    </div>
                    <div className="hover-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: '#fff', fontWeight: 'bold' }} 
                      onMouseEnter={e => e.currentTarget.style.opacity='1'} 
                      onMouseLeave={e => e.currentTarget.style.opacity='0'}>
                      Trocar Imagem
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 40 }}>📸</span>
                    <span style={{ fontWeight: 500 }}>Clique para adicionar a foto do produto</span>
                    <span style={{ fontSize: 12 }}>Formatos aceitos: JPG, PNG, GIF</span>
                  </div>
                )}
                <input id="productImageUpload" type="file" accept="image/*" onChange={(e) => { handleProductImageUpload(e); e.target.value = ''; }} style={{ display: 'none' }} />
              </div>
              {formImageUrl && (
                <div style={{ marginTop: 8, textAlign: 'center', marginBottom: 16 }}>
                  <button type="button" className="btn-danger btn-sm" onClick={() => setFormImageUrl('')}>Remover Imagem</button>
                </div>
              )}
              {isCroppingProduct && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '100%', maxWidth: 800, height: '70vh', background: '#000' }}>
                    <Cropper
                      image={unCroppedProductImageUrl}
                      crop={productCrop}
                      zoom={productZoom}
                      maxZoom={3}
                      aspect={1 / 1}
                      onCropChange={setProductCrop}
                      onCropComplete={onProductCropComplete}
                      onZoomChange={setProductZoom}
                      style={{ containerStyle: { background: '#222' } }}
                    />
                  </div>
                  <div style={{ padding: 20, display: 'flex', gap: 16, background: 'var(--card)', width: '100%', maxWidth: 800, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: 'var(--text)', fontSize: 14 }}>Zoom</span>
                      <input type="range" min={1} max={3} step={0.1} value={productZoom} onChange={(e) => setProductZoom(Number(e.target.value))} style={{ flex: 1 }} />
                    </div>
                    <button className="btn-secondary" onClick={() => setIsCroppingProduct(false)}>Cancelar</button>
                    <button className="btn-orange" onClick={generateCroppedProductImage}>Confirmar Recorte</button>
                  </div>
                </div>
              )}
              <label>Nome do produto
                <input type="text" placeholder="Ex: Pão de Queijo" value={formName} onChange={e => setFormName(e.target.value)} />
              </label>

              {/* Categories Management */}
              <div style={{ display: 'grid', gap: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                Categorias do Produto
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, fontWeight: 'normal' }}>
                  {categories.filter(c => String(c.canteen_id || '1') === String(myCanteen?.id)).map(cat => (
                    <div 
                      key={cat.id} 
                      onClick={() => setFormCat(cat.name)}
                      style={{ 
                        padding: '4px 12px', 
                        borderRadius: 16, 
                        border: '1px solid var(--line)',
                        background: formCat === cat.name ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                        color: formCat === cat.name ? 'var(--orange)' : 'var(--muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {formCat === cat.name && <span>✓</span>}
                      {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                      <span 
                        onClick={(e) => { e.stopPropagation(); setDeleteCatConfirmId(cat.id); }}
                        style={{ color: 'var(--danger)', marginLeft: 4, cursor: 'pointer', padding: '0 4px' }}
                      >×</span>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingCat(!isAddingCat); }}>
                    {isAddingCat ? 'Cancelar' : '+ Nova Categoria'}
                  </button>
                </div>
              </div>
              
              {isAddingCat && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  <input type="text" placeholder="Nome da categoria" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ flex: 1, marginBottom: 0 }} />
                  <button type="button" className="btn-orange btn-sm" onClick={(e) => { e.preventDefault(); handleAddCategory(); }}>Salvar</button>
                </div>
              )}

              <label>Preço (R$)
                <input type="number" placeholder="0.00" step="0.50" value={formPrice} onChange={e => setFormPrice(e.target.value)} />
              </label>
              <label>Preço em Pontos (Deixe em branco se não for resgatável)
                <input type="number" placeholder="Ex: 50" value={formPointsPrice} onChange={e => setFormPointsPrice(e.target.value)} />
              </label>
              <label>Estoque Atual
                <input type="number" placeholder="Ex: 10" value={formStock} onChange={e => setFormStock(e.target.value)} />
              </label>
              <label>Descrição
                <input type="text" placeholder="Descreva o produto" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </label>

              {/* Tags Management */}
              <div style={{ display: 'grid', gap: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                Tags do Produto
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, fontWeight: 'normal' }}>
                  {tags.filter(t => String(t.canteen_id) === String(myCanteen?.id)).map(tag => (
                    <div 
                      key={tag.id} 
                      onClick={() => {
                        if (formTags.includes(tag.id)) {
                          setFormTags(formTags.filter(id => id !== tag.id));
                        } else {
                          setFormTags([...formTags, tag.id]);
                        }
                      }}
                      style={{ 
                        padding: '4px 12px', 
                        borderRadius: 16, 
                        border: `1px solid ${tag.color}50`,
                        background: formTags.includes(tag.id) ? tag.color + '40' : 'transparent',
                        color: formTags.includes(tag.id) ? tag.color : 'var(--muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {formTags.includes(tag.id) && <span>✓</span>}
                      {tag.name}
                      <span 
                        onClick={(e) => { e.stopPropagation(); setDeleteTagConfirmId(tag.id); }}
                        style={{ color: 'var(--danger)', marginLeft: 4, cursor: 'pointer', padding: '0 4px' }}
                      >×</span>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: 12 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsAddingTag(!isAddingTag); }}>
                    {isAddingTag ? 'Cancelar' : '+ Nova Tag'}
                  </button>
                </div>
              </div>

              {isAddingTag && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, alignItems: 'center' }}>
                  <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
                  <input type="text" placeholder="Nome da tag (ex: Vegano)" value={newTagName} onChange={e => setNewTagName(e.target.value)} style={{ flex: 1, marginBottom: 0 }} />
                  <button type="button" className="btn-orange btn-sm" onClick={async (e) => {
                    e.preventDefault();
                    if (!newTagName || !myCanteen) return;
                    try {
                      const res = await fetch('/api/tags', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser?.id?.toString() || '' },
                        body: JSON.stringify({ name: newTagName, color: newTagColor, canteen_id: myCanteen.id })
                      });
                      if (res.ok) {
                        showToast('✅ Tag adicionada!');
                        setNewTagName('');
                        setNewTagColor('#e5e7eb');
                        setIsAddingTag(false);
                        fetchTags();
                      }
                    } catch (e) {
                      showToast('Erro ao criar tag');
                    }
                  }}>Salvar</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn-orange" style={{ flex: 1 }} onClick={(e) => { e.preventDefault(); handleSaveProduct(); }}>
                  {editingId ? 'Salvar Alterações' : 'Adicionar Produto'}
                </button>
                {editingId && (
                  <button type="button" className="btn-secondary" onClick={(e) => { e.preventDefault(); handleNewClick(); }}>Cancelar</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {orderToCancelId !== null && (
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
              style={{ width: '100%', maxWidth: 400 }}
            >
              <h3 style={{ marginBottom: 12 }}>Motivo do Cancelamento</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
                Informe o aluno sobre o motivo deste cancelamento.
              </p>
              <textarea
                value={cancelReasonInput}
                onChange={e => setCancelReasonInput(e.target.value)}
                placeholder="Exemplo: Faltou ingrediente, já fechamos..."
                style={{ width: '100%', minHeight: 100, padding: 12, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8, marginBottom: 16, fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setOrderToCancelId(null); setCancelReasonInput(''); }}>Voltar</button>
                <button className="btn-danger" style={{ flex: 1 }} onClick={() => { 
                  updateOrderStatus(orderToCancelId, 'cancelado', cancelReasonInput);
                  setOrderToCancelId(null);
                  setCancelReasonInput('');
                }}>Confirmar Cancelamento</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteCatConfirmId !== null && (
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
                Tem certeza que deseja excluir esta categoria permanentemente? Os produtos que usam esta categoria continuarão existindo.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setDeleteCatConfirmId(null)}>Cancelar</button>
                <button className="btn-danger" onClick={() => handleDeleteCategory(deleteCatConfirmId)}>Sim, Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {deleteTagConfirmId !== null && (
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
              <h3 style={{ marginBottom: 12, color: 'var(--danger)' }}>Excluir Tag</h3>
              <p style={{ marginBottom: 24, color: 'var(--muted)' }}>
                Tem certeza que deseja excluir esta tag permanentemente? Os produtos que usam esta tag continuarão existindo.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setDeleteTagConfirmId(null)}>Cancelar</button>
                <button className="btn-danger" onClick={async () => {
                  try {
                    const res = await fetch(`/api/tags/${deleteTagConfirmId}`, { method: 'DELETE', headers: { 'X-User-Id': currentUser?.id?.toString() || '' } });
                    if (res.ok) {
                      showToast('🗑️ Tag excluída!');
                      setDeleteTagConfirmId(null);
                      fetchTags();
                      // Remove tag from formTags if it was selected
                      setFormTags(prev => prev.filter(id => id !== deleteTagConfirmId));
                    }
                  } catch (e) {
                    showToast('Erro ao excluir tag.');
                  }
                }}>Sim, Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      </AnimatePresence>
    </div>
  );
}
