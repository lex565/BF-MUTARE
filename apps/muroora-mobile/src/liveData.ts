import { useEffect, useState } from 'react';

import { API_BASE } from './mobileApi';
import { supabase } from './supabase';
import type { Product } from './CustomerFlow';

/**
 * Real data, or nothing.
 *
 * The app shipped with an invented catalogue, an invented order called
 * "Groceries for Mom", invented saved addresses and an invented rider. On a
 * tester's phone none of that is distinguishable from the real thing, so the
 * first person to try it would have believed the shop was stocked and that an
 * order of theirs was on its way to Dangamvura.
 *
 * Everything here comes from the same endpoints the website uses. Where the
 * shop genuinely has nothing yet, the screen says so. An empty shelf is a true
 * statement about a shop that has not been stocked; a fake one is not.
 */

/** Colours and emoji, chosen from the product's own category. */
const LOOK: Record<string, { icon: string; tint: string }> = {
  'basic-groceries': { icon: '🌽', tint: '#F4E6B7' },
  'packaged-food-drink': { icon: '🥫', tint: '#F3DDC0' },
  'cleaning-supplies': { icon: '🧴', tint: '#DDE7D7' },
  'personal-care': { icon: '🧼', tint: '#F4D3CA' },
  'baby-products': { icon: '🍼', tint: '#E8E2F2' },
  'household-essentials': { icon: '🕯️', tint: '#F6E0A8' },
};
const FALLBACK = { icon: '🛒', tint: '#F7F3E9' };

type WireProduct = {
  id: string;
  name: string;
  slug: string;
  unitSize: string | null;
  description: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  price: { amount: string; currency: string; decimal: string };
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
};

export type LiveState<T> = { loading: boolean; error: string | null; data: T };

/**
 * The catalogue, from the same endpoint the website reads.
 *
 * Ids are numbered on arrival because the rest of the app keys its cart by
 * number. The real uuid is kept alongside so an order can name the actual
 * product rather than a position in a list.
 */
export function useProducts(): LiveState<Product[]> & { uuidFor: (id: number) => string | undefined } {
  const [state, setState] = useState<LiveState<Product[]>>({ loading: true, error: null, data: [] });
  const [uuids, setUuids] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/products`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((body: { data?: WireProduct[]; error?: { message: string } }) => {
        if (cancelled) return;
        if (body.error) {
          setState({ loading: false, error: body.error.message, data: [] });
          return;
        }
        const rows = body.data ?? [];
        const map: Record<number, string> = {};
        const products: Product[] = rows.map((row, index) => {
          const id = index + 1;
          map[id] = row.id;
          const look = LOOK[row.categorySlug ?? ''] ?? FALLBACK;
          return {
            id,
            name: row.name,
            detail: row.unitSize ?? '',
            price: Number(row.price.decimal),
            icon: look.icon,
            tint: look.tint,
            category: (row.categoryName ?? 'Pantry') as Product['category'],
            description: row.description ?? '',
          };
        });
        setUuids(map);
        setState({ loading: false, error: null, data: products });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            loading: false,
            error: 'Could not reach the shop. Check your connection and try again.',
            data: [],
          });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return { ...state, uuidFor: (id: number) => uuids[id] };
}

export type LiveOrder = {
  orderNumber: string;
  status: string;
  label: string;
  blurb: string;
  recipientName: string;
  deliverySuburb: string;
  itemCount: number;
  total: string;
  placedAt: string | null;
};

/**
 * The signed-in person's own orders.
 *
 * Returns an empty list when nobody is signed in, rather than inventing a
 * delivery. There is no such thing as a guest's order history on a phone: the
 * server has no way to know who is asking.
 */
export function useMyOrders(): LiveState<LiveOrder[]> & { signedIn: boolean } {
  const [state, setState] = useState<LiveState<LiveOrder[]>>({ loading: true, error: null, data: [] });
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!supabase) {
        if (!cancelled) setState({ loading: false, error: null, data: [] });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        setSignedIn(false);
        setState({ loading: false, error: null, data: [] });
        return;
      }
      setSignedIn(true);

      try {
        const response = await fetch(`${API_BASE}/api/orders`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = await response.json();
        if (cancelled) return;

        if (body.error) {
          setState({ loading: false, error: body.error.message, data: [] });
          return;
        }

        setState({
          loading: false,
          error: null,
          data: (body.data?.orders ?? []).map((o: {
            orderNumber: string; status: string;
            customerStatus: { label: string; blurb: string };
            recipientName: string; deliverySuburb: string; itemCount: number;
            total: { decimal: string; currency: string }; placedAt: string | null;
          }) => ({
            orderNumber: o.orderNumber,
            status: o.status,
            label: o.customerStatus.label,
            blurb: o.customerStatus.blurb,
            recipientName: o.recipientName,
            deliverySuburb: o.deliverySuburb,
            itemCount: o.itemCount,
            total: `${o.total.currency === 'USD' ? '$' : ''}${o.total.decimal}`,
            placedAt: o.placedAt,
          })),
        });
      } catch {
        if (!cancelled) {
          setState({ loading: false, error: 'Could not load your orders.', data: [] });
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  return { ...state, signedIn };
}
