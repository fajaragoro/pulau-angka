import type { Account } from '../core/types';

const DB = 'pulau-angka';
const STORE = 'kv';
const KEY = 'account';
const LS_FALLBACK = 'pa_account_fallback';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = t.onabort = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

/** Muat akun dari IndexedDB (cadangan: localStorage bila IndexedDB tidak tersedia). */
export async function loadAccount(): Promise<Account | null> {
  try {
    return ((await tx('readonly', (s) => s.get(KEY))) as Account | undefined) ?? null;
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK);
      return raw ? (JSON.parse(raw) as Account) : null;
    } catch {
      return null;
    }
  }
}

export async function saveAccount(acc: Account): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(acc, KEY));
  } catch {
    try {
      localStorage.setItem(LS_FALLBACK, JSON.stringify(acc));
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }
}

/** Minta browser agar data tidak dihapus otomatis. */
export function requestPersist(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* tidak didukung */
  }
}
