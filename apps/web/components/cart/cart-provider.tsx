'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'weedtip:cart';

export interface CartItem {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface Cart {
  dispensaryId: string;
  dispensarySlug: string;
  dispensaryName: string;
  items: CartItem[];
}

export interface DispensaryRef {
  id: string;
  slug: string;
  name: string;
}

interface CartContextValue {
  cart: Cart | null;
  count: number;
  subtotalCents: number;
  /**
   * Global kill-switch for consumer ordering/checkout. When false, every
   * ordering CTA (add-to-bag, cart, checkout) hides itself — the site is
   * marketing-only (payment-processor compliant). Sourced from
   * platform_settings.ordering_enabled and passed in from the server layout.
   */
  orderingEnabled: boolean;
  /** Add an item. Switching dispensaries replaces the cart (single-shop carts). */
  addItem: (dispensary: DispensaryRef, item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  /** Slide-out "added to bag" drawer. Opens automatically on addItem. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  orderingEnabled = false,
}: {
  children: ReactNode;
  orderingEnabled?: boolean;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCart(JSON.parse(raw) as Cart);
    } catch {
      /* ignore corrupt cart */
    }
    setHydrated(true);
  }, []);

  // Persist after hydration.
  useEffect(() => {
    if (!hydrated) return;
    if (cart) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    else localStorage.removeItem(STORAGE_KEY);
  }, [cart, hydrated]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const addItem = useCallback<CartContextValue['addItem']>((dispensary, item, qty = 1) => {
    setDrawerOpen(true); // surface the "added to bag" drawer
    setCart((prev) => {
      // Different dispensary → start a fresh cart.
      if (!prev || prev.dispensaryId !== dispensary.id) {
        return {
          dispensaryId: dispensary.id,
          dispensarySlug: dispensary.slug,
          dispensaryName: dispensary.name,
          items: [{ ...item, quantity: qty }],
        };
      }
      const existing = prev.items.find((i) => i.productId === item.productId);
      const items = existing
        ? prev.items.map((i) =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i,
          )
        : [...prev.items, { ...item, quantity: qty }];
      return { ...prev, items };
    });
  }, []);

  const setQuantity = useCallback<CartContextValue['setQuantity']>((productId, quantity) => {
    setCart((prev) => {
      if (!prev) return prev;
      if (quantity <= 0) {
        const items = prev.items.filter((i) => i.productId !== productId);
        return items.length ? { ...prev, items } : null;
      }
      return {
        ...prev,
        items: prev.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
      };
    });
  }, []);

  const removeItem = useCallback<CartContextValue['removeItem']>((productId) => {
    setCart((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((i) => i.productId !== productId);
      return items.length ? { ...prev, items } : null;
    });
  }, []);

  const clear = useCallback(() => setCart(null), []);

  const value = useMemo<CartContextValue>(() => {
    const count = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
    const subtotalCents = cart?.items.reduce((s, i) => s + i.priceCents * i.quantity, 0) ?? 0;
    return {
      cart,
      count,
      subtotalCents,
      orderingEnabled,
      addItem,
      setQuantity,
      removeItem,
      clear,
      drawerOpen,
      openDrawer,
      closeDrawer,
    };
  }, [
    cart,
    orderingEnabled,
    addItem,
    setQuantity,
    removeItem,
    clear,
    drawerOpen,
    openDrawer,
    closeDrawer,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
