import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2, 'Magaca alaabtu waa inuu ka badnaadaa 2 xaraf'),
  sku: z.string().optional().default(''),
  barcode: z.string().optional().default(''),
  category_id: z.string().optional().nullable(),
  supplier_id: z.string().optional().nullable(),
  buy_price: z.number().min(0, 'Qiimaha iibsashada ma noqon karo mid taban'),
  sell_price: z.number().min(0, 'Qiimaha iibinta ma noqon karo mid taban'),
  quantity: z.number().int().default(0),
  minimum_stock: z.number().int().min(0).default(5),
  unit: z.enum(['piece', 'kg', 'bag', 'box', 'bottle', 'carton', 'packet', 'xabo', 'kartoon', 'kiish', 'liter', 'dhalo']).default('xabo'),
  image_url: z.string().optional().default(''),
  description: z.string().optional().default(''),
  is_active: z.boolean().default(true),
}).refine(data => data.sell_price >= data.buy_price, {
  message: 'Qiimaha iibinta waa inuu ka sarreeyaa ama la siman yahay qiimaha iibsashada',
  path: ['sell_price'],
});

export const categorySchema = z.object({
  name: z.string().min(2, 'Magaca qaybtu waa inuu ka badnaadaa 2 xaraf'),
  description: z.string().optional().default(''),
  icon: z.string().optional().default('Package'),
});

export const supplierSchema = z.object({
  name: z.string().min(2, 'Magaca shirkadda/qofka waa inuu jiraa'),
  phone: z.string().min(5, 'Fadlan geli lambar taleefan oo sax ah'),
  address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const customerSchema = z.object({
  name: z.string().min(2, 'Magaca macmiilka waa inuu jiraa'),
  phone: z.string().min(5, 'Fadlan geli lambar taleefan oo sax ah'),
  address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const expenseSchema = z.object({
  category: z.enum([
    'electricity', 'transport', 'rent', 'salary', 'water', 'maintenance', 'other',
    'koronto', 'gaadiid', 'kiro', 'mushahar', 'biyo', 'dayactir', 'kale'
  ]),
  amount: z.number().positive('Cadadka kharashka waa inuu ka waynaadaa 0'),
  description: z.string().min(3, 'Faahfaahin ku qor kharashka'),
  date: z.string().min(10, 'Taariikhda kharashka geli'),
});

export const purchaseItemSchema = z.object({
  product_id: z.string().min(1, 'Dooro alaabta'),
  quantity: z.number().int().positive('Tirada waa inay ka waynaataa 0'),
  buy_price: z.number().min(0, 'Qiimaha ma noqon karo taban'),
  total_cost: z.number().min(0),
});

export const purchaseSchema = z.object({
  supplier_id: z.string().optional().nullable(),
  notes: z.string().optional().default(''),
  items: z.array(purchaseItemSchema).min(1, 'Ku dar ugu yaraan hal alaab'),
});

export const saleItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  unit_cost: z.number().min(0),
  discount: z.number().min(0).default(0),
  total_price: z.number().min(0),
  gross_profit: z.number(),
});

export const saleSchema = z.object({
  customer_id: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, 'Geli alaab dambiisha'),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  amount_paid: z.number().min(0),
  debt_amount: z.number().min(0),
  payment_method: z.enum(['cash', 'credit', 'partial']),
  notes: z.string().optional().default(''),
});

export const debtPaymentSchema = z.object({
  customer_id: z.string().min(1, 'Dooro macmiilka'),
  debt_id: z.string().optional().nullable(),
  amount: z.number().positive('Lacagta la bixinayo waa inay ka weynaataa 0'),
  payment_method: z.enum(['cash', 'evc_plus', 'zaad', 'sahal', 'bank']).default('cash'),
  notes: z.string().optional().default(''),
});

export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;
