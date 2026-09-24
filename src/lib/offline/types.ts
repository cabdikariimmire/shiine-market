import { PaymentMethod } from '@/types';

export type OfflineTransactionStatus = 
  | 'PENDING' 
  | 'SYNCING' 
  | 'SYNCED' 
  | 'CONFLICT' 
  | 'FAILED';

export interface OfflineSaleItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  unit_cost: number; // exact cost snapshot valid at sale time
  discount: number;
  total_price: number;
  gross_profit: number;
  pricing_mode: string;
  sos_price?: number | null;
  actual_quantity_used?: number;
  selling_method?: string;
  selling_option_label?: string;
}

export interface OfflineCustomerSnapshot {
  id?: string;
  name?: string;
  phone?: string;
}

export interface OfflineTransaction {
  client_transaction_id: string; // globally unique UUID
  shop_id: string | null;
  seller_id: string | null;
  created_at: string; // ISO string
  device_timestamp: number; // millisecond timestamp for deterministic FIFO sync
  payment_method: PaymentMethod;
  amount_paid: number;
  debt_amount: number;
  due_date: string | null;
  subtotal: number;
  discount: number;
  total_amount: number;
  cost_amount: number;
  gross_profit: number;
  notes: string | null;
  customer_id: string | null;
  customer_snapshot: OfflineCustomerSnapshot | null;
  items: OfflineSaleItem[];
  status: OfflineTransactionStatus;
  retry_count: number;
  last_sync_error: string | null;
  synced_at: string | null;
  server_sale_id: string | null;
}

export interface CachedVariant {
  id: string;
  product_id: string;
  variant_name: string;
  stock_quantity: number;
  sell_price: number;
  buy_price: number;
  unit_cost: number;
  minimum_stock: number;
  selling_unit: string;
  conversion_factor: number;
  is_active: boolean;
  is_pending?: boolean;
  sku?: string;
  barcode?: string;
  management_mode?: 'normal' | 'pack_based' | 'measured' | 'amount_based';
  pack_configuration?: any;
  measured_configuration?: any;
  selling_options?: any[];
  pricing_mode?: 'fixed' | 'denomination';
  sos_price?: number;
  product: {
    id: string;
    name: string;
    category_id: string;
    sku?: string;
    barcode?: string;
  };
  snapshot_timestamp: number;
}

export type SyncStateSummary = 
  | 'ONLINE' 
  | 'OFFLINE' 
  | 'SYNCING' 
  | 'SYNCED' 
  | 'CONFLICT' 
  | 'ERROR';
