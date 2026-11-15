import type { AccessConfig } from './core/backup';

const env = import.meta.env;

/** Semua konfigurasi yang mudah diganti ada di sini (nilai berasal dari file .env / environment build). */
export const ACCESS: AccessConfig = {
  code: env.VITE_ACCESS_CODE || '3016',
  keepOldUsers: (env.VITE_KEEP_OLD_USERS ?? 'true') !== 'false',
};
export const PAYMENT_URL: string = env.VITE_PAYMENT_URL || 'https://example.com/bayar-pulau-angka';
export const CF_ANALYTICS_TOKEN: string = env.VITE_CF_ANALYTICS_TOKEN || '';
export const PRICE_LABEL = 'Rp97.500';
