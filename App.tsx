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
fetchCanteens={fetchCanteens} />}
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



