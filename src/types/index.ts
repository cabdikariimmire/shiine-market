import { 
  Category, 
  Customer, 
  Debt, 
  DebtPayment, 
  Expense, 
  Product, 
  ProductVariant,
  Sale, 
  SaleItem, 
  StockMovement, 
  Supplier, 
  SupplierTransaction,
  SupplierTransactionItem,
  UnitType,
  PaymentMethod,
  StockMovementType,
  DebtStatus,
  ExpenseCategory,
  CallLog,
  PaginatedResult
} from './database';

import { SystemUser } from '@/lib/auth/types';

export * from './database';
export * from '@/lib/auth/types';
export * from '@/lib/calculations/denominations';

export interface CartItem {
  cartItemId?: string; // unique item identifier in cart
  product: Product;
  variant: ProductVariant;
  quantity: number; // in selling unit (supports decimals e.g. 1.25 kg, 1.25 L, or integer bags)
  quantityInput?: string; // string representation during manual typing
  unitPrice: number; // per selling unit
  unitCost: number; // cost per selling unit
  pricing_mode?: 'fixed' | 'denomination';
  sosPrice?: number | null; // Configured price in SOS for denomination items
  sosTotal?: number; // quantity * sosPrice
  management_mode?: 'standard' | 'pack_based' | 'amount_based';
  selling_method?: 'liter' | 'money'; // 'liter' | 'money'
  actual_quantity_used?: number; // actual liters poured/used for oil
  batch_id?: string; // active batch ID
  selling_option_label?: string; // e.g. '5,000 SOS' or 'Rubac weyn $0.50'
  selling_option_id?: string;
  amount_based_currency?: 'SOS' | 'USD';
  amount_based_value?: number;
  discount: number;
  totalPrice: number;
  grossProfit: number;
}

export interface DashboardMetrics {
  todaySales: number;
  todaySalesCount: number;
  todayCashReceived: number;
  todayNewDebt: number;
  todayDebtPayments: number;
  todayCostOfGoods: number;
  todayGrossProfit: number;
  todayExpenses: number;
  todayNetProfit: number;
  totalProductsCount: number;
  totalVariantsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingProductsCount: number;
  overdueDebtCount: number;
  totalOutstandingDebt: number;
}

export interface SalesReportRow {
  date: string;
  totalSales: number;
  cashSales: number;
  newDebt: number;
  debtPayments: number;
  totalDiscounts: number;
  transactionCount: number;
}

export interface ProfitReportRow {
  date: string;
  salesRevenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  cashReceived: number;
}

export interface ShopSettings {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  currency: string;
  signatureUrl?: string;
  receiptHeader: string;
  receiptFooter: string;
  lowStockEmailEnabled: boolean;
  outOfStockEmailEnabled: boolean;
  alertRecipientEmail: string;
  alertRecipientRoles?: ('admin' | 'seller' | 'reporter')[];
  alertRecipientUserIds?: string[];
  debtOverdueDays: number;
  defaultPurchaseUnit: string;
  defaultSellingUnit: string;
  defaultConversionFactor: number;
  theme: 'light' | 'dark' | 'system';
  language: 'so';
  dateFormat: string;
  users?: SystemUser[];
}

export type ReportDateFilterType = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

export interface ProductSalesReportRow {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sellingUnit: string;
  quantitySold: number;
  totalSales: number;
  totalPaid: number;
  totalDebt: number;
  totalProfit: number;
  transactionCount: number;
}

export interface ProductSaleTransactionDetail {
  saleId: string;
  saleCreatedAt: string;
  customerName?: string;
  paymentMethod: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  paidAmount: number;
  debtAmount: number;
  profit: number;
  selling_method?: 'liter' | 'money' | string;
  selling_option_label?: string;
  actual_quantity_used?: number;
}

export interface ProductSalesReportSummary {
  totalQuantity: number;
  totalSales: number;
  totalPaid: number;
  totalDebt: number;
  totalProfit: number;
  uniqueProductsCount: number;
}

export interface OilBatchReportRow {
  batchId: string;
  batchNumber: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  supplierName?: string;
  receivedDate?: string;
  date?: string;
  containersReceived?: number;
  containersCount?: number;
  containerUnit?: string;
  litersPerContainer?: number;
  litersReceived?: number;
  totalLitersReceived?: number;
  totalLiters?: number;
  totalPurchaseCost: number;
  costPerLiter: number;
  litersSold: number;
  salesRevenue?: number;
  totalSalesRevenue?: number;
  totalRevenue?: number;
  costOfSoldOil?: number;
  costOfOilSold?: number;
  grossProfit?: number;
  grossProfitLoss?: number;
  profitMarginPercent?: number;
  expectedRemainingLiters: number;
  actualRemainingLiters?: number;
  varianceLiters?: number;
  varianceLossCost?: number;
  shrinkageCost?: number;
  status: 'active' | 'reconciled' | 'closed' | 'finished';
  transactionCount?: number;
}

export interface BatchReconciliationPayload {
  batchId?: string;
  batch_id?: string;
  physicalRemaining?: number;
  actual_remaining_liters?: number;
  status?: 'active' | 'reconciled' | 'closed' | 'finished';
  notes?: string;
}

