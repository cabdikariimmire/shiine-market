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

export * from './database';
export * from '@/lib/auth/types';
export * from '@/lib/calculations/denominations';

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number; // in selling unit (supports decimals e.g. 1.25 kg)
  quantityInput?: string; // string representation during manual typing
  unitPrice: number; // per selling unit
  unitCost: number; // cost per selling unit
  pricing_mode?: 'fixed' | 'denomination';
  sosPrice?: number; // Configured price in SOS for denomination items
  sosTotal?: number; // quantity * sosPrice
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
  receiptHeader: string;
  receiptFooter: string;
  lowStockEmailEnabled: boolean;
  outOfStockEmailEnabled: boolean;
  alertRecipientEmail: string;
  debtOverdueDays: number;
  defaultPurchaseUnit: string;
  defaultSellingUnit: string;
  defaultConversionFactor: number;
  theme: 'light' | 'dark' | 'system';
  language: 'so';
  dateFormat: string;
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
}

export interface ProductSalesReportSummary {
  totalQuantity: number;
  totalSales: number;
  totalPaid: number;
  totalDebt: number;
  totalProfit: number;
  uniqueProductsCount: number;
}
