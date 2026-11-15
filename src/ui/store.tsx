import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Account, Profile } from '../core/types';
import { newAccount } from '../core/backup';
import { todayStr } from '../core/util';
import { loadAccount, saveAccount } from '../storage/db';
import { setSound } from './sound';

interface Store {
  account: Account;
  update: (fn: (a: Account) => Account) => void;
  updateProfile: (id: string, fn: (p: Profile) => Profile) => void;
}

const Ctx = createContext<Store | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const ref = useRef<Account | null>(null);

  useEffect(() => {
    void loadAccount().then((a) => {
      const acc = a ?? newAccount(todayStr());
      ref.current = acc;
      setSound(acc.settings.sound);
      setAccount(acc);
    });
  }, []);

  const update = useCallback((fn: (a: Account) => Account) => {
    if (!ref.current) return;
    const next = fn(ref.current);
    ref.current = next;
    setSound(next.settings.sound);
    setAccount(next);
    void saveAccount(next);
  }, []);

  const updateProfile = useCallback(
    (id: string, fn: (p: Profile) => Profile) => update((a) => ({ ...a, profiles: a.profiles.map((p) => (p.id === id ? fn(p) : p)) })),
    [update],
  );

  if (!account) return <div className="stack center" style={{ paddingTop: 80 }}>Memuat…</div>;
  return <Ctx.Provider value={{ account, update, updateProfile }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('AccountProvider belum terpasang');
  return s;
}

/* Flag kecil di localStorage (bukan data anak yang penting). */
export const flags = {
  get(key: string): string | null {
    try {
      return localStorage.getItem('pa_' + key);
    } catch {
      return null;
    }
  },
  set(key: string, val: string): void {
    try {
      localStorage.setItem('pa_' + key, val);
    } catch {
      /* abaikan */
    }
  },
};
