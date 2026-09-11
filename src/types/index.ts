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
  DetectionResult,
  BoundingBox,
  CallLog,
  PaginatedResult
} from './database';

export * from './database';
export * from '@/lib/auth/types';

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number; // in selling unit (supports decimals e.g. 1.25 kg)
  quantityInput?: string; // string representation during manual typing
  unitPrice: number; // per selling unit
  unitCost: number; // cost per selling unit
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

export interface InvoiceScannedItem {
  id: string;
  productName: string;
  variantName: string;
  quantity: number; // in purchase units
  purchaseUnit: string;
  buyPrice: number; // per purchase unit
  totalCost: number;
  suggestedSellingPrice?: number;
  suggestedSellingUnit?: string;
  suggestedConversionFactor?: number;
  matchedVariantId?: string;
  matchedProductId?: string;
  isExistingProduct: boolean;
  previousBuyPrice?: number;
  previousSellPrice?: number;
  previousStock?: number;
}

export interface InvoiceScanResult {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  items: InvoiceScannedItem[];
  totalAmount: number;
  confidence: number;
  rawOcrText?: string;
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
  aiDetectionConfidenceThreshold: number;
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
