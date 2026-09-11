import { 
  Category, 
  Customer, 
  Debt, 
  DebtPayment, 
  Expense, 
  ExpenseCategory,
  Product, 
  ProductVariant, 
  Sale, 
  SaleItem, 
  StockMovement, 
  Supplier, 
  SupplierTransaction,
  SupplierTransactionItem,
  CartItem,
  DashboardMetrics,
  SalesReportRow,
  ProfitReportRow,
  ShopSettings,
  PaginatedResult,
  SystemUser,
  UserRole,
  UserStatus,
  AuditLog,
  SaleCorrectionPayload,
  SupplierTransactionCorrectionPayload,
  DebtCorrectionPayload,
  DebtPaymentCorrectionPayload,
  StockAdjustmentPayload,
  PaymentMethod,
  InvoiceScanResult,
  ProductSalesReportRow,
  ProductSaleTransactionDetail,
  ProductSalesReportSummary,
  ReportDateFilterType
} from '@/types';
import { calculateCostPerBaseUnit, calculateMinSellableQty } from '@/lib/calculations/stock';
import { generateId } from '@/lib/utils';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from '@/lib/supabase/client';

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Tukaan Shiine Supermarket',
  shopPhone: '+252 61 5500112',
  shopAddress: 'Suuqa Bakaaraha, Mogadishu',
  currency: '$',
  receiptHeader: 'TUAKAAN SHIINE POS',
  receiptFooter: 'Mahadsanid! Soo Dhawoow Mar Kale.',
  lowStockEmailEnabled: true,
  outOfStockEmailEnabled: true,
  alertRecipientEmail: 'admin@tukaanshiine.so',
  debtOverdueDays: 7,
  defaultPurchaseUnit: 'jawan',
  defaultSellingUnit: 'kg',
  defaultConversionFactor: 50,
  aiDetectionConfidenceThreshold: 75,
  theme: 'light',
  language: 'so',
  dateFormat: 'DD/MM/YYYY',
};

class ShopRepository {
  // ==========================================
  // AUTHENTICATION & ROLE ACCESS CONTROL
  // ==========================================
  public async getCurrentUser(): Promise<SystemUser | null> {
    try {
      if (!isSupabaseConfigured) return null;
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;

      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 3500)
      );

      const { data: profile } = await Promise.race([profilePromise, timeoutPromise]);

      const roleStr = String(profile?.role || user.user_metadata?.role || '').toLowerCase();
      const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');

      return {
        id: user.id,
        name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        role,
        status: 'active',
        created_at: profile?.created_at || user.created_at,
      };
    } catch (e) {
      console.warn('Error fetching current user:', e);
      return null;
    }
  }

  public async checkAdminAuth(actionName: string): Promise<SystemUser> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Fadlan marka hore gal nidaamka (Not Authenticated)');
    }
    if (user.role === 'seller') {
      throw new Error(`Hawshan (${actionName}) waxaa u fasaxan kaliya Maamulaha (Admin). Seller / Iibiye wuxuu galayaa kaliya POS / Iibka.`);
    }
    if (user.role === 'reporter') {
      throw new Error(`Hawshan (${actionName}) waxaa u fasaxan kaliya Maamulaha (Admin). Reporter waa Akhris-Kaliya (Read-Only).`);
    }
    if (user.role !== 'admin') {
      throw new Error(`Hawshan (${actionName}) waxaa u fasaxan kaliya Maamulaha (Admin).`);
    }
    if (user.status !== 'active') {
      throw new Error('Koontadaadu ma firfircoona (Inactive)');
    }
    return user;
  }

  // ==========================================
  // AUDIT LOGGING (Persisted in Supabase)
  // ==========================================
  public async recordAuditLog(
    action: string,
    entityType: string,
    entityId?: string,
    previousValues?: Record<string, any>,
    newValues?: Record<string, any>,
    reason?: string
  ): Promise<AuditLog> {
    const currentUser = await this.getCurrentUser();
    const log: AuditLog = {
      id: generateId(),
      user_id: currentUser?.id,
      user_name: currentUser?.name || 'Admin',
      user_role: currentUser?.role || 'admin',
      action,
      entity_type: entityType,
      entity_id: entityId,
      previous_values: previousValues,
      new_values: newValues,
      reason: reason || 'Wax ka beddel / Sixid toos ah',
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from('audit_logs').insert([{
        id: log.id,
        user_id: log.user_id,
        user_name: log.user_name,
        user_role: log.user_role,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        previous_values: log.previous_values,
        new_values: log.new_values,
        reason: log.reason,
        created_at: log.created_at,
      }]);
    } catch (err) {
      console.warn('Audit log write catch:', err);
    }

    return log;
  }

  public async getAuditLogs(
    search: string = '', 
    entityFilter: string = 'all', 
    actionFilter: string = 'all',
    page: number = 1,
    pageSize: number = 50
  ): Promise<AuditLog[]> {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (entityFilter && entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter);
    }

    if (actionFilter && actionFilter !== 'all') {
      query = query.ilike('action', `%${actionFilter}%`);
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`user_name.ilike.${q},action.ilike.${q},reason.ilike.${q},entity_type.ilike.${q}`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching audit logs:', error.message);
      return [];
    }
    return (data || []) as AuditLog[];
  }

  // ==========================================
  // SETTINGS & SHOPS
  // ==========================================
  public async getSettings(): Promise<ShopSettings> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return { ...DEFAULT_SETTINGS };
      }

      return {
        shopName: data.name || DEFAULT_SETTINGS.shopName,
        shopPhone: data.phone || DEFAULT_SETTINGS.shopPhone,
        shopAddress: data.address || DEFAULT_SETTINGS.shopAddress,
        currency: data.currency || DEFAULT_SETTINGS.currency,
        receiptHeader: DEFAULT_SETTINGS.receiptHeader,
        receiptFooter: DEFAULT_SETTINGS.receiptFooter,
        lowStockEmailEnabled: true,
        outOfStockEmailEnabled: true,
        alertRecipientEmail: DEFAULT_SETTINGS.alertRecipientEmail,
        debtOverdueDays: 7,
        defaultPurchaseUnit: DEFAULT_SETTINGS.defaultPurchaseUnit,
        defaultSellingUnit: DEFAULT_SETTINGS.defaultSellingUnit,
        defaultConversionFactor: 50,
        aiDetectionConfidenceThreshold: 75,
        theme: 'light',
        language: 'so',
        dateFormat: 'DD/MM/YYYY',
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  public async updateSettings(updates: Partial<ShopSettings>, reason?: string): Promise<ShopSettings> {
    await this.checkAdminAuth('Wax ka beddelka Habaynta (Settings)');

    const current = await this.getSettings();
    const updated = { ...current, ...updates };

    const { data: existingShop } = await supabase.from('shops').select('id').limit(1).maybeSingle();

    if (existingShop) {
      await supabase.from('shops').update({
        name: updated.shopName,
        phone: updated.shopPhone,
        address: updated.shopAddress,
        currency: updated.currency,
        updated_at: new Date().toISOString(),
      }).eq('id', existingShop.id);
    } else {
      await supabase.from('shops').insert([{
        name: updated.shopName,
        phone: updated.shopPhone,
        address: updated.shopAddress,
        currency: updated.currency,
      }]);
    }

    await this.recordAuditLog(
      'EDIT_SETTINGS',
      'settings',
      existingShop?.id || 'shop_settings',
      current,
      updated,
      reason || 'Cusbooneysiin habaynta dukaanka'
    );

    return updated;
  }

  // ==========================================
  // CATEGORIES
  // ==========================================
  public async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*, products:products(count)')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error.message);
      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      shop_id: c.shop_id,
      name: c.name,
      description: c.description,
      icon: c.icon || 'Package',
      created_at: c.created_at,
      _count: {
        products: c.products?.[0]?.count || 0,
        variants: c.products?.[0]?.count || 0,
      }
    }));
  }

  public async createCategory(data: { name: string; description?: string; icon?: string }, reason?: string): Promise<Category> {
    await this.checkAdminAuth('Ku darid Qayb Cusub');

    const newCat = {
      id: generateId(),
      name: data.name.trim(),
      description: data.description || null,
      icon: data.icon || 'Package',
      created_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabase
      .from('categories')
      .insert([newCat])
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad qaybta: ${error.message}`);
    }

    await this.recordAuditLog(
      'CREATE_CATEGORY',
      'category',
      created.id,
      undefined,
      created,
      reason || `Abuuris Qayb: ${created.name}`
    );

    return {
      ...created,
      _count: { products: 0, variants: 0 }
    };
  }

  public async updateCategory(id: string, updates: Partial<Category>, reason?: string): Promise<Category> {
    await this.checkAdminAuth('Wax ka beddel Qayb');

    const { data: prev } = await supabase.from('categories').select('*').eq('id', id).single();

    const { data: updated, error } = await supabase
      .from('categories')
      .update({
        name: updates.name?.trim() || prev?.name,
        description: updates.description !== undefined ? updates.description : prev?.description,
        icon: updates.icon || prev?.icon,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad beddelka qaybta: ${error.message}`);
    }

    await this.recordAuditLog(
      'EDIT_CATEGORY',
      'category',
      id,
      prev,
      updated,
      reason || `Wax ka beddel Qayb: ${updated.name}`
    );

    return updated;
  }

  public async deleteCategory(id: string, reason?: string): Promise<void> {
    await this.checkAdminAuth('Tirtirid Qayb');

    const { data: prev } = await supabase.from('categories').select('*').eq('id', id).single();
    const { error } = await supabase.from('categories').delete().eq('id', id);

    if (error) {
      throw new Error(`Lama tirtiri karo qaybta: ${error.message}`);
    }

    await this.recordAuditLog(
      'DELETE_CATEGORY',
      'category',
      id,
      prev,
      undefined,
      reason || `Tirtirid Qayb: ${prev?.name || id}`
    );
  }

  // ==========================================
  // SUPPLIERS
  // ==========================================
  public async getSuppliers(search?: string): Promise<Supplier[]> {
    let query = supabase.from('suppliers').select('*').order('name');
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`name.ilike.${q},phone.ilike.${q},company.ilike.${q}`);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching suppliers:', error.message);
      return [];
    }
    return (data || []) as Supplier[];
  }

  public async getSupplierById(id: string): Promise<Supplier | null> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Supplier;
  }

  public async createSupplier(data: { name: string; phone: string; company?: string; address?: string; notes?: string }, reason?: string): Promise<Supplier> {
    await this.checkAdminAuth('Ku darid Qeybiye Cusub');

    const newSupp = {
      id: generateId(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      company: data.company?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabase
      .from('suppliers')
      .insert([newSupp])
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad qeybiye: ${error.message}`);
    }

    await this.recordAuditLog(
      'CREATE_SUPPLIER',
      'supplier',
      created.id,
      undefined,
      created,
      reason || `Abuuris Qeybiye: ${created.name}`
    );

    return created as Supplier;
  }

  public async updateSupplier(id: string, updates: Partial<Supplier>, reason?: string): Promise<Supplier> {
    await this.checkAdminAuth('Wax ka beddel Qeybiye');

    const { data: prev } = await supabase.from('suppliers').select('*').eq('id', id).single();

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad beddelka qeybiye: ${error.message}`);
    }

    await this.recordAuditLog(
      'EDIT_SUPPLIER',
      'supplier',
      id,
      prev,
      updated,
      reason || `Wax ka beddel Qeybiye: ${updated.name}`
    );

    return updated as Supplier;
  }

  public async deleteSupplier(id: string, reason?: string): Promise<void> {
    await this.checkAdminAuth('Tirtirid Qeybiye');

    const { data: prev } = await supabase.from('suppliers').select('*').eq('id', id).single();
    const { error } = await supabase.from('suppliers').delete().eq('id', id);

    if (error) {
      throw new Error(`Lama tirtiri karo qeybiye: ${error.message}`);
    }

    await this.recordAuditLog(
      'DELETE_SUPPLIER',
      'supplier',
      id,
      prev,
      undefined,
      reason || `Tirtirid Qeybiye: ${prev?.name || id}`
    );
  }

  public async getSupplierMonthlyHistory(supplierId: string, monthStr: string): Promise<{
    purchasesCount: number;
    variantsCount: number;
    totalAmount: number;
    transactions: SupplierTransaction[];
  }> {
    let query = supabase
      .from('supplier_transactions')
      .select('*, items:supplier_transaction_items(*)')
      .eq('supplier_id', supplierId)
      .order('transaction_date', { ascending: false });

    if (monthStr) {
      const startDate = `${monthStr}-01`;
      const [y, m] = monthStr.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      query = query.gte('transaction_date', startDate).lt('transaction_date', nextMonth);
    }

    const { data, error } = await query;
    if (error || !data) {
      return { purchasesCount: 0, variantsCount: 0, totalAmount: 0, transactions: [] };
    }

    const txs = data as SupplierTransaction[];
    const purchasesCount = txs.length;
    const variantsCount = txs.reduce((sum, t) => sum + (t.items?.length || 0), 0);
    const totalAmount = txs.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

    return {
      purchasesCount,
      variantsCount,
      totalAmount,
      transactions: txs,
    };
  }

  // ==========================================
  // CUSTOMERS
  // ==========================================
  public async getCustomers(search?: string): Promise<Customer[]> {
    let query = supabase.from('customers').select('*').order('name');
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`name.ilike.${q},phone.ilike.${q}`);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching customers:', error.message);
      return [];
    }
    return (data || []) as Customer[];
  }

  public async getCustomerById(id: string): Promise<(Customer & { debts: Debt[]; payments: DebtPayment[]; sales: Sale[] }) | null> {
    const { data: cust, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !cust) return null;

    const [debtsRes, paymentsRes, salesRes] = await Promise.all([
      supabase.from('debts').select('*, payments:debt_payments(*)').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('debt_payments').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('sales').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    ]);

    return {
      ...(cust as Customer),
      debts: (debtsRes.data || []) as Debt[],
      payments: (paymentsRes.data || []) as DebtPayment[],
      sales: (salesRes.data || []) as Sale[],
    };
  }

  public async createCustomer(data: { name: string; phone: string; address?: string; notes?: string }, reason?: string): Promise<Customer> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('Fadlan marka hore gal nidaamka (Not Authenticated)');
    }
    if (user.role === 'reporter') {
      throw new Error('Hawshan waxaa u fasaxan kaliya Admin iyo Seller. Reporter waa Akhris-Kaliya (Read-Only).');
    }
    if (user.status !== 'active') {
      throw new Error('Koontadaadu ma firfircoona (Inactive)');
    }

    const newCust = {
      id: generateId(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      total_debt: 0,
      paid_debt: 0,
      remaining_debt: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabase
      .from('customers')
      .insert([newCust])
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad macmiil: ${error.message}`);
    }

    await this.recordAuditLog(
      'CREATE_CUSTOMER',
      'customer',
      created.id,
      undefined,
      created,
      reason || `Abuuris Macmiil: ${created.name}`
    );

    return created as Customer;
  }

  public async updateCustomer(id: string, updates: Partial<Customer>, reason?: string): Promise<Customer> {
    await this.checkAdminAuth('Wax ka beddel Macmiil');

    const { data: prev } = await supabase.from('customers').select('*').eq('id', id).single();

    const { data: updated, error } = await supabase
      .from('customers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad beddelka macmiil: ${error.message}`);
    }

    await this.recordAuditLog(
      'EDIT_CUSTOMER',
      'customer',
      id,
      prev,
      updated,
      reason || `Wax ka beddel Macmiil: ${updated.name}`
    );

    return updated as Customer;
  }

  public async deleteCustomer(id: string, reason?: string): Promise<void> {
    await this.checkAdminAuth('Tirtirid Macmiil');

    const { data: prev } = await supabase.from('customers').select('*').eq('id', id).single();
    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (error) {
      throw new Error(`Lama tirtiri karo macmiilka: ${error.message}`);
    }

    await this.recordAuditLog(
      'DELETE_CUSTOMER',
      'customer',
      id,
      prev,
      undefined,
      reason || `Tirtirid Macmiil: ${prev?.name || id}`
    );
  }

  public async getCustomerHistory(customerId: string): Promise<{ sales: Sale[]; debts: Debt[]; payments: DebtPayment[] }> {
    const [salesRes, debtsRes, paymentsRes] = await Promise.all([
      supabase.from('sales').select('*, items:sale_items(*)').eq('customer_id', customerId).order('created_at', { ascending: false }),
      supabase.from('debts').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
      supabase.from('debt_payments').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
    ]);

    return {
      sales: (salesRes.data || []) as Sale[],
      debts: (debtsRes.data || []) as Debt[],
      payments: (paymentsRes.data || []) as DebtPayment[],
    };
  }

  // ==========================================
  // PRODUCTS & PRODUCT VARIANTS (Scalable Supabase)
  // ==========================================
  public async getVariantsPaginated(
    search: string = '',
    categoryId: string = 'all',
    statusFilter: string = 'all',
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<ProductVariant>> {
    let query = supabase
      .from('product_variants')
      .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)', { count: 'exact' });

    // Status filter
    if (statusFilter === 'pending') {
      query = query.eq('is_pending', true);
    } else {
      query = query.eq('is_pending', false).eq('is_active', true);
      if (statusFilter === 'out_of_stock') {
        query = query.lte('stock_quantity', 0);
      } else if (statusFilter === 'in_stock') {
        query = query.gt('stock_quantity', 0);
      }
    }

    // Search filter
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`variant_name.ilike.${q},barcode.ilike.${q},sku.ilike.${q}`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching variants:', error.message);
      return {
        data: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 1,
      };
    }

    let results = (data || []).map(v => ({
      ...v,
      category: v.product?.category,
    })) as ProductVariant[];

    if (categoryId && categoryId !== 'all') {
      results = results.filter(v => v.product?.category_id === categoryId);
    }

    if (statusFilter === 'low_stock') {
      results = results.filter(v => v.stock_quantity > 0 && v.stock_quantity <= (v.minimum_stock || 10));
    }

    const totalCount = count ?? results.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      data: results,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  public async getProductById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*), variants:product_variants(*, supplier:suppliers(*))')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Product;
  }

  public async getVariantById(id: string): Promise<ProductVariant | null> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      category: data.product?.category,
    } as ProductVariant;
  }

  public async findVariantByBarcode(barcode: string): Promise<ProductVariant | null> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)')
      .eq('barcode', barcode.trim())
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      category: data.product?.category,
    } as ProductVariant;
  }

  public async createProduct(
    productData: { name: string; category_id?: string; description?: string; image_url?: string },
    variantData: {
      variant_name: string;
      sku?: string;
      barcode?: string;
      buy_price: number;
      purchase_unit: string;
      sell_price: number;
      selling_unit: string;
      conversion_factor: number;
      unit_division?: number;
      min_sellable_qty?: number;
      stock_quantity: number;
      minimum_stock: number;
      supplier_id?: string;
      image_url?: string;
    },
    reason?: string
  ): Promise<{ product: Product; variant: ProductVariant }> {
    await this.checkAdminAuth('Ku darid Alaab Cusub');

    const productId = generateId();
    const variantId = generateId();

    const newProduct = {
      id: productId,
      name: productData.name.trim(),
      category_id: productData.category_id || null,
      description: productData.description || null,
      image_url: productData.image_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: prodCreated, error: prodErr } = await supabase
      .from('products')
      .insert([newProduct])
      .select()
      .single();

    if (prodErr) {
      throw new Error(`Khalad abuurista alaabta: ${prodErr.message}`);
    }

    const division = Math.max(1, Number(variantData.unit_division) || 1);
    const minSellable = variantData.min_sellable_qty !== undefined && Number(variantData.min_sellable_qty) > 0
      ? Number(variantData.min_sellable_qty)
      : calculateMinSellableQty(division);

    const newVariant = {
      id: variantId,
      product_id: productId,
      variant_name: variantData.variant_name.trim() || 'Default',
      sku: variantData.sku?.trim() || null,
      barcode: variantData.barcode?.trim() || null,
      buy_price: Number(variantData.buy_price) || 0,
      purchase_unit: variantData.purchase_unit || 'jawan',
      sell_price: Number(variantData.sell_price) || 0,
      selling_unit: variantData.selling_unit || 'kg',
      conversion_factor: Number(variantData.conversion_factor) || 1,
      unit_division: division,
      min_sellable_qty: minSellable,
      stock_quantity: Number(variantData.stock_quantity) || 0,
      minimum_stock: Number(variantData.minimum_stock) || 10,
      supplier_id: variantData.supplier_id || null,
      image_url: variantData.image_url || null,
      is_active: true,
      is_pending: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data: varCreated, error: varErr } = await supabase
      .from('product_variants')
      .insert([newVariant])
      .select()
      .single();

    if (varErr && (varErr.message?.includes('min_sellable_qty') || varErr.message?.includes('unit_division') || varErr.code === 'PGRST204')) {
      console.warn('[Supabase Schema] Column min_sellable_qty/unit_division not in schema cache. Saving variant and falling back...');
      const { unit_division, min_sellable_qty, ...fallbackVariant } = newVariant;
      const fallbackRes = await supabase
        .from('product_variants')
        .insert([fallbackVariant])
        .select()
        .single();
      if (!fallbackRes.error && fallbackRes.data) {
        varCreated = { ...fallbackRes.data, unit_division, min_sellable_qty };
        varErr = null;
      } else if (fallbackRes.error) {
        varErr = fallbackRes.error;
      }
    }

    if (varErr) {
      throw new Error(`Khalad abuurista variant: ${varErr.message}`);
    }

    if (newVariant.stock_quantity > 0) {
      await supabase.from('stock_movements').insert([{
        id: generateId(),
        product_variant_id: variantId,
        type: 'adjustment',
        quantity: newVariant.stock_quantity,
        previous_quantity: 0,
        new_quantity: newVariant.stock_quantity,
        unit: newVariant.selling_unit,
        reference_type: 'initial_stock',
        notes: 'Stock-ga bilowga ah',
        created_at: new Date().toISOString(),
      }]);
    }

    await this.recordAuditLog(
      'CREATE_PRODUCT',
      'product',
      productId,
      undefined,
      { product: prodCreated, variant: varCreated },
      reason || `Abuuris Alaab: ${prodCreated.name} (${varCreated.variant_name})`
    );

    return {
      product: prodCreated as Product,
      variant: varCreated as ProductVariant,
    };
  }

  public async updateVariant(id: string, updates: any, reason?: string): Promise<ProductVariant> {
    await this.checkAdminAuth('Wax ka beddel Alaab / Variant');

    const { data: prev } = await supabase.from('product_variants').select('*').eq('id', id).single();
    if (!prev) throw new Error('Variant not found');

    if (updates.productName || updates.categoryId !== undefined || updates.category_id !== undefined) {
      const rawCatId = updates.categoryId !== undefined ? updates.categoryId : updates.category_id;
      const cleanCatId = (rawCatId && typeof rawCatId === 'string' && rawCatId.trim().length > 0) ? rawCatId.trim() : null;

      const productUpdates: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.productName && typeof updates.productName === 'string' && updates.productName.trim()) {
        productUpdates.name = updates.productName.trim();
      }
      if (updates.categoryId !== undefined || updates.category_id !== undefined) {
        productUpdates.category_id = cleanCatId;
      }

      const { error: prodErr } = await supabase
        .from('products')
        .update(productUpdates)
        .eq('id', prev.product_id);

      if (prodErr) {
        throw new Error(`Khalad beddelka alaabta: ${prodErr.message}`);
      }
    }

    const rawSuppId = updates.supplier_id !== undefined ? updates.supplier_id : updates.supplierId;
    let cleanSupplierId: string | null = prev.supplier_id || null;
    if (rawSuppId !== undefined) {
      cleanSupplierId = (rawSuppId && typeof rawSuppId === 'string' && rawSuppId.trim().length > 0) ? rawSuppId.trim() : null;
    }

    const division = updates.unit_division !== undefined ? Math.max(1, Number(updates.unit_division) || 1) : (updates.unitDivision !== undefined ? Math.max(1, Number(updates.unitDivision) || 1) : Math.max(1, Number(prev.unit_division) || 1));
    const minSellable = updates.min_sellable_qty !== undefined && Number(updates.min_sellable_qty) > 0
      ? Number(updates.min_sellable_qty)
      : (updates.minSellableQty !== undefined && Number(updates.minSellableQty) > 0
        ? Number(updates.minSellableQty)
        : (prev.min_sellable_qty ? Number(prev.min_sellable_qty) : calculateMinSellableQty(division)));

    const variantUpdates: any = {
      variant_name: (updates.variant_name || updates.variantName || prev.variant_name || '').trim(),
      sku: updates.sku !== undefined ? (typeof updates.sku === 'string' && updates.sku.trim() ? updates.sku.trim() : null) : (prev.sku || null),
      barcode: updates.barcode !== undefined ? (typeof updates.barcode === 'string' && updates.barcode.trim() ? updates.barcode.trim() : null) : (prev.barcode || null),
      buy_price: updates.buy_price !== undefined ? Number(updates.buy_price) : (updates.buyPrice !== undefined ? Number(updates.buyPrice) : Number(prev.buy_price || 0)),
      purchase_unit: updates.purchase_unit || updates.purchaseUnit || prev.purchase_unit || 'jawan',
      sell_price: updates.sell_price !== undefined ? Number(updates.sell_price) : (updates.sellPrice !== undefined ? Number(updates.sellPrice) : Number(prev.sell_price || 0)),
      selling_unit: updates.selling_unit || updates.sellingUnit || prev.selling_unit || 'kg',
      conversion_factor: updates.conversion_factor !== undefined ? Number(updates.conversion_factor) : (updates.conversionFactor !== undefined ? Number(updates.conversionFactor) : Number(prev.conversion_factor || 1)),
      unit_division: division,
      min_sellable_qty: minSellable,
      minimum_stock: updates.minimum_stock !== undefined ? Number(updates.minimum_stock) : (updates.minimumStock !== undefined ? Number(updates.minimumStock) : Number(prev.minimum_stock || 0)),
      supplier_id: cleanSupplierId,
      updated_at: new Date().toISOString(),
    };

    let { data: updated, error } = await supabase
      .from('product_variants')
      .update(variantUpdates)
      .eq('id', id)
      .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)')
      .single();

    if (error && (error.message?.includes('min_sellable_qty') || error.message?.includes('unit_division') || error.code === 'PGRST204')) {
      console.warn('[Supabase Schema] Column min_sellable_qty/unit_division not in schema cache during update. Retrying without fractional columns...');
      const { unit_division, min_sellable_qty, ...fallbackUpdates } = variantUpdates;
      const retryRes = await supabase
        .from('product_variants')
        .update(fallbackUpdates)
        .eq('id', id)
        .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)')
        .single();
      if (!retryRes.error && retryRes.data) {
        updated = { ...retryRes.data, unit_division, min_sellable_qty };
        error = null;
      } else if (retryRes.error) {
        error = retryRes.error;
      }
    }

    if (error) {
      throw new Error(`Khalad beddelka variant: ${error.message}`);
    }

    await this.recordAuditLog(
      'EDIT_VARIANT',
      'product_variant',
      id,
      prev,
      updated,
      reason || `Wax ka beddel Variant: ${updated.variant_name}`
    );

    return updated as ProductVariant;
  }

  public async deleteVariant(id: string, reason?: string): Promise<void> {
    await this.checkAdminAuth('Tirtirid Variant');
    const { data: prev } = await supabase.from('product_variants').select('*').eq('id', id).single();
    if (prev) {
      await supabase.from('product_variants').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
      await this.recordAuditLog('DELETE_VARIANT', 'product_variant', id, prev, { is_active: false }, reason || 'Tirtiray nooca');
    }
  }

  public async recordStockAdjustment(
    variantId: string,
    quantityChange: number,
    reason: string
  ): Promise<any> {
    const user = await this.checkAdminAuth('Sixid Stock (Inventory Adjustment)');

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('record_stock_adjustment', {
      p_variant_id: variantId,
      p_quantity_change: quantityChange,
      p_reason: reason,
      p_user_id: user.id,
      p_user_name: user.name,
      p_user_role: user.role,
    });

    if (!rpcErr && rpcRes) {
      return rpcRes;
    }

    const { data: variant, error: varFetchErr } = await supabase
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .single();

    if (varFetchErr || !variant) {
      throw new Error('Alaabta lama helin');
    }

    const previousQty = Number(variant.stock_quantity);
    const newQty = Math.max(0, previousQty + Number(quantityChange));

    const { data: updatedVariant, error: updateErr } = await supabase
      .from('product_variants')
      .update({
        stock_quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId)
      .select()
      .single();

    if (updateErr) {
      throw new Error(`Khalad sixidda kaydka: ${updateErr.message}`);
    }

    await supabase.from('stock_movements').insert([{
      id: generateId(),
      product_variant_id: variantId,
      type: 'adjustment',
      quantity: quantityChange,
      previous_quantity: previousQty,
      new_quantity: newQty,
      unit: variant.selling_unit,
      reference_type: 'manual_adjustment',
      notes: reason,
      created_at: new Date().toISOString(),
    }]);

    await this.recordAuditLog(
      'STOCK_ADJUSTMENT',
      'product_variant',
      variantId,
      { stock_quantity: previousQty },
      { stock_quantity: newQty, quantity_change: quantityChange },
      reason
    );

    return {
      success: true,
      variant_id: variantId,
      previous_quantity: previousQty,
      new_quantity: newQty,
      quantity_change: quantityChange,
    };
  }

  public async recordIncomingStock(
    data: {
      productName: string;
      variantName: string;
      quantity: number;
      purchaseUnit: string;
      sellingUnit: string;
      conversionFactor: number;
      unitDivision?: number;
      minSellableQty?: number;
      buyPrice: number;
      sellPrice: number;
      supplierId?: string;
      categoryId?: string;
      minimumStock?: number;
    },
    reason?: string
  ): Promise<any> {
    await this.checkAdminAuth('Alaab Soo Gashay (Incoming Stock)');

    const division = Math.max(1, Number(data.unitDivision) || 1);
    const minSellable = data.minSellableQty !== undefined && Number(data.minSellableQty) > 0
      ? Number(data.minSellableQty)
      : calculateMinSellableQty(division);

    // Search for existing product & variant
    const { data: existingProds } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', data.productName.trim())
      .limit(1);

    let productId = existingProds?.[0]?.id;
    let variantId: string | null = null;

    if (productId) {
      const { data: existingVars } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .ilike('variant_name', data.variantName.trim())
        .limit(1);

      if (existingVars?.[0]) {
        variantId = existingVars[0].id;
        const currentVar = existingVars[0];
        const addedQtyInSelling = Number((data.quantity * data.conversionFactor).toFixed(4));
        const prevStock = Number(currentVar.stock_quantity);
        const newStock = Number((prevStock + addedQtyInSelling).toFixed(4));

        const updatePayload: any = {
          stock_quantity: newStock,
          buy_price: data.buyPrice,
          sell_price: data.sellPrice,
          purchase_unit: data.purchaseUnit || currentVar.purchase_unit,
          selling_unit: data.sellingUnit || currentVar.selling_unit,
          conversion_factor: data.conversionFactor || currentVar.conversion_factor,
          unit_division: division,
          min_sellable_qty: minSellable,
          supplier_id: data.supplierId || currentVar.supplier_id,
          updated_at: new Date().toISOString(),
        };

        let { error: stockUpErr } = await supabase.from('product_variants').update(updatePayload).eq('id', variantId);
        if (stockUpErr && (stockUpErr.message?.includes('min_sellable_qty') || stockUpErr.message?.includes('unit_division') || stockUpErr.code === 'PGRST204')) {
          const { unit_division, min_sellable_qty, ...fallbackStockPayload } = updatePayload;
          await supabase.from('product_variants').update(fallbackStockPayload).eq('id', variantId);
        }

        await supabase.from('stock_movements').insert([{
          id: generateId(),
          product_variant_id: variantId,
          type: 'purchase',
          quantity: addedQtyInSelling,
          previous_quantity: prevStock,
          new_quantity: newStock,
          unit: data.sellingUnit,
          reference_type: 'manual_stock_in',
          notes: reason || `Soo galis toos ah: +${data.quantity} ${data.purchaseUnit}`,
          created_at: new Date().toISOString(),
        }]);

        await this.recordAuditLog('INCOMING_STOCK', 'product_variant', variantId || '', currentVar, { stock_quantity: newStock }, reason);
        return { success: true, variant_id: variantId };
      }
    }

    // Create new product & variant if not found
    const created = await this.createProduct(
      { name: data.productName, category_id: data.categoryId },
      {
        variant_name: data.variantName,
        buy_price: data.buyPrice,
        purchase_unit: data.purchaseUnit,
        sell_price: data.sellPrice,
        selling_unit: data.sellingUnit,
        conversion_factor: data.conversionFactor,
        unit_division: division,
        min_sellable_qty: minSellable,
        stock_quantity: Number((data.quantity * data.conversionFactor).toFixed(4)),
        minimum_stock: data.minimumStock || 10,
        supplier_id: data.supplierId,
      },
      reason
    );

    return { success: true, variant_id: created.variant.id };
  }

  public async finalizePendingVariant(
    variantId: string,
    data: {
      productName: string;
      variantName: string;
      sku?: string;
      barcode?: string;
      buyPrice: number;
      purchaseUnit: string;
      sellPrice: number;
      sellingUnit: string;
      conversionFactor: number;
      unitDivision?: number;
      minSellableQty?: number;
      quantityToAdd?: number;
      minimumStock?: number;
      categoryId?: string;
      supplierId?: string;
    },
    reason?: string
  ): Promise<ProductVariant> {
    await this.checkAdminAuth('Finalize Pending Variant');

    const { data: variant } = await supabase
      .from('product_variants')
      .select('*, product:products(*)')
      .eq('id', variantId)
      .single();

    if (!variant) throw new Error('Variant not found');

    if (variant.product_id) {
      const cleanCatId = data.categoryId && typeof data.categoryId === 'string' && data.categoryId.trim().length > 0 ? data.categoryId.trim() : null;
      await supabase.from('products').update({
        name: data.productName.trim(),
        category_id: cleanCatId,
        updated_at: new Date().toISOString(),
      }).eq('id', variant.product_id);
    }

    const division = Math.max(1, Number(data.unitDivision) || Number(variant.unit_division) || 1);
    const minSellable = data.minSellableQty !== undefined && Number(data.minSellableQty) > 0
      ? Number(data.minSellableQty)
      : calculateMinSellableQty(division);

    const addedQty = Number(((Number(data.quantityToAdd || 0)) * (Number(data.conversionFactor) || 1)).toFixed(4));
    const prevStock = Number(variant.stock_quantity || 0);
    const newStock = Number((prevStock + addedQty).toFixed(4));
    const cleanSuppId = data.supplierId && typeof data.supplierId === 'string' && data.supplierId.trim().length > 0 ? data.supplierId.trim() : null;

    const finalizePayload: any = {
      variant_name: data.variantName.trim(),
      sku: data.sku?.trim() || null,
      barcode: data.barcode?.trim() || null,
      buy_price: Number(data.buyPrice),
      purchase_unit: data.purchaseUnit,
      sell_price: Number(data.sellPrice),
      selling_unit: data.sellingUnit,
      conversion_factor: Number(data.conversionFactor) || 1,
      unit_division: division,
      min_sellable_qty: minSellable,
      stock_quantity: newStock,
      minimum_stock: Number(data.minimumStock || 10),
      supplier_id: cleanSuppId,
      is_pending: false,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let { data: updated, error } = await supabase
      .from('product_variants')
      .update(finalizePayload)
      .eq('id', variantId)
      .select('*, product:products(*)')
      .single();

    if (error && (error.message?.includes('min_sellable_qty') || error.message?.includes('unit_division') || error.code === 'PGRST204')) {
      const { unit_division, min_sellable_qty, ...fallbackFinalize } = finalizePayload;
      const retryRes = await supabase
        .from('product_variants')
        .update(fallbackFinalize)
        .eq('id', variantId)
        .select('*, product:products(*)')
        .single();
      if (!retryRes.error && retryRes.data) {
        updated = { ...retryRes.data, unit_division, min_sellable_qty };
        error = null;
      } else if (retryRes.error) {
        error = retryRes.error;
      }
    }

    if (error) {
      throw new Error(`Khalad xaqiijinta alaabta: ${error.message}`);
    }

    if (addedQty > 0) {
      await supabase.from('stock_movements').insert([{
        id: generateId(),
        product_variant_id: variantId,
        type: 'purchase',
        quantity: addedQty,
        previous_quantity: prevStock,
        new_quantity: newStock,
        unit: data.sellingUnit,
        reference_type: 'invoice_ocr_confirm',
        notes: reason || 'Xaqiijinta alaab cusub oo ka timid invoice OCR',
        created_at: new Date().toISOString(),
      }]);
    }

    await this.recordAuditLog(
      'FINALIZE_PENDING_VARIANT',
      'product_variant',
      variantId,
      variant,
      updated,
      reason || 'Xaqiijinta alaab cusub oo ka timid invoice OCR'
    );

    return updated as ProductVariant;
  }

  public async confirmScannedInvoiceToPending(
    scanResult: InvoiceScanResult,
    supplierId?: string
  ): Promise<number> {
    await this.checkAdminAuth('Soo Diridda Invoice OCR sida Pending');

    let count = 0;
    for (const item of scanResult.items) {
      const prodId = generateId();
      const varId = generateId();

      await supabase.from('products').insert([{
        id: prodId,
        name: item.productName.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

      await supabase.from('product_variants').insert([{
        id: varId,
        product_id: prodId,
        variant_name: item.variantName.trim() || 'Default',
        buy_price: item.buyPrice || 0,
        purchase_unit: item.purchaseUnit || 'jawan',
        sell_price: item.suggestedSellingPrice || item.buyPrice * 1.25,
        selling_unit: item.suggestedSellingUnit || 'kg',
        conversion_factor: item.suggestedConversionFactor || 50,
        stock_quantity: (item.quantity || 1) * (item.suggestedConversionFactor || 50),
        minimum_stock: 10,
        supplier_id: supplierId || null,
        is_pending: true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

      count++;
    }

    await this.recordAuditLog(
      'INVOICE_OCR_TO_PENDING',
      'product_variant',
      undefined,
      undefined,
      { count },
      `Invoice OCR: ${count} xariiq oo pending loo diray`
    );

    return count;
  }

  public async getStockMovements(variantId?: string, limit: number = 100): Promise<StockMovement[]> {
    let query = supabase
      .from('stock_movements')
      .select('*, product_variant:product_variants(*, product:products(*))')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (variantId) {
      query = query.eq('product_variant_id', variantId);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data || []) as StockMovement[];
  }

  public async getStockMovementsForVariant(variantId: string): Promise<StockMovement[]> {
    return this.getStockMovements(variantId);
  }

  // ==========================================
  // SALES & POS
  // ==========================================
  public async executeSale(params: {
    items?: CartItem[];
    cartItems?: CartItem[];
    paymentMethod: PaymentMethod;
    amountPaid?: number;
    overallDiscount?: number;
    customerId?: string;
    newCustomer?: { name: string; phone: string };
    dueDate?: string;
    notes?: string;
  }): Promise<Sale> {
    const rawItems = params.cartItems || params.items || [];
    if (rawItems.length === 0) {
      throw new Error('Ma jiro wax alaab ah oo ku jira gaariga iibka (Cart is empty)');
    }

    let customerId = params.customerId;
    if (!customerId && params.newCustomer?.name && params.newCustomer?.phone) {
      const createdCust = await this.createCustomer(params.newCustomer, 'Macmiil cusub oo POS lagu daray');
      customerId = createdCust.id;
    }

    // 1. Try PostgreSQL RPC `execute_sale`
    const itemsJson = rawItems.map(item => ({
      variant_id: item.variant.id,
      quantity: Number(item.quantity),
      unit_price: Number(item.unitPrice),
      unit_cost: Number(item.unitCost),
      discount: Number(item.discount || 0),
    }));

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('execute_sale', {
      p_shop_id: null,
      p_customer_id: customerId || null,
      p_items: itemsJson,
      p_payment_method: params.paymentMethod,
      p_overall_discount: Number(params.overallDiscount || 0),
      p_amount_paid: Number(params.amountPaid || 0),
      p_notes: params.notes || null,
    });

    if (!rpcErr && rpcRes?.sale_id) {
      const { data: saleData } = await supabase
        .from('sales')
        .select('*, customer:customers(*), items:sale_items(*, product_variant:product_variants(*, product:products(*)))')
        .eq('id', rpcRes.sale_id)
        .single();

      if (saleData) {
        if (saleData.debt_amount > 0 && customerId) {
          const debtId = generateId();
          const itemsSummary = rawItems.map(i => `${i.product.name} (${i.quantity} ${i.variant.selling_unit})`).join(', ');
          await supabase.from('debts').insert([{
            id: debtId,
            customer_id: customerId,
            sale_id: saleData.id,
            items_summary: itemsSummary,
            original_amount: saleData.total_amount,
            amount_paid: saleData.amount_paid,
            remaining_balance: saleData.debt_amount,
            due_date: params.dueDate || null,
            status: saleData.amount_paid > 0 ? 'partial' : 'unpaid',
            notes: params.notes || 'Dayn POS iib ah',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

          const { data: cust } = await supabase.from('customers').select('*').eq('id', customerId).single();
          if (cust) {
            await supabase.from('customers').update({
              total_debt: Number(cust.total_debt || 0) + saleData.total_amount,
              paid_debt: Number(cust.paid_debt || 0) + saleData.amount_paid,
              remaining_debt: Number(cust.remaining_debt || 0) + saleData.debt_amount,
              updated_at: new Date().toISOString(),
            }).eq('id', customerId);
          }
        }

        await this.recordAuditLog(
          'EXECUTE_SALE',
          'sale',
          saleData.id,
          undefined,
          saleData,
          `Iib Cusub: #${saleData.id.slice(0, 8)} - Total: $${saleData.total_amount}`
        );

        return saleData as Sale;
      }
    }

    // 2. Direct transactional sequence
    let subtotal = 0;
    let costAmount = 0;

    for (const item of rawItems) {
      const lineSubtotal = Math.round((item.quantity * item.unitPrice - (item.discount || 0)) * 100) / 100;
      subtotal += lineSubtotal;
      costAmount += Math.round(item.quantity * item.unitCost * 100) / 100;
    }

    subtotal = Math.round(subtotal * 100) / 100;
    costAmount = Math.round(costAmount * 100) / 100;

    const discount = Number(params.overallDiscount || 0);
    const totalAmount = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
    const amountPaid = params.paymentMethod === 'cash' ? totalAmount : Math.min(totalAmount, Math.max(0, Number(params.amountPaid || 0)));
    const debtAmount = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);
    const grossProfit = Math.round((totalAmount - costAmount) * 100) / 100;

    const saleId = generateId();

    const { data: createdSale, error: saleErr } = await supabase
      .from('sales')
      .insert([{
        id: saleId,
        customer_id: customerId || null,
        subtotal,
        discount,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        debt_amount: debtAmount,
        cost_amount: costAmount,
        gross_profit: grossProfit,
        payment_method: params.paymentMethod,
        notes: params.notes || null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (saleErr) {
      throw new Error(`Khalad iibka: ${saleErr.message}`);
    }

    for (const item of rawItems) {
      const itemLineTotal = Math.round((item.quantity * item.unitPrice - (item.discount || 0)) * 100) / 100;
      const itemProfit = Math.round((itemLineTotal - (item.quantity * item.unitCost)) * 100) / 100;

      await supabase.from('sale_items').insert([{
        id: generateId(),
        sale_id: saleId,
        product_variant_id: item.variant.id,
        quantity: item.quantity,
        unit: item.variant.selling_unit,
        unit_price: item.unitPrice,
        unit_cost: item.unitCost,
        discount: item.discount || 0,
        total_price: itemLineTotal,
        gross_profit: itemProfit,
        created_at: new Date().toISOString(),
      }]);

      const { data: curVar } = await supabase.from('product_variants').select('stock_quantity, selling_unit').eq('id', item.variant.id).single();
      const prevStock = Number(curVar?.stock_quantity || 0);
      const newStock = Math.max(0, Number((prevStock - item.quantity).toFixed(4)));

      await supabase.from('product_variants').update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      }).eq('id', item.variant.id);

      await supabase.from('stock_movements').insert([{
        id: generateId(),
        product_variant_id: item.variant.id,
        type: 'sale',
        quantity: -item.quantity,
        previous_quantity: prevStock,
        new_quantity: newStock,
        unit: curVar?.selling_unit || item.variant.selling_unit,
        reference_id: saleId,
        reference_type: 'sale',
        notes: `POS Sale: #${saleId.slice(0, 8)}`,
        created_at: new Date().toISOString(),
      }]);
    }

    if (debtAmount > 0 && customerId) {
      const debtId = generateId();
      const itemsSummary = rawItems.map(i => `${i.product.name} (${i.quantity} ${i.variant.selling_unit})`).join(', ');
      await supabase.from('debts').insert([{
        id: debtId,
        customer_id: customerId,
        sale_id: saleId,
        items_summary: itemsSummary,
        original_amount: totalAmount,
        amount_paid: amountPaid,
        remaining_balance: debtAmount,
        due_date: params.dueDate || null,
        status: amountPaid > 0 ? 'partial' : 'unpaid',
        notes: params.notes || 'Dayn POS iib ah',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

      const { data: cust } = await supabase.from('customers').select('*').eq('id', customerId).single();
      if (cust) {
        await supabase.from('customers').update({
          total_debt: Number(cust.total_debt || 0) + totalAmount,
          paid_debt: Number(cust.paid_debt || 0) + amountPaid,
          remaining_debt: Number(cust.remaining_debt || 0) + debtAmount,
          updated_at: new Date().toISOString(),
        }).eq('id', customerId);
      }
    }

    await this.recordAuditLog(
      'EXECUTE_SALE',
      'sale',
      saleId,
      undefined,
      createdSale,
      `Iib Cusub: #${saleId.slice(0, 8)} - Total: $${totalAmount}`
    );

    const { data: finalSale } = await supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*, product_variant:product_variants(*, product:products(*)))')
      .eq('id', saleId)
      .single();

    return finalSale as Sale;
  }

  public async getSales(limit: number = 200): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*, product_variant:product_variants(*, product:products(*)))')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching sales:', error.message);
      return [];
    }
    return (data || []) as Sale[];
  }

  public async getSaleById(id: string): Promise<Sale | null> {
    const { data, error } = await supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*, product_variant:product_variants(*, product:products(*)))')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Sale;
  }

  public async correctSale(saleId: string, payload: SaleCorrectionPayload, reason?: string): Promise<any> {
    const user = await this.checkAdminAuth('Sixid Iib (Sale Correction)');

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('correct_sale', {
      p_sale_id: saleId,
      p_customer_id: payload.customerId || null,
      p_payment_method: payload.paymentMethod || 'cash',
      p_amount_paid: payload.amountPaid || 0,
      p_overall_discount: payload.overallDiscount || 0,
      p_created_at: payload.createdAt || null,
      p_notes: payload.notes || null,
      p_items: payload.items || [],
      p_reason: reason || 'Sixid Iibka',
      p_user_id: user.id,
      p_user_name: user.name,
      p_user_role: user.role,
    });

    if (!rpcErr && rpcRes) return rpcRes;

    const { data: oldSale } = await supabase.from('sales').select('*, items:sale_items(*)').eq('id', saleId).single();
    if (!oldSale) throw new Error('Sale not found');

    for (const oldItem of oldSale.items || []) {
      const { data: v } = await supabase.from('product_variants').select('stock_quantity').eq('id', oldItem.product_variant_id).single();
      if (v) {
        await supabase.from('product_variants').update({
          stock_quantity: Number(v.stock_quantity) + Number(oldItem.quantity),
          updated_at: new Date().toISOString(),
        }).eq('id', oldItem.product_variant_id);
      }
    }

    let subtotal = 0;
    let totalCost = 0;

    for (const item of payload.items || []) {
      const { data: v } = await supabase.from('product_variants').select('*').eq('id', item.productVariantId).single();
      if (!v) continue;
      const unitCost = calculateCostPerBaseUnit(v.buy_price, v.conversion_factor);
      subtotal += item.quantity * item.unitPrice - (item.discount || 0);
      totalCost += item.quantity * unitCost;

      const curStock = Number(v.stock_quantity);
      await supabase.from('product_variants').update({
        stock_quantity: Math.max(0, curStock - item.quantity),
        updated_at: new Date().toISOString(),
      }).eq('id', item.productVariantId);
    }

    const discount = Number(payload.overallDiscount || 0);
    const totalAmount = Math.max(0, subtotal - discount);
    const amountPaid = payload.paymentMethod === 'cash' ? totalAmount : Math.min(totalAmount, Math.max(0, Number(payload.amountPaid || 0)));
    const debtAmount = Math.max(0, totalAmount - amountPaid);
    const grossProfit = totalAmount - totalCost;

    await supabase.from('sales').update({
      customer_id: payload.customerId || null,
      subtotal,
      discount,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      debt_amount: debtAmount,
      cost_amount: totalCost,
      gross_profit: grossProfit,
      payment_method: payload.paymentMethod || 'cash',
      notes: payload.notes || null,
      created_at: payload.createdAt || oldSale.created_at,
    }).eq('id', saleId);

    await supabase.from('sale_items').delete().eq('sale_id', saleId);

    for (const item of payload.items || []) {
      const { data: v } = await supabase.from('product_variants').select('*').eq('id', item.productVariantId).single();
      const unitCost = v ? calculateCostPerBaseUnit(v.buy_price, v.conversion_factor) : 0;
      const itemTotal = item.quantity * item.unitPrice - (item.discount || 0);
      const itemProfit = itemTotal - (item.quantity * unitCost);

      await supabase.from('sale_items').insert([{
        id: generateId(),
        sale_id: saleId,
        product_variant_id: item.productVariantId,
        quantity: item.quantity,
        unit: v?.selling_unit || 'kg',
        unit_price: item.unitPrice,
        unit_cost: unitCost,
        discount: item.discount || 0,
        total_price: itemTotal,
        gross_profit: itemProfit,
        created_at: new Date().toISOString(),
      }]);
    }

    await this.recordAuditLog(
      'CORRECT_SALE',
      'sale',
      saleId,
      oldSale,
      { total_amount: totalAmount, amount_paid: amountPaid, debt_amount: debtAmount },
      reason || 'Sixid Iibka'
    );

    return {
      success: true,
      sale_id: saleId,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      debt_amount: debtAmount,
    };
  }

  public async voidSale(saleId: string, reason: string): Promise<void> {
    await this.checkAdminAuth('Tirtirid/Laalid Iib (Void Sale)');

    const { data: sale } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('id', saleId)
      .single();

    if (!sale) throw new Error('Sale not found');

    for (const item of sale.items || []) {
      const { data: v } = await supabase.from('product_variants').select('stock_quantity, selling_unit').eq('id', item.product_variant_id).single();
      if (v) {
        const prevStock = Number(v.stock_quantity);
        const restoredStock = prevStock + Number(item.quantity);
        await supabase.from('product_variants').update({
          stock_quantity: restoredStock,
          updated_at: new Date().toISOString(),
        }).eq('id', item.product_variant_id);

        await supabase.from('stock_movements').insert([{
          id: generateId(),
          product_variant_id: item.product_variant_id,
          type: 'sale_return',
          quantity: item.quantity,
          previous_quantity: prevStock,
          new_quantity: restoredStock,
          unit: v.selling_unit,
          reference_id: saleId,
          reference_type: 'void_sale',
          notes: `Laalida Iibka #${saleId.slice(0, 8)}: ${reason}`,
          created_at: new Date().toISOString(),
        }]);
      }
    }

    await supabase.from('debts').delete().eq('sale_id', saleId);
    await supabase.from('sales').delete().eq('id', saleId);

    await this.recordAuditLog('VOID_SALE', 'sale', saleId, sale, undefined, reason);
  }

  // ==========================================
  // DEBTS & DEBT PAYMENTS
  // ==========================================
  public async getDebts(statusFilter: string = 'all'): Promise<Debt[]> {
    let query = supabase
      .from('debts')
      .select('*, customer:customers(*), sale:sales(*)')
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching debts:', error.message);
      return [];
    }
    return (data || []) as Debt[];
  }

  public async getDebtById(id: string): Promise<Debt | null> {
    const { data, error } = await supabase
      .from('debts')
      .select('*, customer:customers(*), sale:sales(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Debt;
  }

  public async getDebtPayments(): Promise<DebtPayment[]> {
    const { data, error } = await supabase
      .from('debt_payments')
      .select('*, customer:customers(*), debt:debts(*)')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []) as DebtPayment[];
  }

  public async getDebtCalendarSummary(): Promise<{
    dueToday: Debt[];
    upcoming: Debt[];
    overdue: Debt[];
  }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('debts')
      .select('*, customer:customers(*)')
      .not('due_date', 'is', null)
      .neq('status', 'paid')
      .order('due_date', { ascending: true });

    const all = (data || []) as Debt[];
    const dueToday = all.filter(d => d.due_date === todayStr);
    const upcoming = all.filter(d => d.due_date && d.due_date > todayStr);
    const overdue = all.filter(d => d.due_date && d.due_date < todayStr);

    return { dueToday, upcoming, overdue };
  }

  public async createDebt(data: {
    customerId: string;
    itemsSummary?: string;
    originalAmount: number;
    amountPaid?: number;
    dueDate?: string;
    notes?: string;
  }, reason?: string): Promise<Debt> {
    await this.checkAdminAuth('Ku darid Dayn Cusub');

    const debtId = generateId();
    const original = Number(data.originalAmount);
    const paid = Number(data.amountPaid || 0);
    const remaining = Math.max(0, original - paid);
    const status = remaining === 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');

    const { data: created, error } = await supabase
      .from('debts')
      .insert([{
        id: debtId,
        customer_id: data.customerId,
        items_summary: data.itemsSummary || 'Manual debt entry',
        original_amount: original,
        amount_paid: paid,
        remaining_balance: remaining,
        due_date: data.dueDate || null,
        status,
        notes: data.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select('*, customer:customers(*)')
      .single();

    if (error) throw new Error(`Khalad abuurista daynta: ${error.message}`);

    const { data: cust } = await supabase.from('customers').select('*').eq('id', data.customerId).single();
    if (cust) {
      await supabase.from('customers').update({
        total_debt: Number(cust.total_debt || 0) + original,
        paid_debt: Number(cust.paid_debt || 0) + paid,
        remaining_debt: Number(cust.remaining_debt || 0) + remaining,
        updated_at: new Date().toISOString(),
      }).eq('id', data.customerId);
    }

    await this.recordAuditLog('CREATE_DEBT', 'debt', debtId, undefined, created, reason || `Dayn Cusub: $${original}`);
    return created as Debt;
  }

  public async correctDebt(debtId: string, payload: DebtCorrectionPayload, reason?: string): Promise<Debt> {
    await this.checkAdminAuth('Sixid Dayn');
    const { data: prev } = await supabase.from('debts').select('*').eq('id', debtId).single();
    if (!prev) throw new Error('Debt not found');

    const newOriginal = payload.originalAmount !== undefined ? Number(payload.originalAmount) : Number(prev.original_amount);
    const paid = Number(prev.amount_paid || 0);
    const newRemaining = Math.max(0, newOriginal - paid);
    const newStatus = newRemaining === 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');

    const { data: updated, error } = await supabase
      .from('debts')
      .update({
        customer_id: payload.customerId || prev.customer_id,
        items_summary: payload.itemsSummary !== undefined ? payload.itemsSummary : prev.items_summary,
        original_amount: newOriginal,
        remaining_balance: newRemaining,
        due_date: payload.dueDate !== undefined ? payload.dueDate : prev.due_date,
        notes: payload.notes !== undefined ? payload.notes : prev.notes,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', debtId)
      .select('*, customer:customers(*)')
      .single();

    if (error) throw new Error(`Khalad beddelka daynta: ${error.message}`);
    await this.recordAuditLog('CORRECT_DEBT', 'debt', debtId, prev, updated, reason || 'Sixid Dayn');
    return updated as Debt;
  }

  public async recordDebtPayment(params: {
    customerId?: string;
    customer_id?: string;
    debtId?: string;
    debt_id?: string;
    amount: number;
    paymentMethod?: string;
    payment_method?: string;
    notes?: string;
  }): Promise<DebtPayment> {
    await this.checkAdminAuth('Qaadashada Lacag Bixin Dayn ah');

    const paymentId = generateId();
    const amount = Number(params.amount);
    const custId = params.customerId || params.customer_id;
    const dId = params.debtId || params.debt_id;
    const method = params.paymentMethod || params.payment_method || 'cash';

    if (amount <= 0) {
      throw new Error('Lacagta bixinta waa inay ka weynaataa 0');
    }
    if (!custId) {
      throw new Error('Macmiilka lama dooran');
    }

    const { data: createdPayment, error: payErr } = await supabase
      .from('debt_payments')
      .insert([{
        id: paymentId,
        customer_id: custId,
        debt_id: dId || null,
        amount,
        payment_method: method,
        notes: params.notes || null,
        created_at: new Date().toISOString(),
      }])
      .select('*, customer:customers(*)')
      .single();

    if (payErr) {
      throw new Error(`Khalad diiwaangelinta lacag bixinta: ${payErr.message}`);
    }

    if (dId) {
      const { data: debt } = await supabase.from('debts').select('*').eq('id', dId).single();
      if (debt) {
        const newPaid = Number(debt.amount_paid || 0) + amount;
        const newRemaining = Math.max(0, Number(debt.original_amount) - newPaid);
        const newStatus = newRemaining === 0 ? 'paid' : 'partial';

        await supabase.from('debts').update({
          amount_paid: newPaid,
          remaining_balance: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        }).eq('id', dId);
      }
    }

    const { data: customer } = await supabase.from('customers').select('*').eq('id', custId).single();
    if (customer) {
      const paidDebt = Number(customer.paid_debt || 0) + amount;
      const remainingDebt = Math.max(0, Number(customer.remaining_debt || 0) - amount);

      await supabase.from('customers').update({
        paid_debt: paidDebt,
        remaining_debt: remainingDebt,
        updated_at: new Date().toISOString(),
      }).eq('id', custId);
    }

    await this.recordAuditLog(
      'RECORD_DEBT_PAYMENT',
      'debt_payment',
      paymentId,
      undefined,
      createdPayment,
      `Bixinta Daynta: $${amount} - Macmiil: ${customer?.name || custId}`
    );

    return createdPayment as DebtPayment;
  }

  public async correctDebtPayment(paymentId: string, payload: any, reason?: string): Promise<any> {
    const user = await this.checkAdminAuth('Sixid Lacag Bixinta Daynta');

    const newAmount = Number(payload.amount ?? payload.new_amount);
    if (newAmount <= 0) {
      throw new Error('Lacagta bixinta waa inay ka weynaataa 0');
    }

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('correct_debt_payment', {
      p_payment_id: paymentId,
      p_new_amount: newAmount,
      p_payment_method: payload.paymentMethod || payload.payment_method || 'cash',
      p_created_at: payload.createdAt || null,
      p_notes: payload.notes || null,
      p_reason: reason || 'Sixid Lacag Bixinta',
      p_user_id: user.id,
      p_user_name: user.name,
      p_user_role: user.role,
    });

    if (!rpcErr && rpcRes) return rpcRes;

    const { data: oldPayment } = await supabase.from('debt_payments').select('*').eq('id', paymentId).single();
    if (!oldPayment) throw new Error('Payment not found');

    const delta = newAmount - Number(oldPayment.amount);

    await supabase.from('debt_payments').update({
      amount: newAmount,
      payment_method: payload.paymentMethod || payload.payment_method || oldPayment.payment_method,
      notes: payload.notes || oldPayment.notes,
      created_at: payload.createdAt || oldPayment.created_at,
    }).eq('id', paymentId);

    const { data: cust } = await supabase.from('customers').select('*').eq('id', oldPayment.customer_id).single();
    if (cust) {
      await supabase.from('customers').update({
        paid_debt: Math.max(0, Number(cust.paid_debt || 0) + delta),
        remaining_debt: Math.max(0, Number(cust.remaining_debt || 0) - delta),
        updated_at: new Date().toISOString(),
      }).eq('id', oldPayment.customer_id);
    }

    await this.recordAuditLog(
      'CORRECT_DEBT_PAYMENT',
      'debt_payment',
      paymentId,
      oldPayment,
      { amount: newAmount, delta },
      reason || 'Sixid Lacag Bixinta'
    );

    return {
      success: true,
      payment_id: paymentId,
      previous_amount: oldPayment.amount,
      new_amount: newAmount,
      delta,
    };
  }

  public async createDebtDirectly(data: {
    customerName: string;
    customerPhone: string;
    itemsSummary?: string;
    totalAmount: number;
    amountPaidInitially?: number;
    dueDate?: string;
    notes?: string;
  }): Promise<Debt> {
    const custs = await this.getCustomers(data.customerPhone);
    let customerId = custs[0]?.id;
    if (!customerId) {
      const createdCust = await this.createCustomer({
        name: data.customerName,
        phone: data.customerPhone,
      }, 'Macmiil cusub oo dayn toos ah loo furay');
      customerId = createdCust.id;
    }

    return this.createDebt({
      customerId,
      itemsSummary: data.itemsSummary,
      originalAmount: data.totalAmount,
      amountPaid: data.amountPaidInitially,
      dueDate: data.dueDate,
      notes: data.notes,
    }, 'Diiwaangelin Dayn Toos ah');
  }

  public async addCustomerCallLog(debtId: string, note: string): Promise<void> {
    const { data: debt } = await supabase.from('debts').select('*').eq('id', debtId).single();
    if (!debt) throw new Error('Debt record not found');

    const logs = Array.isArray(debt.call_logs) ? [...debt.call_logs] : [];
    logs.unshift({
      id: generateId(),
      date: new Date().toISOString(),
      note: note.trim(),
      caller_name: 'Admin',
    });

    await supabase.from('debts').update({
      call_logs: logs,
      updated_at: new Date().toISOString(),
    }).eq('id', debtId);
  }

  public async recordCallLog(debtId: string, note: string): Promise<void> {
    return this.addCustomerCallLog(debtId, note);
  }

  public async addDebtCallLog(debtId: string, note: string): Promise<void> {
    return this.addCustomerCallLog(debtId, note);
  }

  // ==========================================
  // EXPENSES
  // ==========================================
  public async getExpenses(search?: string, category?: string): Promise<Expense[]> {
    let query = supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search?.trim()) {
      query = query.ilike('description', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching expenses:', error.message);
      return [];
    }
    return (data || []) as Expense[];
  }

  public async createExpense(data: {
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: string;
    notes?: string;
  }, reason?: string): Promise<Expense> {
    await this.checkAdminAuth('Ku darid Kharash Cusub');

    const newExp = {
      id: generateId(),
      category: data.category,
      amount: Number(data.amount),
      description: data.description.trim(),
      date: data.date || new Date().toISOString().split('T')[0],
      notes: data.notes?.trim() || null,
      created_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabase
      .from('expenses')
      .insert([newExp])
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad kharashka: ${error.message}`);
    }

    await this.recordAuditLog(
      'CREATE_EXPENSE',
      'expense',
      created.id,
      undefined,
      created,
      reason || `Kharash Cusub: ${created.description} ($${created.amount})`
    );

    return created as Expense;
  }

  public async updateExpense(id: string, updates: Partial<Expense>, reason?: string): Promise<Expense> {
    await this.checkAdminAuth('Wax ka beddel Kharash');

    const { data: prev } = await supabase.from('expenses').select('*').eq('id', id).single();

    const { data: updated, error } = await supabase
      .from('expenses')
      .update({
        ...updates,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad beddelka kharashka: ${error.message}`);
    }

    await this.recordAuditLog(
      'EDIT_EXPENSE',
      'expense',
      id,
      prev,
      updated,
      reason || `Wax ka beddel Kharash: ${updated.description}`
    );

    return updated as Expense;
  }

  public async deleteExpense(id: string, reason?: string): Promise<void> {
    await this.checkAdminAuth('Tirtirid Kharash');

    const { data: prev } = await supabase.from('expenses').select('*').eq('id', id).single();
    const { error } = await supabase.from('expenses').delete().eq('id', id);

    if (error) {
      throw new Error(`Lama tirtiri karo kharashka: ${error.message}`);
    }

    await this.recordAuditLog(
      'DELETE_EXPENSE',
      'expense',
      id,
      prev,
      undefined,
      reason || `Tirtirid Kharash: ${prev?.description || id}`
    );
  }

  // ==========================================
  // PURCHASES & SUPPLIER TRANSACTIONS
  // ==========================================
  public async getSupplierTransactions(): Promise<SupplierTransaction[]> {
    const { data, error } = await supabase
      .from('supplier_transactions')
      .select('*, supplier:suppliers(*), items:supplier_transaction_items(*)')
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching purchases:', error.message);
      return [];
    }
    return (data || []) as SupplierTransaction[];
  }

  public async confirmIncomingStock(
    transactionData: {
      supplier_id?: string;
      reference_number?: string;
      transaction_date?: string;
      notes?: string;
    },
    items: Array<{
      product_variant_id?: string;
      product_name: string;
      variant_name: string;
      quantity: number;
      purchase_unit: string;
      buy_price: number;
      conversion_factor: number;
    }>,
    reason?: string
  ): Promise<SupplierTransaction> {
    await this.checkAdminAuth('Xaqiijinta Stock Soo Galay (Purchase In)');

    const transactionId = generateId();
    let totalAmount = 0;

    for (const it of items) {
      totalAmount += it.quantity * it.buy_price;
    }

    const { data: createdTx, error: txErr } = await supabase
      .from('supplier_transactions')
      .insert([{
        id: transactionId,
        supplier_id: transactionData.supplier_id || null,
        reference_number: transactionData.reference_number || null,
        total_amount: totalAmount,
        status: 'completed',
        notes: transactionData.notes || null,
        transaction_date: transactionData.transaction_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (txErr) {
      throw new Error(`Khalad iibsiga: ${txErr.message}`);
    }

    for (const it of items) {
      const lineCost = it.quantity * it.buy_price;
      const itemId = generateId();

      await supabase.from('supplier_transaction_items').insert([{
        id: itemId,
        transaction_id: transactionId,
        product_variant_id: it.product_variant_id || null,
        product_name: it.product_name,
        variant_name: it.variant_name,
        quantity: it.quantity,
        purchase_unit: it.purchase_unit,
        buy_price: it.buy_price,
        conversion_factor: it.conversion_factor || 1,
        total_cost: lineCost,
        created_at: new Date().toISOString(),
      }]);

      if (it.product_variant_id) {
        const { data: v } = await supabase.from('product_variants').select('*').eq('id', it.product_variant_id).single();
        if (v) {
          const qtyInSellingUnit = it.quantity * (it.conversion_factor || v.conversion_factor || 1);
          const prevStock = Number(v.stock_quantity);
          const newStock = prevStock + qtyInSellingUnit;

          await supabase.from('product_variants').update({
            stock_quantity: newStock,
            buy_price: it.buy_price,
            updated_at: new Date().toISOString(),
          }).eq('id', it.product_variant_id);

          await supabase.from('stock_movements').insert([{
            id: generateId(),
            product_variant_id: it.product_variant_id,
            type: 'purchase',
            quantity: qtyInSellingUnit,
            previous_quantity: prevStock,
            new_quantity: newStock,
            unit: v.selling_unit,
            reference_id: transactionId,
            reference_type: 'supplier_transaction',
            notes: `Soo iibsasho qeybiye: #${transactionId.slice(0, 8)}`,
            created_at: new Date().toISOString(),
          }]);
        }
      }
    }

    await this.recordAuditLog(
      'CONFIRM_INCOMING_STOCK',
      'supplier_transaction',
      transactionId,
      undefined,
      createdTx,
      reason || `Stock soo galay: Total $${totalAmount}`
    );

    const { data: finalTx } = await supabase
      .from('supplier_transactions')
      .select('*, supplier:suppliers(*), items:supplier_transaction_items(*)')
      .eq('id', transactionId)
      .single();

    return finalTx as SupplierTransaction;
  }

  public async correctSupplierTransaction(transactionId: string, payload: any, reason?: string): Promise<any> {
    await this.checkAdminAuth('Sixid Iibsiga Qeybiye');
    const { data: prev } = await supabase.from('supplier_transactions').select('*, items:supplier_transaction_items(*)').eq('id', transactionId).single();
    if (!prev) throw new Error('Transaction not found');

    await supabase.from('supplier_transactions').update({
      supplier_id: payload.supplierId || prev.supplier_id,
      reference_number: payload.referenceNumber !== undefined ? payload.referenceNumber : prev.reference_number,
      transaction_date: payload.transactionDate || prev.transaction_date,
      notes: payload.notes !== undefined ? payload.notes : prev.notes,
    }).eq('id', transactionId);

    await this.recordAuditLog('CORRECT_SUPPLIER_TX', 'supplier_transaction', transactionId, prev, payload, reason || 'Sixid iibsi qeybiye');
    return { success: true };
  }

  // ==========================================
  // USERS & PROFILES MANAGEMENT
  // ==========================================
  public async getUsers(): Promise<SystemUser[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at');

    if (error) {
      console.error('Error fetching users:', error.message);
      return [];
    }

    return (data || []).map(p => {
      const roleStr = String(p.role || '').toLowerCase();
      const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
      return {
        id: p.id,
        name: p.full_name,
        email: p.phone ? `${p.phone}@tukaan.so` : `${p.full_name.toLowerCase().replace(/\s+/g, '')}@tukaan.so`,
        role,
        status: 'active',
        created_at: p.created_at,
      };
    });
  }

  public async getUserById(id: string): Promise<SystemUser | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    const roleStr = String(data.role || '').toLowerCase();
    const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
    return {
      id: data.id,
      name: data.full_name,
      email: data.phone || 'user@tukaan.so',
      role,
      status: 'active',
      created_at: data.created_at,
    };
  }

  public async getUserByEmail(email: string): Promise<SystemUser | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('full_name', `%${email.split('@')[0]}%`)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const roleStr = String(data.role || '').toLowerCase();
    const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
    return {
      id: data.id,
      name: data.full_name,
      email: email,
      role,
      status: 'active',
      created_at: data.created_at,
    };
  }

  public async createUser(data: { name: string; email: string; role: UserRole; password?: string }, reason?: string): Promise<SystemUser> {
    await this.checkAdminAuth('Abuuris Isticmaale Cusub');

    let authUserId = generateId();

    // If Supabase is configured and password is provided, provision in Supabase Auth using ephemeral client (so active admin session is preserved)
    if (isSupabaseConfigured && data.password) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const ephemeralClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });

        const { data: authData, error: authErr } = await ephemeralClient.auth.signUp({
          email: data.email.trim(),
          password: data.password,
          options: {
            data: {
              full_name: data.name.trim(),
              role: data.role,
            },
          },
        });

        if (authErr) {
          console.warn('Supabase auth signUp warning during createUser:', authErr.message);
        } else if (authData.user?.id) {
          authUserId = authData.user.id;
        }
      } catch (authException) {
        console.warn('Auth provision exception:', authException);
      }
    }

    const newProfile = {
      id: authUserId,
      full_name: data.name.trim(),
      role: data.role,
      phone: data.email.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabase
      .from('profiles')
      .upsert([newProfile])
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad abuurista isticmaalaha: ${error.message}`);
    }

    await this.recordAuditLog(
      'CREATE_USER',
      'profile',
      authUserId,
      undefined,
      created,
      reason || `Abuuris User: ${created.full_name} (${created.role})`
    );

    const roleStr = String(created.role || data.role).toLowerCase();
    const resolvedRole: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');

    return {
      id: created.id,
      name: created.full_name,
      email: data.email,
      role: resolvedRole,
      status: 'active',
      created_at: created.created_at,
    };
  }

  public async updateUser(id: string, updates: Partial<SystemUser>, reason?: string): Promise<SystemUser> {
    await this.checkAdminAuth('Wax ka beddel Isticmaale');

    const { data: prev } = await supabase.from('profiles').select('*').eq('id', id).single();

    const { data: updated, error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.name?.trim() || prev?.full_name,
        role: updates.role || prev?.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Khalad beddelka user: ${error.message}`);
    }

    await this.recordAuditLog(
      'EDIT_USER',
      'profile',
      id,
      prev,
      updated,
      reason || `Wax ka beddel User: ${updated.full_name}`
    );

    const roleStr = String(updated.role || '').toLowerCase();
    const resolvedRole: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');

    return {
      id: updated.id,
      name: updated.full_name,
      email: updates.email || prev?.phone || 'user@tukaan.so',
      role: resolvedRole,
      status: 'active',
      created_at: updated.created_at,
    };
  }

  public async toggleUserStatus(id: string): Promise<SystemUser> {
    const user = await this.getUserById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  public async resetUserPassword(id: string, newPass: string): Promise<void> {
    await this.checkAdminAuth('Beddelka Furaha Sirta ah');
    await this.recordAuditLog(
      'RESET_USER_PASSWORD',
      'profile',
      id,
      undefined,
      undefined,
      'Dib-u-dejinta furaha sirta ah ee isticmaalaha'
    );
  }

  public async deleteUser(id: string): Promise<void> {
    await this.checkAdminAuth('Tirtirid Isticmaale');
    const { data: prev } = await supabase.from('profiles').select('*').eq('id', id).single();
    await supabase.from('profiles').delete().eq('id', id);
    await this.recordAuditLog(
      'DELETE_USER',
      'profile',
      id,
      prev,
      undefined,
      `Tirtirid User: ${prev?.full_name || id}`
    );
  }

  // ==========================================
  // DASHBOARD METRICS & REPORTS (Live Supabase Aggregate)
  // ==========================================
  public async getDashboardMetrics(period: 'today' | 'yesterday' | 'month' | 'all' = 'today'): Promise<DashboardMetrics> {
    const user = await this.getCurrentUser();
    if (user?.role === 'seller') {
      throw new Error('Seller / Iibiye ma laha ogolaansho uu ku eego warbixinnada Dashboard-ka.');
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    let salesQuery = supabase.from('sales').select('*');
    let expensesQuery = supabase.from('expenses').select('*');
    let debtPaymentsQuery = supabase.from('debt_payments').select('*');

    if (period === 'today') {
      salesQuery = salesQuery.gte('created_at', `${todayStr}T00:00:00`);
      expensesQuery = expensesQuery.eq('date', todayStr);
      debtPaymentsQuery = debtPaymentsQuery.gte('created_at', `${todayStr}T00:00:00`);
    } else if (period === 'yesterday') {
      salesQuery = salesQuery.gte('created_at', `${yesterdayStr}T00:00:00`).lt('created_at', `${todayStr}T00:00:00`);
      expensesQuery = expensesQuery.eq('date', yesterdayStr);
      debtPaymentsQuery = debtPaymentsQuery.gte('created_at', `${yesterdayStr}T00:00:00`).lt('created_at', `${todayStr}T00:00:00`);
    } else if (period === 'month') {
      salesQuery = salesQuery.gte('created_at', `${startOfMonthStr}T00:00:00`);
      expensesQuery = expensesQuery.gte('date', startOfMonthStr);
      debtPaymentsQuery = debtPaymentsQuery.gte('created_at', `${startOfMonthStr}T00:00:00`);
    }

    const [
      salesRes,
      expensesRes,
      debtPaymentsRes,
      variantsRes,
      productsCountRes,
      debtsRes
    ] = await Promise.all([
      salesQuery,
      expensesQuery,
      debtPaymentsQuery,
      supabase.from('product_variants').select('id, stock_quantity, minimum_stock, is_pending, is_active'),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('debts').select('remaining_balance, status, due_date'),
    ]);

    const salesList: Sale[] = (salesRes.data || []) as Sale[];
    const expensesList: Expense[] = (expensesRes.data || []) as Expense[];
    const debtPaymentsList: DebtPayment[] = (debtPaymentsRes.data || []) as DebtPayment[];
    const variantsList = variantsRes.data || [];
    const debtsList = debtsRes.data || [];

    const todaySales = salesList.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const todaySalesCount = salesList.length;
    const todayCashReceived = salesList.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
    const todayNewDebt = salesList.reduce((sum, s) => sum + Number(s.debt_amount || 0), 0);
    const todayDebtPayments = debtPaymentsList.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const todayCostOfGoods = salesList.reduce((sum, s) => sum + Number(s.cost_amount || 0), 0);
    const todayGrossProfit = salesList.reduce((sum, s) => sum + Number(s.gross_profit || 0), 0);
    const todayExpenses = expensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const todayNetProfit = todayGrossProfit - todayExpenses;

    const totalProductsCount = productsCountRes.count ?? 0;
    const totalVariantsCount = variantsList.filter(v => v.is_active && !v.is_pending).length;
    const lowStockCount = variantsList.filter(v => v.is_active && !v.is_pending && v.stock_quantity > 0 && v.stock_quantity <= (v.minimum_stock || 10)).length;
    const outOfStockCount = variantsList.filter(v => v.is_active && !v.is_pending && v.stock_quantity <= 0).length;
    const pendingProductsCount = variantsList.filter(v => v.is_pending).length;

    const overdueDebtCount = debtsList.filter(d => {
      if (d.status === 'paid' || Number(d.remaining_balance) <= 0) return false;
      if (!d.due_date) return false;
      return new Date(d.due_date) < now;
    }).length;

    const totalOutstandingDebt = debtsList.reduce((sum, d) => sum + (d.status !== 'paid' ? Number(d.remaining_balance || 0) : 0), 0);

    return {
      todaySales,
      todaySalesCount,
      todayCashReceived,
      todayNewDebt,
      todayDebtPayments,
      todayCostOfGoods,
      todayGrossProfit,
      todayExpenses,
      todayNetProfit,
      totalProductsCount,
      totalVariantsCount,
      lowStockCount,
      outOfStockCount,
      pendingProductsCount,
      overdueDebtCount,
      totalOutstandingDebt,
    };
  }

  public async getSalesReport(): Promise<SalesReportRow[]> {
    const user = await this.getCurrentUser();
    if (user?.role === 'seller') {
      throw new Error('Seller / Iibiye ma laha ogolaansho uu ku eego warbixinnada iibka.');
    }

    const { data: sales, error } = await supabase
      .from('sales')
      .select('created_at, total_amount, amount_paid, debt_amount, discount')
      .order('created_at', { ascending: false });

    if (error || !sales) return [];

    const grouped: Record<string, SalesReportRow> = {};

    for (const s of sales) {
      const date = s.created_at ? s.created_at.split('T')[0] : 'Unknown';
      if (!grouped[date]) {
        grouped[date] = {
          date,
          totalSales: 0,
          cashSales: 0,
          newDebt: 0,
          debtPayments: 0,
          totalDiscounts: 0,
          transactionCount: 0,
        };
      }
      grouped[date].totalSales += Number(s.total_amount || 0);
      grouped[date].cashSales += Number(s.amount_paid || 0);
      grouped[date].newDebt += Number(s.debt_amount || 0);
      grouped[date].totalDiscounts += Number(s.discount || 0);
      grouped[date].transactionCount += 1;
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }

  public async getProfitReport(): Promise<ProfitReportRow[]> {
    const user = await this.getCurrentUser();
    if (user?.role === 'seller') {
      throw new Error('Seller / Iibiye ma laha ogolaansho uu ku eego warbixinnada faa\'iidada.');
    }

    const [salesRes, expensesRes] = await Promise.all([
      supabase.from('sales').select('created_at, total_amount, cost_amount, gross_profit, amount_paid'),
      supabase.from('expenses').select('date, amount'),
    ]);

    const sales = salesRes.data || [];
    const expenses = expensesRes.data || [];

    const grouped: Record<string, ProfitReportRow> = {};

    for (const s of sales) {
      const date = s.created_at ? s.created_at.split('T')[0] : 'Unknown';
      if (!grouped[date]) {
        grouped[date] = {
          date,
          salesRevenue: 0,
          cogs: 0,
          grossProfit: 0,
          expenses: 0,
          netProfit: 0,
          cashReceived: 0,
        };
      }
      grouped[date].salesRevenue += Number(s.total_amount || 0);
      grouped[date].cogs += Number(s.cost_amount || 0);
      grouped[date].grossProfit += Number(s.gross_profit || 0);
      grouped[date].cashReceived += Number(s.amount_paid || 0);
    }

    for (const e of expenses) {
      const date = e.date || 'Unknown';
      if (!grouped[date]) {
        grouped[date] = {
          date,
          salesRevenue: 0,
          cogs: 0,
          grossProfit: 0,
          expenses: 0,
          netProfit: 0,
          cashReceived: 0,
        };
      }
      grouped[date].expenses += Number(e.amount || 0);
    }

    for (const date of Object.keys(grouped)) {
      grouped[date].netProfit = grouped[date].grossProfit - grouped[date].expenses;
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Helper to build date range boundaries for report queries
   */
  private buildReportDateRange(
    period: ReportDateFilterType = 'today',
    customStartDate?: string,
    customEndDate?: string
  ): { startDateIso?: string; endDateIso?: string } {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (period === 'today') {
      return {
        startDateIso: `${todayStr}T00:00:00`,
        endDateIso: `${todayStr}T23:59:59.999`,
      };
    } else if (period === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
      return {
        startDateIso: `${yesterdayStr}T00:00:00`,
        endDateIso: `${yesterdayStr}T23:59:59.999`,
      };
    } else if (period === 'week') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      return {
        startDateIso: `${weekStartStr}T00:00:00`,
        endDateIso: `${todayStr}T23:59:59.999`,
      };
    } else if (period === 'month') {
      const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return {
        startDateIso: `${monthStartStr}T00:00:00`,
        endDateIso: `${todayStr}T23:59:59.999`,
      };
    } else if (period === 'custom' && customStartDate) {
      const startStr = customStartDate.split('T')[0];
      const endStr = (customEndDate || customStartDate).split('T')[0];
      return {
        startDateIso: `${startStr}T00:00:00`,
        endDateIso: `${endStr}T23:59:59.999`,
      };
    }

    return {};
  }

  /**
   * Product Sales Report: aggregates quantity sold, sales revenue, paid, debt, and profit per product variant
   */
  public async getProductSalesReport(
    period: ReportDateFilterType = 'today',
    customStartDate?: string,
    customEndDate?: string,
    searchQuery: string = ''
  ): Promise<{ rows: ProductSalesReportRow[]; summary: ProductSalesReportSummary }> {
    const user = await this.getCurrentUser();
    if (user?.role === 'seller') {
      throw new Error('Seller / Iibiye ma laha ogolaansho uu ku eego warbixinnada alaabta.');
    }

    const { startDateIso, endDateIso } = this.buildReportDateRange(period, customStartDate, customEndDate);

    let query = supabase
      .from('sales')
      .select('id, created_at, payment_method, total_amount, amount_paid, debt_amount, items:sale_items(id, product_variant_id, quantity, unit, unit_price, unit_cost, discount, total_price, gross_profit, product_variant:product_variants(id, variant_name, selling_unit, product:products(id, name)))');

    if (startDateIso) {
      query = query.gte('created_at', startDateIso);
    }
    if (endDateIso) {
      query = query.lte('created_at', endDateIso);
    }

    const { data: sales, error } = await query.order('created_at', { ascending: false });

    if (error || !sales) {
      console.error('Error fetching product sales report:', error);
      return {
        rows: [],
        summary: { totalQuantity: 0, totalSales: 0, totalPaid: 0, totalDebt: 0, totalProfit: 0, uniqueProductsCount: 0 }
      };
    }

    const productMap: Record<string, ProductSalesReportRow> = {};

    for (const sale of sales) {
      const saleTotal = Number(sale.total_amount || 0);
      const salePaid = Number(sale.amount_paid || 0);
      const saleDebt = Number(sale.debt_amount || 0);
      const isCash = sale.payment_method === 'cash' || saleDebt === 0;
      const isCredit = sale.payment_method === 'credit' || salePaid === 0;
      const paidRatio = saleTotal > 0 ? (salePaid / saleTotal) : 1;

      const items = (sale.items || []) as any[];

      for (const item of items) {
        const pv = Array.isArray(item.product_variant) ? item.product_variant[0] : item.product_variant;
        const prod = pv?.product ? (Array.isArray(pv.product) ? pv.product[0] : pv.product) : undefined;
        const variantId = item.product_variant_id || pv?.id;
        if (!variantId) continue;

        const pName = prod?.name || 'Alaab';
        const vName = pv?.variant_name || '';
        const unit = item.unit || pv?.selling_unit || 'KG';
        const lineTotal = Math.round(Number(item.total_price || 0) * 100) / 100;
        const lineQty = Number(Number(item.quantity || 0).toFixed(4));
        const lineProfit = Math.round(Number(item.gross_profit || 0) * 100) / 100;

        let itemPaid = 0;
        let itemDebt = 0;
        if (isCash) {
          itemPaid = lineTotal;
          itemDebt = 0;
        } else if (isCredit) {
          itemPaid = 0;
          itemDebt = lineTotal;
        } else {
          itemPaid = Math.round(lineTotal * paidRatio * 100) / 100;
          itemDebt = Math.round((lineTotal - itemPaid) * 100) / 100;
        }

        if (!productMap[variantId]) {
          productMap[variantId] = {
            variantId,
            productId: prod?.id || '',
            productName: pName,
            variantName: vName,
            sellingUnit: unit,
            quantitySold: 0,
            totalSales: 0,
            totalPaid: 0,
            totalDebt: 0,
            totalProfit: 0,
            transactionCount: 0,
          };
        }

        productMap[variantId].quantitySold = Number((productMap[variantId].quantitySold + lineQty).toFixed(4));
        productMap[variantId].totalSales = Math.round((productMap[variantId].totalSales + lineTotal) * 100) / 100;
        productMap[variantId].totalPaid = Math.round((productMap[variantId].totalPaid + itemPaid) * 100) / 100;
        productMap[variantId].totalDebt = Math.round((productMap[variantId].totalDebt + itemDebt) * 100) / 100;
        productMap[variantId].totalProfit = Math.round((productMap[variantId].totalProfit + lineProfit) * 100) / 100;
        productMap[variantId].transactionCount += 1;
      }
    }

    let rows = Object.values(productMap);

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(r => 
        r.productName.toLowerCase().includes(q) || 
        r.variantName.toLowerCase().includes(q) ||
        r.sellingUnit.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => b.totalSales - a.totalSales);

    const summary: ProductSalesReportSummary = rows.reduce((acc, r) => ({
      totalQuantity: Number((acc.totalQuantity + r.quantitySold).toFixed(4)),
      totalSales: Math.round((acc.totalSales + r.totalSales) * 100) / 100,
      totalPaid: Math.round((acc.totalPaid + r.totalPaid) * 100) / 100,
      totalDebt: Math.round((acc.totalDebt + r.totalDebt) * 100) / 100,
      totalProfit: Math.round((acc.totalProfit + r.totalProfit) * 100) / 100,
      uniqueProductsCount: rows.length,
    }), {
      totalQuantity: 0,
      totalSales: 0,
      totalPaid: 0,
      totalDebt: 0,
      totalProfit: 0,
      uniqueProductsCount: 0,
    });

    return { rows, summary };
  }

  /**
   * Returns paginated individual transactions for a specific product variant in the selected period
   */
  public async getProductSaleTransactions(
    variantId: string,
    period: ReportDateFilterType = 'today',
    customStartDate?: string,
    customEndDate?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<ProductSaleTransactionDetail>> {
    const user = await this.getCurrentUser();
    if (user?.role === 'seller') {
      throw new Error('Seller / Iibiye ma laha ogolaansho uu ku eego xogta faahfaahsan ee iibka.');
    }

    const { startDateIso, endDateIso } = this.buildReportDateRange(period, customStartDate, customEndDate);

    let query = supabase
      .from('sale_items')
      .select('id, sale_id, quantity, unit, unit_price, total_price, gross_profit, created_at, sale:sales(id, created_at, payment_method, total_amount, amount_paid, debt_amount, customer:customers(name))', { count: 'exact' })
      .eq('product_variant_id', variantId);

    if (startDateIso) {
      query = query.gte('created_at', startDateIso);
    }
    if (endDateIso) {
      query = query.lte('created_at', endDateIso);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: items, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error || !items) {
      return { data: [], totalCount: 0, page, pageSize, totalPages: 1 };
    }

    const details: ProductSaleTransactionDetail[] = items.map((item: any) => {
      const sale = item.sale || {};
      const saleTotal = Number(sale.total_amount || 0);
      const salePaid = Number(sale.amount_paid || 0);
      const saleDebt = Number(sale.debt_amount || 0);
      const isCash = sale.payment_method === 'cash' || saleDebt === 0;
      const isCredit = sale.payment_method === 'credit' || salePaid === 0;
      const paidRatio = saleTotal > 0 ? (salePaid / saleTotal) : 1;
      const lineTotal = Math.round(Number(item.total_price || 0) * 100) / 100;

      let itemPaid = 0;
      let itemDebt = 0;
      if (isCash) {
        itemPaid = lineTotal;
        itemDebt = 0;
      } else if (isCredit) {
        itemPaid = 0;
        itemDebt = lineTotal;
      } else {
        itemPaid = Math.round(lineTotal * paidRatio * 100) / 100;
        itemDebt = Math.round((lineTotal - itemPaid) * 100) / 100;
      }

      return {
        saleId: item.sale_id || sale.id || '',
        saleCreatedAt: sale.created_at || item.created_at || '',
        customerName: sale.customer?.name || (sale.customer_id ? 'Macmiil' : 'Caddaan (Walk-in)'),
        paymentMethod: sale.payment_method || 'cash',
        quantity: Number(Number(item.quantity || 0).toFixed(4)),
        unit: item.unit || 'KG',
        unitPrice: Number(item.unit_price || 0),
        totalPrice: lineTotal,
        paidAmount: itemPaid,
        debtAmount: itemDebt,
        profit: Math.round(Number(item.gross_profit || 0) * 100) / 100,
      };
    });

    const totalCount = count ?? details.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      data: details,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }
}

export const repository = new ShopRepository();
