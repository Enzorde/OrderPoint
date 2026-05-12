import React from 'react';

// Padrões de Projeto

// ---------------------------------------------------------
// 1. OBSERVER PATTERN (Melhorado para um EventBus)
// Permite que componentes assinem e reajam a múltiplos eventos globais 
// garantindo baixo acoplamento.
// ---------------------------------------------------------

export type Listener<T> = (data: T) => void;

export class EventBus {
  private listeners: { [event: string]: Listener<any>[] } = {};

  subscribe<T>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    
    // Retorna função para fazer o unsubscribe
    return () => {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    };
  }

  publish<T>(event: string, data: T): void {
    const eventListeners = this.listeners[event] || [];
    eventListeners.forEach(listener => listener(data));
  }
}

// Instância Global do EventBus
export const globalEventBus = new EventBus();

export const showToast = (msg: string) => {
  globalEventBus.publish('TOAST_NOTIFICATION', msg);
};

// ---------------------------------------------------------
// 2. STRATEGY PATTERN & SOLID (OCP, SRP, DIP)
// Permite adicionar novos comportamentos baseados em status de pedido
// sem precisar alterar estruturas antigas com diversos if/else (Open/Closed).
// ---------------------------------------------------------

export interface GestorCallbacks {
  updateOrderStatus: (id: number, status: string, cancelReason?: string) => void;
  setDeleteOrderConfirmId: (id: number) => void;
  promptCancelReason?: (id: number) => void;
}

export interface OrderActionConfig {
  tag: { text: string; style?: React.CSSProperties; className?: string };
  buttons?: { label: string; className: string; action: () => void }[];
}

// Interface (Contrato/DIP) para o Strategy
export interface OrderStatusStrategy {
  getText(): string;
  getStyles(): { background?: string; color?: string; className?: string };
  getActions(orderId: number, callbacks: GestorCallbacks): OrderActionConfig | null;
}

export class StatusAguardando implements OrderStatusStrategy {
  getText() { return '⏳ Aguardando Cantina'; }
  getStyles() { return { background: 'var(--primary-soft)', color: 'var(--primary)' }; }
  getActions(orderId: number, callbacks: GestorCallbacks): OrderActionConfig {
    return {
      tag: { text: 'Aguardando', style: { background: 'var(--primary-soft)', color: 'var(--primary)' } },
      buttons: [
        { label: 'Aceitar', className: 'btn-orange btn-sm', action: () => callbacks.updateOrderStatus(orderId, 'preparo') },
        { label: 'Recusar', className: 'btn-danger btn-sm', action: () => callbacks.promptCancelReason ? callbacks.promptCancelReason(orderId) : callbacks.updateOrderStatus(orderId, 'cancelado') }
      ]
    };
  }
}

export class StatusPreparo implements OrderStatusStrategy {
  getText() { return '👨‍🍳 Em Preparo'; }
  getStyles() { return { background: 'var(--orange-soft)', color: 'var(--orange)' }; }
  getActions(orderId: number, callbacks: GestorCallbacks): OrderActionConfig {
    return {
      tag: { text: 'Em Preparo', className: 'tag-orange' },
      buttons: [
        { label: 'Pronto!', className: 'btn-success btn-sm', action: () => callbacks.updateOrderStatus(orderId, 'pronto') },
        { label: 'Cancelar', className: 'btn-danger btn-sm', action: () => callbacks.promptCancelReason ? callbacks.promptCancelReason(orderId) : callbacks.updateOrderStatus(orderId, 'cancelado') }
      ]
    };
  }
}

export class StatusPronto implements OrderStatusStrategy {
  getText() { return '🔔 Pronto para Retirada'; }
  getStyles() { return { background: 'var(--success-soft)', color: 'var(--success)' }; }
  getActions(orderId: number, callbacks: GestorCallbacks): OrderActionConfig {
    return {
      tag: { text: 'Pronto para Retirada', className: 'tag-success' },
      buttons: [
        { label: 'Marcar como Retirado', className: 'btn-success btn-sm', action: () => callbacks.updateOrderStatus(orderId, 'retirado') }
      ]
    };
  }
}

export class StatusRetirado implements OrderStatusStrategy {
  getText() { return '✅ Retirado'; }
  getStyles() { return { background: 'var(--card)', color: 'var(--muted)' }; }
  getActions(orderId: number, callbacks: GestorCallbacks): OrderActionConfig {
    return {
      tag: { text: 'Retirado', style: { background: 'var(--card)', color: 'var(--muted)' } },
      buttons: [
        { label: 'Excluir', className: 'btn-danger btn-sm', action: () => callbacks.setDeleteOrderConfirmId(orderId) }
      ]
    };
  }
}

export class StatusCancelado implements OrderStatusStrategy {
  getText() { return '❌ Cancelado'; }
  getStyles() { return { background: 'var(--danger-soft)', color: 'var(--danger)' }; }
  getActions(orderId: number, callbacks: GestorCallbacks): OrderActionConfig {
    return {
      tag: { text: 'Cancelado', className: 'tag-danger' },
      buttons: [
        { label: 'Excluir', className: 'btn-danger btn-sm', action: () => callbacks.setDeleteOrderConfirmId(orderId) }
      ]
    };
  }
}

export class StatusOutro implements OrderStatusStrategy {
  constructor(private status: string) {}
  getText() { return this.status; }
  getStyles() { return {}; }
  getActions() { return null; }
}

// ---------------------------------------------------------
// Padrão FACTORY (Para centralizar e delegar a criação das estratégias)
// ---------------------------------------------------------
export class OrderStatusFactory {
  static createStrategy(status: string): OrderStatusStrategy {
    switch (status) {
      case 'aguardando': return new StatusAguardando();
      case 'preparo': return new StatusPreparo();
      case 'pronto': return new StatusPronto();
      case 'retirado': return new StatusRetirado();
      case 'cancelado': return new StatusCancelado();
      default: return new StatusOutro(status);
    }
  }
}

// ---------------------------------------------------------
// 3. SRP & DIP (Single Responsibility / Dependency Inversion)
// Interface segregada para gerenciar carrinho
// ---------------------------------------------------------
export interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  emoji?: string;
  canteen_id?: number;
  isReward?: boolean;
  points_price?: number;
}
