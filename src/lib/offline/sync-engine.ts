import { repository } from '@/lib/services/repository';
import { 
  getPendingTransactions, 
  getAllOfflineTransactions, 
  updateOfflineTransactionStatus, 
  cacheProducts, 
  cacheCategories, 
  cacheCustomers,
  isIndexedDBAvailable 
} from './db';
import { OfflineTransaction, SyncStateSummary } from './types';
import { CartItem } from '@/types';

type SyncListener = (state: SyncEngineState) => void;

export interface SyncEngineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  syncedCount: number;
  lastSyncTime: number | null;
  syncState: SyncStateSummary;
  lastError: string | null;
}

class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private pendingCount: number = 0;
  private conflictCount: number = 0;
  private syncedCount: number = 0;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', () => {
        console.log('[SyncEngine] Internet ku soo laabtay (Online). Bilaabaya sync...');
        this.isOnline = true;
        this.notify();
        this.syncPendingTransactions();
      });

      window.addEventListener('offline', () => {
        console.log('[SyncEngine] Internet-kii wuu go\'ay (Offline).');
        this.isOnline = false;
        this.notify();
      });

      // Refresh counts on init
      this.refreshCounts();

      // Check every 30 seconds if online and pending items exist
      this.autoSyncInterval = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.refreshCounts().then(() => {
            if (this.pendingCount > 0) {
              this.syncPendingTransactions();
            }
          });
        }
      }, 30000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SyncEngineState {
    let syncState: SyncStateSummary = 'ONLINE';
    if (!this.isOnline) {
      syncState = 'OFFLINE';
    } else if (this.isSyncing) {
      syncState = 'SYNCING';
    } else if (this.conflictCount > 0) {
      syncState = 'CONFLICT';
    } else if (this.pendingCount > 0) {
      syncState = 'ONLINE';
    } else if (this.lastError) {
      syncState = 'ERROR';
    } else {
      syncState = 'SYNCED';
    }

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      conflictCount: this.conflictCount,
      syncedCount: this.syncedCount,
      lastSyncTime: this.lastSyncTime,
      syncState,
      lastError: this.lastError,
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('[SyncEngine] Listener error:', e);
      }
    });
  }

  public async refreshCounts(): Promise<void> {
    if (!isIndexedDBAvailable()) return;
    try {
      const all = await getAllOfflineTransactions();
      this.pendingCount = all.filter(t => t.status === 'PENDING' || t.status === 'FAILED').length;
      this.conflictCount = all.filter(t => t.status === 'CONFLICT').length;
      this.syncedCount = all.filter(t => t.status === 'SYNCED').length;
      this.notify();
    } catch (e) {
      console.warn('[SyncEngine] Failed to refresh counts:', e);
    }
  }

  /**
   * Main synchronization routine:
   * 1. Fetches pending transactions
   * 2. Sorts deterministically by timestamp (FIFO)
   * 3. Sends each with client_transaction_id for idempotency
   * 4. Updates status in IndexedDB
   * 5. Refreshes local product dataset from server
   */
  public async syncPendingTransactions(): Promise<{ synced: number; conflicts: number; failed: number }> {
    if (!isIndexedDBAvailable() || this.isSyncing) {
      return { synced: 0, conflicts: 0, failed: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      this.notify();
      return { synced: 0, conflicts: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    try {
      const pending = await getPendingTransactions();

      for (const tx of pending) {
        // Mark as SYNCING in IndexedDB
        await updateOfflineTransactionStatus(tx.client_transaction_id, 'SYNCING');
        this.notify();

        try {
          // Reconstruct CartItems from offline items
          const reconstructedCartItems: CartItem[] = tx.items.map(item => ({
            cartItemId: `${item.variant_id}_${tx.client_transaction_id}`,
            product: {
              id: item.product_id,
              name: item.product_name,
              created_at: tx.created_at,
              updated_at: tx.created_at,
            },
            variant: {
              id: item.variant_id,
              product_id: item.product_id,
              variant_name: item.variant_name,
              stock_quantity: 999999, // Server will validate actual authoritative stock
              sell_price: item.unit_price,
              buy_price: item.unit_cost,
              unit_cost: item.unit_cost, // preserve exact offline cost snapshot
              minimum_stock: 0,
              selling_unit: item.unit,
              purchase_unit: item.unit,
              conversion_factor: 1,
              is_active: true,
              pricing_mode: item.pricing_mode as any,
              sos_price: item.sos_price ?? undefined,
              selling_method: item.selling_method as any,
              selling_option_label: item.selling_option_label,
              created_at: tx.created_at,
              updated_at: tx.created_at,
            },
            quantity: item.quantity,
            unitPrice: item.unit_price,
            unitCost: item.unit_cost,
            discount: item.discount,
            totalPrice: item.total_price,
            grossProfit: item.gross_profit,
            pricing_mode: item.pricing_mode as any,
            sosPrice: item.sos_price,
            actual_quantity_used: item.actual_quantity_used,
            selling_method: item.selling_method as any,
            selling_option_label: item.selling_option_label,
          }));

          // Send to server with idempotency key
          const createdSale = await repository.executeSale({
            clientTransactionId: tx.client_transaction_id,
            cartItems: reconstructedCartItems,
            paymentMethod: tx.payment_method,
            overallDiscount: tx.discount,
            amountPaid: tx.amount_paid,
            customerId: tx.customer_id || undefined,
            newCustomer: (!tx.customer_id && tx.customer_snapshot?.name && tx.customer_snapshot?.phone)
              ? { name: tx.customer_snapshot.name, phone: tx.customer_snapshot.phone }
              : undefined,
            dueDate: tx.due_date || undefined,
            notes: tx.notes || `Offline POS Sale (Synced)`,
          });

          // Mark as SYNCED
          await updateOfflineTransactionStatus(tx.client_transaction_id, 'SYNCED', {
            synced_at: new Date().toISOString(),
            server_sale_id: createdSale.id,
            last_sync_error: null,
          });
          syncedCount++;
        } catch (err: any) {
          const errMsg = err?.message || String(err);

          // Check if this error is a stock conflict
          if (errMsg.includes('Stock-ka ayaa is beddelay') || errMsg.includes('Stock-ga kuma filna')) {
            console.error('[SyncEngine] Stock conflict during sync for tx:', tx.client_transaction_id, errMsg);
            await updateOfflineTransactionStatus(tx.client_transaction_id, 'CONFLICT', {
              last_sync_error: errMsg,
            });
            conflictCount++;
          } else {
            console.error('[SyncEngine] Sync error for tx:', tx.client_transaction_id, errMsg);
            await updateOfflineTransactionStatus(tx.client_transaction_id, 'FAILED', {
              retry_count: (tx.retry_count || 0) + 1,
              last_sync_error: errMsg,
            });
            failedCount++;
          }
        }
      }

      this.lastSyncTime = Date.now();

      // Refresh authoritative product and category dataset from server
      try {
        const [prodRes, catRes, custRes] = await Promise.all([
          repository.getVariantsPaginated('', 'all', 'all', 1, 1000),
          repository.getCategories(),
          repository.getCustomers(),
        ]);
        if (prodRes?.data) {
          await cacheProducts(prodRes.data.filter(v => !v.is_pending));
        }
        if (catRes) {
          await cacheCategories(catRes);
        }
        if (custRes) {
          await cacheCustomers(custRes);
        }
      } catch (cacheRefreshErr) {
        console.warn('[SyncEngine] Background cache refresh skipped:', cacheRefreshErr);
      }

    } catch (e: any) {
      this.lastError = e?.message || String(e);
      console.error('[SyncEngine] Major sync loop error:', e);
    } finally {
      this.isSyncing = false;
      await this.refreshCounts();
    }

    return { synced: syncedCount, conflicts: conflictCount, failed: failedCount };
  }
}

export const syncEngine = new SyncEngine();
