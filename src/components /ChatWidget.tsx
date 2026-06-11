import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: string | number;
  name: string;
  price: number;
  stock: number;
  canteen_id: string | number;
  emoji?: string;
  [key: string]: any;
}

interface Canteen {
  id: string | number;
  name: string;
  emoji?: string;
  active: number;
  maintenance_mode?: number;
  [key: string]: any;
}

interface CartItem {
  id?: string | number;
  name: string;
  qty: number;
  price: number;
  [key: string]: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWidgetProps {
  products: Product[];
  canteens: Canteen[];
  cart: CartItem[];
  points: number;
  coupons?: any[];
  handleAddToCart: (product: any) => void;
  handleRemoveFromCart?: (productId: string, use_points?: boolean) => void;
  handleApplyCoupon?: (code: string) => void;
}

export default function ChatWidget({ products, canteens, cart, points, coupons, handleAddToCart, handleRemoveFromCart, handleApplyCoupon }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente inteligente da OrderPoint 🍔🍟. Como posso te ajudar hoje?' }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputVal.trim() || isLoading) return;

    const userMessage = inputVal.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputVal('');
    setIsLoading(true);

    try {
      const activeProducts = products.filter(p => p.active === 1).map(p => ({ id: p.id, name: p.name, desc: p.desc, price: p.price, stock: p.stock, canteen_id: p.canteen_id, emoji: p.emoji, points_price: p.points_price, tags: p.tags }));
      const miniCanteens = canteens.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, active: c.active, status: c.maintenance_mode === 1 ? 'maintenance' : 'active' }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context: {
            products: activeProducts,
            canteens: miniCanteens,
            points: points,
            cart: cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.price, isReward: c.isReward })),
            coupons: coupons?.map(c => ({ code: c.code, discount_pct: c.discount_pct, canteen_id: c.canteen_id })) || []
          }
        })
      });

      if (!res.ok) {
        let errMsg = 'Falha na resposta do assistente. Tente novamente.';
        try {
          const textData = await res.text();
          try {
            const errData = JSON.parse(textData);
            if (errData.error) errMsg = errData.error;
          } catch(e) {
            console.error("Non-JSON error response from assistent:", textData);
          }
        } catch(e) {}
        throw new Error(errMsg);
      }

      const textRes = await res.text();
      let data;
      try {
        data = JSON.parse(textRes);
      } catch (e) {
        console.error("Invalid JSON response from bot:", textRes);
        if (textRes.includes("<!doctype html>") || textRes.includes("<html")) {
           throw new Error("O servidor está reiniciando. Por favor, aguarde alguns instantes e tente novamente.");
        }
        throw new Error("A resposta do servidor foi inválida.");
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Desculpe, não entendi.' }]);
      
      if (data.actions && Array.isArray(data.actions)) {
        for (const action of data.actions) {
          const qty = action.quantity && typeof action.quantity === 'number' && action.quantity > 0 ? action.quantity : 1;
          if (action.type === 'ADD_TO_CART' && action.product_id) {
            const product = products.find(p => p.id === action.product_id || p.id === Number(action.product_id));
            if (product && product.stock > 0) {
              const itemsToAdd = Math.min(qty, product.stock);
              for (let i = 0; i < itemsToAdd; i++) {
                if (action.use_points && product.points_price) {
                  // To buy with points, add isReward flag
                  handleAddToCart({ ...product, isReward: true, price: 0 });
                } else {
                  handleAddToCart(product);
                }
              }
            }
          } else if (action.type === 'APPLY_COUPON' && action.coupon_code) {
            if (handleApplyCoupon) {
              handleApplyCoupon(action.coupon_code);
            }
          } else if (action.type === 'REMOVE_FROM_CART' && action.product_id) {
            if (handleRemoveFromCart) {
              for (let i = 0; i < qty; i++) {
                handleRemoveFromCart(action.product_id, action.use_points);
              }
            }
          }
        }
      }

    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `🚨 ${err.message || 'Houve um erro ao me comunicar com o servidor.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="btn-orange"
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              boxShadow: '0px 8px 24px rgba(234, 88, 12, 0.4)',
              zIndex: 2147483647,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}
            onClick={() => setIsOpen(true)}
          >
            🤖
          </motion.button>
        )}
      </AnimatePresence>

      {/* Janela de Conversa */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              width: 'calc(100% - 48px)',
              maxWidth: '360px',
              height: '500px',
              maxHeight: 'calc(100vh - 48px)',
              backgroundColor: 'var(--card)',
              borderRadius: '16px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
              zIndex: 2147483647,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border)'
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px', backgroundColor: 'var(--orange)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🤖</span>
                <strong style={{ fontSize: '16px' }}>Assistente OrderPoint</strong>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? 'var(--orange)' : 'var(--surface)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                  maxWidth: '85%',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  boxShadow: msg.role === 'assistant' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none'
                }}>
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div style={{ alignSelf: 'flex-start', padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--muted)' }} />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--muted)' }} />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', backgroundColor: 'var(--card)' }}>
              <input
                type="text"
                placeholder="Pergunte algo..."
                value={inputVal}
                readOnly={isLoading}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '24px',
                  border: '1px solid var(--border)',
                  outline: 'none',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputVal.trim()}
                style={{
                  backgroundColor: inputVal.trim() && !isLoading ? 'var(--orange)' : 'var(--border)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: inputVal.trim() && !isLoading ? 'pointer' : 'default',
                  transition: 'background-color 0.2s'
                }}
              >
                ↑
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
