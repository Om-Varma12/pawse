import Store from 'electron-store';

const StoreClass = ((Store as any).default || Store) as typeof Store;
export const store = new StoreClass();
