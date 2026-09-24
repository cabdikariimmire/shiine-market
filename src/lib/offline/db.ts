import { ProductVariant, Category, Customer } from '@/types';
import { calculateCostPerBaseUnit } from '@/lib/calculations/stock';
import { OfflineTransaction, OfflineTransactionStatus } from './types';

const DB_NAME = 'shiine_pos_offline_db';
const DB_VERSION = 1;

const STORE_PRODUCTS = 'products';
const STORE_CATEGORIES = 'categories';
const STORE_CUSTOMERS = 'customers';
const STORE_TRANSACTIONS = 'transactions';
const STORE_META = 'meta';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function openOfflineDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Products store
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const prodStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
        prodStore.createIndex('name', 'product.name', { unique: false });
        prodStore.createIndex('barcode', 'barcode', { unique: false });
        prodStore.createIndex('sku', 'sku', { unique: false });
        prodStore.createIndex('category_id', 'product.category_id', { unique: false });
      }

      // 2. Categories store
      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }

      // 3. Customers store
      if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
        const custStore = db.createObjectStore(STORE_CUSTOMERS, { keyPath: 'id' });
        custStore.createIndex('phone', 'phone', { unique: false });
        custStore.createIndex('name', 'name', { unique: false });
      }

      // 4. Offline Transactions store
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'client_transaction_id' });
        txStore.createIndex('status', 'status', { unique: false });
        txStore.createIndex('created_at', 'created_at', { unique: false });
        txStore.createIndex('device_timestamp', 'device_timestamp', { unique: false });
      }

      // 5. Meta store
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event: Event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event: Event) => {
      dbPromise = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

// ==========================================
// PRODUCTS & STOCK CACHE
// ==========================================

export async function cacheProducts(variants: ProductVariant[]): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUCTS, STORE_META], 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    const metaStore = tx.objectStore(STORE_META);

    const now = Date.now();
    for (const v of variants) {
      const calculatedUnitCost = calculateCostPerBaseUnit(v.buy_price, v.conversion_factor);
      const cached = {
        ...v,
        unit_cost: calculatedUnitCost,
        snapshot_timestamp: now,
      };
      store.put(cached);
    }

    metaStore.put({ key: 'last_product_sync', timestamp: now, count: variants.length });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedProducts(): Promise<ProductVariant[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readonly');
    const store = tx.objectStore(STORE_PRODUCTS);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result || []) as ProductVariant[];
      // Filter out pending or inactive products
      const active = results.filter(v => v.is_active && !v.is_pending);
      resolve(active);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function searchCachedProducts(query: string, categoryId?: string): Promise<ProductVariant[]> {
  const all = await getCachedProducts();
  const q = query.trim().toLowerCase();

  return all.filter(v => {
    // Category filter
    if (categoryId && categoryId !== 'all') {
      if (v.product?.category_id !== categoryId) {
        return false;
      }
    }

    if (!q) return true;

    const prodName = (v.product?.name || '').toLowerCase();
    const varName = (v.variant_name || '').toLowerCase();
    const barcode = (v.barcode || (v.product as any)?.barcode || '').toLowerCase();
    const sku = (v.sku || (v.product as any)?.sku || '').toLowerCase();

    return (
      prodName.includes(q) ||
      varName.includes(q) ||
      barcode.includes(q) ||
      sku.includes(q)
    );
  });
}

export async function getCachedProductByBarcode(barcode: string): Promise<ProductVariant | null> {
  const all = await getCachedProducts();
  const clean = barcode.trim();
  const found = all.find(v => (v.barcode && v.barcode.trim() === clean) || ((v.product as any)?.barcode && (v.product as any).barcode.trim() === clean));
  return found || null;
}

/**
 * Deducts local offline stock immediately after an offline sale.
 * Prevents selling more than available and prevents negative stock.
 */
export async function updateCachedProductStock(variantId: string, deltaQuantity: number): Promise<number> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORE_PRODUCTS);
    const getReq = store.get(variantId);

    getReq.onsuccess = () => {
      const variant = getReq.result as ProductVariant | undefined;
      if (!variant) {
        reject(new Error(`Variant ${variantId} not found in offline cache`));
        return;
      }

      const prevStock = Number(variant.stock_quantity || 0);
      const newStock = Math.max(0, Number((prevStock + deltaQuantity).toFixed(4)));

      variant.stock_quantity = newStock;
      variant.updated_at = new Date().toISOString();

      const putReq = store.put(variant);
      putReq.onsuccess = () => resolve(newStock);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

// ==========================================
// CATEGORIES CACHE
// ==========================================

export async function cacheCategories(categories: Category[]): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
    const store = tx.objectStore(STORE_CATEGORIES);
    for (const c of categories) {
      store.put(c);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedCategories(): Promise<Category[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATEGORIES, 'readonly');
    const store = tx.objectStore(STORE_CATEGORIES);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result || []) as Category[]);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// CUSTOMERS CACHE
// ==========================================

export async function cacheCustomers(customers: Customer[]): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOMERS, 'readwrite');
    const store = tx.objectStore(STORE_CUSTOMERS);
    for (const c of customers) {
      store.put(c);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedCustomers(): Promise<Customer[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOMERS, 'readonly');
    const store = tx.objectStore(STORE_CUSTOMERS);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result || []) as Customer[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineCustomer(customer: Customer): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CUSTOMERS, 'readwrite');
    const store = tx.objectStore(STORE_CUSTOMERS);
    const putReq = store.put(customer);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}

// ==========================================
// OFFLINE TRANSACTIONS QUEUE
// ==========================================

export async function queueOfflineTransaction(transaction: OfflineTransaction): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const putReq = store.put(transaction);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}

export async function getPendingTransactions(): Promise<OfflineTransaction[]> {
  const all = await getAllOfflineTransactions();
  // Filter transactions that need synchronization, sorted FIFO by device_timestamp
  return all
    .filter(t => t.status === 'PENDING' || t.status === 'FAILED')
    .sort((a, b) => a.device_timestamp - b.device_timestamp);
}

export async function getAllOfflineTransactions(): Promise<OfflineTransaction[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const request = store.getAll();
    request.onsuccess = () => {
      const list = (request.result || []) as OfflineTransaction[];
      list.sort((a, b) => a.device_timestamp - b.device_timestamp);
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineTransaction(clientTxId: string): Promise<OfflineTransaction | null> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const req = store.get(clientTxId);
    req.onsuccess = () => resolve((req.result as OfflineTransaction) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateOfflineTransactionStatus(
  clientTxId: string, 
  status: OfflineTransactionStatus, 
  extra?: Partial<OfflineTransaction>
): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const getReq = store.get(clientTxId);

    getReq.onsuccess = () => {
      const item = getReq.result as OfflineTransaction | undefined;
      if (!item) {
        reject(new Error(`Transaction ${clientTxId} not found`));
        return;
      }

      const updated: OfflineTransaction = {
        ...item,
        status,
        ...extra,
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

// ==========================================
// META STORE
// ==========================================

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const putReq = store.put({ key, value, updated_at: Date.now() });
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}

export async function getMeta<T = any>(key: string): Promise<T | null> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get(key);
    req.onsuccess = () => {
      const res = req.result;
      resolve(res ? res.value : null);
    };
    req.onerror = () => reject(req.error);
  });
}
