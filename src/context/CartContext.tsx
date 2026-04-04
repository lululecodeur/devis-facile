'use client';

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface CartItem {
  id: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: CartItem) =>
    setItems(prev => [...prev, item]);

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
