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
  ProductSalesReportRow,
  ProductSaleTransactionDetail,
  ProductSalesReportSummary,
  ReportDateFilterType,
  ManagementMode,
  AmountSellingOption,
  ProductBatch,
  BatchReconciliationPayload,
  OilBatchReportRow
} from '@/types';
import { 
  calculateCostPerBaseUnit, 
  calculateMinSellableQty,
  calculatePackRatio,
  calculateBatchCostPerUnit,
  calculateBatchVariance
} from '@/lib/calculations/stock';
import { calculateSaleTotal, calculateBatchProfitLoss } from '@/lib/calculations/financials';
import { calculateSosDenomination } from '@/lib/calculations/denominations';
import { generateId } from '@/lib/utils';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from '@/lib/supabase/client';

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Tukaan Shiine Supermarket',
  shopPhone: '+252 61 5500112',
  shopAddress: 'Suuqa Bakaaraha, Mogadishu',
  currency: '$',
  signatureUrl: '',
  receiptHeader: 'TUAKAAN SHIINE POS',
  receiptFooter: 'Mahadsanid! Soo Dhawoow Mar Kale.',
  lowStockEmailEnabled: true,
  outOfStockEmailEnabled: true,
  alertRecipientEmail: 'admin@tukaanshiine.so',
  alertRecipientRoles: ['admin'],
  alertRecipientUserIds: [],
  debtOverdueDays: 7,
  defaultPurchaseUnit: 'jawan',
  defaultSellingUnit: 'kg',
  defaultConversionFactor: 50,
  theme: 'light',
  language: 'so',
  dateFormat: 'DD/MM/YYYY',
};

class ShopRepository {
  // ==========================================
  // AUTHENTICATION & ROLE ACCESS CONTROL
  // ==========================================
  public async getCurrentShopId(): Promise<string | null> {
    try {
      if (!isSupabaseConfigured) return null;
      const { data, error } = await supabase
        .from('shops')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data.id;
    } catch {
      return null;
    }
  }

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

      let customRole: UserRole | null = null;
      let customName: string | null = null;

      if (profile?.role) {
        const roleStr = String(profile.role).toLowerCase();
        customRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
        customName = profile.full_name;
      } else {
        // Check shops.settings.users roster
        try {
          const { data: shop } = await supabase
            .from('shops')
            .select('settings')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (shop?.settings?.users && Array.isArray(shop.settings.users)) {
            const matching = shop.settings.users.find(
              (u: SystemUser) => u.id === user.id || u.email.toLowerCase() === (user.email || '').toLowerCase()
            );
            if (matching) {
              customRole = matching.role;
              customName = matching.name;
            }
          }
        } catch (e) {
          console.warn('Shop user check notice in getCurrentUser:', e);
        }
      }

      const roleStr = customRole || String(user.user_metadata?.role || '').toLowerCase();
      const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');

      return {
        id: user.id,
        name: customName || profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
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
      throw new Error(`Fadlan gal nidaamka si aad u fuliso: ${actionName}`);
    }
    if (user.role !== 'admin') {
      throw new Error(`Ma lihid ogolaansho (Admin kaliya ayaa qaban kara): ${actionName}`);
    }
    return user;
  }

  // ==========================================
  // AUDIT TRAIL LOGGING
  // ==========================================
  public async recordAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    previousValues?: any,
    newValues?: any,
    reason?: string,
    details?: any
  ): Promise<void> {
    try {
      if (!isSupabaseConfigured) return;
      const user = await this.getCurrentUser();

      await supabase.from('audit_logs').insert([{
        id: generateId(),
        user_id: user?.id || null,
        user_name: user?.name || 'Admin',
        user_role: user?.role || 'admin',
        action,
        entity_type: entityType,
        entity_id: entityId,
        previous_values: previousValues || null,
        new_values: newValues || null,
        reason: reason || null,
        details: details || null,
        created_at: new Date().toISOString(),
      }]);
    } catch (e) {
      console.warn('Could not record audit log:', e);
    }
  }

  public async getAuditLogs(
    search: string = '',
    entityFilter: string = '',
    actionFilter: string = '',
    page: number = 1,
    pageSize: number = 50
  ): Promise<AuditLog[]> {
    if (!isSupabaseConfigured) return [];

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (entityFilter && entityFilter !== 'all' && entityFilter !== '') {
      query = query.eq('entity_type', entityFilter);
    }

    if (actionFilter && actionFilter !== 'all' && actionFilter !== '') {
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
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        if (error) console.warn('[getSettings Warning]:', error.message);
        return { ...DEFAULT_SETTINGS };
      }

      const s = data.settings || {};

      return {
        shopName: data.name || s.shopName || DEFAULT_SETTINGS.shopName,
        shopPhone: data.phone || s.shopPhone || DEFAULT_SETTINGS.shopPhone,
        shopAddress: data.address || s.shopAddress || DEFAULT_SETTINGS.shopAddress,
        currency: data.currency || s.currency || DEFAULT_SETTINGS.currency,
        signatureUrl: s.signatureUrl || data.signature_url || '',
        receiptHeader: s.receiptHeader ?? DEFAULT_SETTINGS.receiptHeader,
        receiptFooter: s.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
        lowStockEmailEnabled: s.lowStockEmailEnabled ?? DEFAULT_SETTINGS.lowStockEmailEnabled,
        outOfStockEmailEnabled: s.outOfStockEmailEnabled ?? DEFAULT_SETTINGS.outOfStockEmailEnabled,
        alertRecipientEmail: s.alertRecipientEmail ?? DEFAULT_SETTINGS.alertRecipientEmail,
        alertRecipientRoles: Array.isArray(s.alertRecipientRoles) ? s.alertRecipientRoles : (DEFAULT_SETTINGS.alertRecipientRoles || ['admin']),
        alertRecipientUserIds: Array.isArray(s.alertRecipientUserIds) ? s.alertRecipientUserIds : [],
        debtOverdueDays: Number(s.debtOverdueDays ?? DEFAULT_SETTINGS.debtOverdueDays),
        defaultPurchaseUnit: s.defaultPurchaseUnit ?? DEFAULT_SETTINGS.defaultPurchaseUnit,
        defaultSellingUnit: s.defaultSellingUnit ?? DEFAULT_SETTINGS.defaultSellingUnit,
        defaultConversionFactor: Number(s.defaultConversionFactor ?? DEFAULT_SETTINGS.defaultConversionFactor),
        theme: s.theme ?? 'light',
        language: s.language ?? 'so',
        dateFormat: s.dateFormat ?? 'DD/MM/YYYY',
      };
    } catch (e) {
      console.warn('[getSettings Exception]:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  public async updateSettings(updates: Partial<ShopSettings>, reason?: string): Promise<ShopSettings> {
    await this.checkAdminAuth('Wax ka beddelka Habaynta (Settings)');

    const current = await this.getSettings();
    const updated: ShopSettings = { ...current, ...updates };

    const { data: existingShop, error: fetchErr } = await supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.warn('[updateSettings fetch existingShop notice]:', fetchErr.message);
    }

    // Preserve existing internal JSON settings (such as variant_pricing, variant_fractions)
    const existingJsonSettings = existingShop?.settings || {};
    const mergedJsonSettings = {
      ...existingJsonSettings,
      ...updated,
      signatureUrl: updated.signatureUrl || '',
    };

    const shopPayload: any = {
      name: updated.shopName.trim(),
      phone: updated.shopPhone.trim(),
      address: updated.shopAddress.trim(),
      currency: updated.currency.trim(),
      settings: mergedJsonSettings,
      updated_at: new Date().toISOString(),
    };

    if (existingShop) {
      const { error: updateError } = await supabase
        .from('shops')
        .update(shopPayload)
        .eq('id', existingShop.id);

      if (updateError) {
        console.error('[updateSettings Error]:', updateError);
        throw new Error(`Khalad keydinta habaynta database-ka: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('shops')
        .insert([shopPayload]);

      if (insertError) {
        console.error('[insertSettings Error]:', insertError);
        throw new Error(`Khalad abuurista habaynta database-ka: ${insertError.message}`);
      }
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
  // RESEND EMAIL ALERTS & NOTIFICATIONS
  // ==========================================
  public async getAlertRecipients(settings?: ShopSettings): Promise<string[]> {
    try {
      const currentSettings = settings || await this.getSettings();
      const emails = new Set<string>();

      // 1. Resolve registered users by configured roles (Admin, Seller, Reporter)
      const allowedRoles = currentSettings.alertRecipientRoles || ['admin'];
      const users = await this.getUsers();

      for (const u of users) {
        if (allowedRoles.includes(u.role) && u.email && u.email.includes('@')) {
          emails.add(u.email.trim().toLowerCase());
        }
        if (currentSettings.alertRecipientUserIds?.includes(u.id) && u.email && u.email.includes('@')) {
          emails.add(u.email.trim().toLowerCase());
        }
      }

      // 2. Add custom / direct recipient email if provided
      if (currentSettings.alertRecipientEmail && currentSettings.alertRecipientEmail.includes('@')) {
        emails.add(currentSettings.alertRecipientEmail.trim().toLowerCase());
      }

      return Array.from(emails);
    } catch (e) {
      console.warn('[getAlertRecipients error]:', e);
      return [];
    }
  }

  public async sendTestAlertEmail(recipientEmail?: string): Promise<{ success: boolean; messageId?: string; error?: string; recipients?: string[] }> {
    const user = await this.checkAdminAuth('Diritaanka Email-ka Tijaabada Ah');
    const settings = await this.getSettings();
    
    let targets: string[] = [];
    if (recipientEmail && recipientEmail.includes('@')) {
      targets = [recipientEmail.trim()];
    } else {
      targets = await this.getAlertRecipients(settings);
    }

    if (targets.length === 0) {
      throw new Error('Fadlan geli ama dooro email sax ah oo loo diro tijaabada.');
    }

    const res = await fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmails: targets,
        shopName: settings.shopName,
        adminName: user.name || 'Admin',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Diritaanka email-ka tijaabada ah wuu fashilmay');
    }

    return data;
  }

  public async triggerStockAlert(params: {
    variantId: string;
    productName: string;
    variantName?: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    sku?: string;
    barcode?: string;
  }): Promise<void> {
    try {
      const settings = await this.getSettings();
      const targets = await this.getAlertRecipients(settings);
      if (targets.length === 0) return;

      // Asynchronously call the stock alert API endpoint (non-blocking)
      fetch('/api/alerts/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          shopName: settings.shopName,
          recipientEmails: targets,
          lowStockEnabled: settings.lowStockEmailEnabled,
          outOfStockEnabled: settings.outOfStockEmailEnabled,
        }),
      }).catch((err) => console.warn('[Stock Alert Notice]:', err));
    } catch (e) {
      console.warn('[triggerStockAlert error]:', e);
    }
  }

  public async triggerDebtReminderAlert(debt: Debt): Promise<{ success: boolean; messageId?: string; error?: string; skipped?: boolean; reason?: string; recipients?: string[] }> {
    try {
      const settings = await this.getSettings();
      const targets = await this.getAlertRecipients(settings);
      if (targets.length === 0) {
        return { success: false, error: 'Email-ka digniinta lama habayn' };
      }

      const res = await fetch('/api/alerts/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtId: debt.id,
          recipientEmails: targets,
          shopName: settings.shopName,
          customerName: debt.customer?.name || 'Macmiil',
          customerPhone: debt.customer?.phone || '',
          originalAmount: debt.original_amount,
          amountPaid: debt.amount_paid,
          remainingBalance: debt.remaining_balance,
          dueDate: debt.due_date,
          currency: settings.currency || '$',
          itemsSummary: debt.items_summary,
        }),
      });

      return await res.json();
    } catch (e: any) {
      console.warn('[triggerDebtReminderAlert error]:', e);
      return { success: false, error: e?.message || 'Error triggering debt alert' };
    }
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
  // FRACTIONAL & PRICING MODE PERSISTENCE HELPERS
  // ==========================================
  private async getVariantMaps(): Promise<{
    fractionsMap: Record<string, { unit_division: number; min_sellable_qty: number }>;
    pricingMap: Record<string, { pricing_mode: 'fixed' | 'denomination'; sos_price?: number }>;
    modelsMap: Record<string, {
      management_mode?: ManagementMode;
      source_quantity?: number;
      source_unit?: string;
      pack_count?: number;
      selling_pack_unit?: string;
      container_unit?: string;
      container_capacity_liters?: number;
      selling_options?: AmountSellingOption[];
    }>;
  }> {
    try {
      const { data, error } = await supabase.from('shops').select('settings').limit(1).maybeSingle();
      if (!error && data && data.settings && typeof data.settings === 'object') {
        return {
          fractionsMap: (data.settings.variant_fractions || {}) as Record<string, { unit_division: number; min_sellable_qty: number }>,
          pricingMap: (data.settings.variant_pricing || {}) as Record<string, { pricing_mode: 'fixed' | 'denomination'; sos_price?: number }>,
          modelsMap: (data.settings.variant_models || {}) as Record<string, any>
        };
      }
    } catch (err) {
      console.warn('Error reading variant maps:', err);
    }
    return { fractionsMap: {}, pricingMap: {}, modelsMap: {} };
  }

  private async getVariantFractionsMap(): Promise<Record<string, { unit_division: number; min_sellable_qty: number }>> {
    const maps = await this.getVariantMaps();
    return maps.fractionsMap;
  }

  private async getVariantPricingMap(): Promise<Record<string, { pricing_mode: 'fixed' | 'denomination'; sos_price?: number }>> {
    const maps = await this.getVariantMaps();
    return maps.pricingMap;
  }

  private async saveVariantFraction(variantId: string, unit_division: number, min_sellable_qty: number): Promise<void> {
    try {
      const { data: shop } = await supabase.from('shops').select('id, settings').limit(1).maybeSingle();
      if (shop) {
        const currentSettings = typeof shop.settings === 'object' && shop.settings !== null ? shop.settings : {};
        const updatedFractions = {
          ...(currentSettings.variant_fractions || {}),
          [variantId]: {
            unit_division,
            min_sellable_qty
          }
        };
        await supabase.from('shops').update({
          settings: {
            ...currentSettings,
            variant_fractions: updatedFractions
          }
        }).eq('id', shop.id);
      }
    } catch (err) {
      console.warn('Error saving variant fraction to shop settings:', err);
    }
  }

  private async saveVariantPricing(variantId: string, pricing_mode: 'fixed' | 'denomination', sos_price?: number): Promise<void> {
    try {
      const { data: shop } = await supabase.from('shops').select('id, settings').limit(1).maybeSingle();
      if (shop) {
        const currentSettings = typeof shop.settings === 'object' && shop.settings !== null ? shop.settings : {};
        const updatedPricing = {
          ...(currentSettings.variant_pricing || {}),
          [variantId]: {
            pricing_mode,
            sos_price: sos_price && Number(sos_price) > 0 ? Number(sos_price) : undefined
          }
        };
        await supabase.from('shops').update({
          settings: {
            ...currentSettings,
            variant_pricing: updatedPricing
          }
        }).eq('id', shop.id);
      }
    } catch (err) {
      console.warn('Error saving variant pricing to shop settings:', err);
    }
  }

  private async saveVariantModel(variantId: string, modelData: {
    management_mode?: ManagementMode;
    source_quantity?: number;
    source_unit?: string;
    pack_count?: number;
    selling_pack_unit?: string;
    container_unit?: string;
    container_capacity_liters?: number;
    selling_options?: AmountSellingOption[];
  }): Promise<void> {
    try {
      const { data: shop } = await supabase.from('shops').select('id, settings').limit(1).maybeSingle();
      if (shop) {
        const currentSettings = typeof shop.settings === 'object' && shop.settings !== null ? shop.settings : {};
        const updatedModels = {
          ...(currentSettings.variant_models || {}),
          [variantId]: modelData
        };
        await supabase.from('shops').update({
          settings: {
            ...currentSettings,
            variant_models: updatedModels
          }
        }).eq('id', shop.id);
      }
    } catch (err) {
      console.warn('Error saving variant model to shop settings:', err);
    }
  }

  private formatVariantWithFractions(
    v: any, 
    fractionsMap?: Record<string, any>,
    pricingMap?: Record<string, any>,
    modelsMap?: Record<string, any>
  ): ProductVariant {
    const fraction = fractionsMap?.[v.id];
    const pricing = pricingMap?.[v.id];
    const model = modelsMap?.[v.id];

    const unit_division = Number(v.unit_division) > 0 
      ? Number(v.unit_division) 
      : (fraction?.unit_division && Number(fraction.unit_division) > 0 
          ? Number(fraction.unit_division) 
          : (Number(v.min_sellable_qty) > 0 
              ? Math.round(1 / Number(v.min_sellable_qty)) 
              : 1));
              
    const min_sellable_qty = Number(v.min_sellable_qty) > 0 
      ? Number(v.min_sellable_qty) 
      : (fraction?.min_sellable_qty && Number(fraction.min_sellable_qty) > 0 
          ? Number(fraction.min_sellable_qty) 
          : calculateMinSellableQty(unit_division));

    // Pricing mode: Mode A ('denomination') or Mode B ('fixed'). Default to 'fixed' for safety
    const pricing_mode: 'fixed' | 'denomination' = (v.pricing_mode === 'denomination' || pricing?.pricing_mode === 'denomination')
      ? 'denomination'
      : 'fixed';

    const sos_price = Number(v.sos_price) > 0 
      ? Number(v.sos_price) 
      : (pricing?.sos_price && Number(pricing.sos_price) > 0 ? Number(pricing.sos_price) : undefined);

    const management_mode: ManagementMode = (v.management_mode || model?.management_mode || 'standard') as ManagementMode;
    const source_quantity = v.source_quantity !== undefined && v.source_quantity !== null ? Number(v.source_quantity) : model?.source_quantity;
    const source_unit = v.source_unit || model?.source_unit;
    const pack_count = v.pack_count !== undefined && v.pack_count !== null ? Number(v.pack_count) : model?.pack_count;
    const selling_pack_unit = v.selling_pack_unit || model?.selling_pack_unit;
    const container_unit = v.container_unit || model?.container_unit;
    const container_capacity_liters = v.container_capacity_liters !== undefined && v.container_capacity_liters !== null ? Number(v.container_capacity_liters) : model?.container_capacity_liters;
    const selling_options = Array.isArray(v.selling_options) && v.selling_options.length > 0 
      ? v.selling_options 
      : (Array.isArray(model?.selling_options) ? model.selling_options : undefined);

    return {
      ...v,
      unit_division,
      min_sellable_qty,
      pricing_mode,
      sos_price,
      management_mode,
      source_quantity,
      source_unit,
      pack_count,
      selling_pack_unit,
      container_unit,
      container_capacity_liters,
      selling_options,
      category: v.product?.category || v.category,
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

    const { fractionsMap, pricingMap } = await this.getVariantMaps();
    let results = (data || []).map(v => this.formatVariantWithFractions(v, fractionsMap, pricingMap));

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
    const { fractionsMap, pricingMap } = await this.getVariantMaps();
    return {
      ...data,
      variants: (data.variants || []).map((v: any) => this.formatVariantWithFractions(v, fractionsMap, pricingMap)),
    } as Product;
  }

  public async getVariantById(id: string): Promise<ProductVariant | null> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    const { fractionsMap, pricingMap } = await this.getVariantMaps();
    return this.formatVariantWithFractions(data, fractionsMap, pricingMap);
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
    const { fractionsMap, pricingMap, modelsMap } = await this.getVariantMaps();
    return this.formatVariantWithFractions(data, fractionsMap, pricingMap, modelsMap);
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
      pricing_mode?: 'fixed' | 'denomination';
      sos_price?: number;
      stock_quantity: number;
      minimum_stock: number;
      supplier_id?: string;
      image_url?: string;
      management_mode?: ManagementMode;
      source_quantity?: number;
      source_unit?: string;
      pack_count?: number;
      selling_pack_unit?: string;
      container_unit?: string;
      container_capacity_liters?: number;
      selling_options?: AmountSellingOption[];
      initial_containers?: number;
      batch_cost?: number;
      batch_reference?: string;
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

    const managementMode: ManagementMode = variantData.management_mode || 'standard';
    let division = Math.max(1, Number(variantData.unit_division) || 1);
    let minSellable = variantData.min_sellable_qty !== undefined && Number(variantData.min_sellable_qty) > 0
      ? Number(variantData.min_sellable_qty)
      : calculateMinSellableQty(division);

    let purchaseUnit = variantData.purchase_unit || 'jawan';
    let sellingUnit = variantData.selling_unit || 'kg';
    let conversionFactor = Number(variantData.conversion_factor) || 1;
    let initialStock = Number(variantData.stock_quantity) || 0;

    if (managementMode === 'pack_based') {
      division = 1;
      minSellable = 1;
      sellingUnit = variantData.selling_pack_unit || 'bac';
      purchaseUnit = variantData.source_unit || 'g';
      initialStock = Number(variantData.pack_count) || initialStock;
    } else if (managementMode === 'amount_based') {
      sellingUnit = 'liter';
      purchaseUnit = variantData.container_unit || 'caag';
      conversionFactor = Number(variantData.container_capacity_liters) || 20;
      if (variantData.initial_containers && variantData.initial_containers > 0) {
        initialStock = Number((variantData.initial_containers * conversionFactor).toFixed(4));
      }
      minSellable = minSellable > 0 ? minSellable : 0.25;
    }

    const pricingMode: 'fixed' | 'denomination' = variantData.pricing_mode === 'denomination' ? 'denomination' : 'fixed';
    const sosPrice = Number(variantData.sos_price) > 0 ? Number(variantData.sos_price) : null;

    const newVariant: any = {
      id: variantId,
      product_id: productId,
      variant_name: variantData.variant_name.trim() || 'Default',
      sku: variantData.sku?.trim() || null,
      barcode: variantData.barcode?.trim() || null,
      buy_price: Number(variantData.buy_price) || 0,
      purchase_unit: purchaseUnit,
      sell_price: Number(variantData.sell_price) || 0,
      selling_unit: sellingUnit,
      conversion_factor: conversionFactor,
      unit_division: division,
      min_sellable_qty: minSellable,
      pricing_mode: pricingMode,
      sos_price: sosPrice,
      stock_quantity: initialStock,
      minimum_stock: Number(variantData.minimum_stock) || 10,
      supplier_id: variantData.supplier_id || null,
      image_url: variantData.image_url || null,
      management_mode: managementMode,
      source_quantity: variantData.source_quantity !== undefined ? Number(variantData.source_quantity) : null,
      source_unit: variantData.source_unit || null,
      pack_count: variantData.pack_count !== undefined ? Number(variantData.pack_count) : null,
      selling_pack_unit: variantData.selling_pack_unit || null,
      container_unit: variantData.container_unit || null,
      container_capacity_liters: variantData.container_capacity_liters !== undefined ? Number(variantData.container_capacity_liters) : null,
      selling_options: variantData.selling_options || null,
      is_active: true,
      is_pending: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let varCreated: any = null;
    let { data: varData, error: varErr } = await supabase
      .from('product_variants')
      .insert([newVariant])
      .select()
      .single();

    if (varErr) {
      console.warn('[Supabase Schema] Retry saving base variant columns...');
      const { 
        unit_division, min_sellable_qty, pricing_mode, sos_price,
        management_mode, source_quantity, source_unit, pack_count, selling_pack_unit,
        container_unit, container_capacity_liters, selling_options,
        ...fallbackVariant 
      } = newVariant;

      const fallbackRes = await supabase
        .from('product_variants')
        .insert([fallbackVariant])
        .select()
        .single();

      if (!fallbackRes.error && fallbackRes.data) {
        varCreated = { 
          ...fallbackRes.data, 
          unit_division, 
          min_sellable_qty, 
          pricing_mode: pricingMode, 
          sos_price: sosPrice || undefined,
          management_mode: managementMode,
          source_quantity: variantData.source_quantity,
          source_unit: variantData.source_unit,
          pack_count: variantData.pack_count,
          selling_pack_unit: variantData.selling_pack_unit,
          container_unit: variantData.container_unit,
          container_capacity_liters: variantData.container_capacity_liters,
          selling_options: variantData.selling_options,
        };
        varErr = null;
      } else if (fallbackRes.error) {
        varErr = fallbackRes.error;
      }
    } else {
      varCreated = varData;
    }

    if (varErr) {
      throw new Error(`Khalad abuurista variant: ${varErr.message}`);
    }

    // Persist fractional division, pricing mode & model data directly to Supabase settings store
    await this.saveVariantFraction(variantId, division, minSellable);
    await this.saveVariantPricing(variantId, pricingMode, sosPrice || undefined);
    await this.saveVariantModel(variantId, {
      management_mode: managementMode,
      source_quantity: variantData.source_quantity,
      source_unit: variantData.source_unit,
      pack_count: variantData.pack_count,
      selling_pack_unit: variantData.selling_pack_unit,
      container_unit: variantData.container_unit,
      container_capacity_liters: variantData.container_capacity_liters,
      selling_options: variantData.selling_options,
    });

    const { fractionsMap, pricingMap, modelsMap } = await this.getVariantMaps();
    varCreated = this.formatVariantWithFractions(varCreated, fractionsMap, pricingMap, modelsMap);

    // If amount_based with initial stock, create initial batch record
    if (managementMode === 'amount_based' && initialStock > 0) {
      const containerCount = variantData.initial_containers || Number((initialStock / conversionFactor).toFixed(2));
      const totalBatchCost = variantData.batch_cost !== undefined && Number(variantData.batch_cost) > 0
        ? Number(variantData.batch_cost)
        : Number((variantData.buy_price * containerCount).toFixed(2));
      const costPerLiter = initialStock > 0 ? Number((totalBatchCost / initialStock).toFixed(4)) : 0;

      const batchPayload: ProductBatch = {
        id: generateId(),
        product_variant_id: variantId,
        batch_number: variantData.batch_reference?.trim() || `DUF-${Date.now().toString().slice(-4)}`,
        container_count: containerCount,
        liters_per_container: conversionFactor,
        total_liters: initialStock,
        remaining_quantity: initialStock,
        total_purchase_cost: totalBatchCost,
        cost_per_liter: costPerLiter,
        cost_currency: '$',
        supplier_id: variantData.supplier_id || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await supabase.from('product_batches').insert([batchPayload]);
      } catch (bErr) {
        console.warn('Fallback saving batch to settings:', bErr);
      }
      await this.saveProductBatchToSettings(batchPayload);
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

    const managementMode: ManagementMode = updates.management_mode || updates.managementMode || prev.management_mode || 'standard';

    let division = updates.unit_division !== undefined 
      ? Math.max(1, Number(updates.unit_division) || 1) 
      : (updates.unitDivision !== undefined 
          ? Math.max(1, Number(updates.unitDivision) || 1) 
          : Math.max(1, Number(prev.unit_division) || 1));

    let minSellable = updates.min_sellable_qty !== undefined && Number(updates.min_sellable_qty) > 0
      ? Number(updates.min_sellable_qty)
      : (updates.minSellableQty !== undefined && Number(updates.minSellableQty) > 0
        ? Number(updates.minSellableQty)
        : (prev.min_sellable_qty ? Number(prev.min_sellable_qty) : calculateMinSellableQty(division)));

    let purchaseUnit = updates.purchase_unit || updates.purchaseUnit || prev.purchase_unit || 'jawan';
    let sellingUnit = updates.selling_unit || updates.sellingUnit || prev.selling_unit || 'kg';
    let conversionFactor = updates.conversion_factor !== undefined ? Number(updates.conversion_factor) : (updates.conversionFactor !== undefined ? Number(updates.conversionFactor) : Number(prev.conversion_factor || 1));

    if (managementMode === 'pack_based') {
      division = 1;
      minSellable = 1;
      sellingUnit = updates.selling_pack_unit || updates.sellingPackUnit || prev.selling_pack_unit || sellingUnit || 'bac';
      purchaseUnit = updates.source_unit || updates.sourceUnit || prev.source_unit || purchaseUnit || 'g';
    } else if (managementMode === 'amount_based') {
      sellingUnit = 'liter';
      purchaseUnit = updates.container_unit || updates.containerUnit || prev.container_unit || purchaseUnit || 'caag';
      conversionFactor = updates.container_capacity_liters !== undefined 
        ? Number(updates.container_capacity_liters) 
        : (updates.containerCapacityLiters !== undefined ? Number(updates.containerCapacityLiters) : Number(prev.container_capacity_liters || conversionFactor || 20));
      minSellable = minSellable > 0 ? minSellable : 0.25;
    }

    const pricingMode = updates.pricing_mode || updates.pricingMode;
    const sosPrice = updates.sos_price !== undefined ? updates.sos_price : updates.sosPrice;

    const variantUpdates: any = {
      variant_name: (updates.variant_name || updates.variantName || prev.variant_name || '').trim(),
      sku: updates.sku !== undefined ? (typeof updates.sku === 'string' && updates.sku.trim() ? updates.sku.trim() : null) : (prev.sku || null),
      barcode: updates.barcode !== undefined ? (typeof updates.barcode === 'string' && updates.barcode.trim() ? updates.barcode.trim() : null) : (prev.barcode || null),
      buy_price: updates.buy_price !== undefined ? Number(updates.buy_price) : (updates.buyPrice !== undefined ? Number(updates.buyPrice) : Number(prev.buy_price || 0)),
      purchase_unit: purchaseUnit,
      sell_price: updates.sell_price !== undefined ? Number(updates.sell_price) : (updates.sellPrice !== undefined ? Number(updates.sellPrice) : Number(prev.sell_price || 0)),
      selling_unit: sellingUnit,
      conversion_factor: conversionFactor,
      unit_division: division,
      min_sellable_qty: minSellable,
      pricing_mode: pricingMode ? (pricingMode === 'denomination' ? 'denomination' : 'fixed') : (prev.pricing_mode || 'fixed'),
      sos_price: sosPrice !== undefined ? (Number(sosPrice) > 0 ? Number(sosPrice) : null) : (prev.sos_price || null),
      minimum_stock: updates.minimum_stock !== undefined ? Number(updates.minimum_stock) : (updates.minimumStock !== undefined ? Number(updates.minimumStock) : Number(prev.minimum_stock || 0)),
      supplier_id: cleanSupplierId,
      management_mode: managementMode,
      source_quantity: updates.source_quantity !== undefined ? Number(updates.source_quantity) : (updates.sourceQuantity !== undefined ? Number(updates.sourceQuantity) : prev.source_quantity),
      source_unit: updates.source_unit || updates.sourceUnit || prev.source_unit || null,
      pack_count: updates.pack_count !== undefined ? Number(updates.pack_count) : (updates.packCount !== undefined ? Number(updates.packCount) : prev.pack_count),
      selling_pack_unit: updates.selling_pack_unit || updates.sellingPackUnit || prev.selling_pack_unit || null,
      container_unit: updates.container_unit || updates.containerUnit || prev.container_unit || null,
      container_capacity_liters: updates.container_capacity_liters !== undefined ? Number(updates.container_capacity_liters) : (updates.containerCapacityLiters !== undefined ? Number(updates.containerCapacityLiters) : prev.container_capacity_liters),
      selling_options: updates.selling_options || updates.sellingOptions || prev.selling_options || null,
      updated_at: new Date().toISOString(),
    };

    let { data: updated, error } = await supabase
      .from('product_variants')
      .update(variantUpdates)
      .eq('id', id)
      .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)')
      .single();

    if (error) {
      console.warn('[Supabase Schema] Column not in schema cache during update. Retrying without extra columns...');
      const { 
        unit_division, min_sellable_qty, pricing_mode, sos_price,
        management_mode, source_quantity, source_unit, pack_count, selling_pack_unit,
        container_unit, container_capacity_liters, selling_options,
        ...fallbackUpdates 
      } = variantUpdates;
      const retryRes = await supabase
        .from('product_variants')
        .update(fallbackUpdates)
        .eq('id', id)
        .select('*, product:products(*, category:categories(*)), supplier:suppliers(*)')
        .single();
      if (!retryRes.error && retryRes.data) {
        updated = { 
          ...retryRes.data, 
          unit_division, 
          min_sellable_qty, 
          pricing_mode: variantUpdates.pricing_mode, 
          sos_price: variantUpdates.sos_price || undefined,
          management_mode: variantUpdates.management_mode,
          source_quantity: variantUpdates.source_quantity,
          source_unit: variantUpdates.source_unit,
          pack_count: variantUpdates.pack_count,
          selling_pack_unit: variantUpdates.selling_pack_unit,
          container_unit: variantUpdates.container_unit,
          container_capacity_liters: variantUpdates.container_capacity_liters,
          selling_options: variantUpdates.selling_options,
        };
        error = null;
      } else if (retryRes.error) {
        error = retryRes.error;
      }
    }

    if (error) {
      throw new Error(`Khalad beddelka variant: ${error.message}`);
    }

    // Persist fractional division & pricing mode & model data directly to Supabase settings store
    await this.saveVariantFraction(id, division, minSellable);
    if (pricingMode !== undefined || sosPrice !== undefined) {
      const modeToSave = pricingMode === 'denomination' ? 'denomination' : (pricingMode === 'fixed' ? 'fixed' : (prev.pricing_mode || 'fixed'));
      const sosToSave = sosPrice !== undefined ? (Number(sosPrice) > 0 ? Number(sosPrice) : undefined) : prev.sos_price;
      await this.saveVariantPricing(id, modeToSave, sosToSave);
    }
    await this.saveVariantModel(id, {
      management_mode: variantUpdates.management_mode,
      source_quantity: variantUpdates.source_quantity,
      source_unit: variantUpdates.source_unit,
      pack_count: variantUpdates.pack_count,
      selling_pack_unit: variantUpdates.selling_pack_unit,
      container_unit: variantUpdates.container_unit,
      container_capacity_liters: variantUpdates.container_capacity_liters,
      selling_options: variantUpdates.selling_options,
    });

    const { fractionsMap, pricingMap, modelsMap } = await this.getVariantMaps();
    updated = this.formatVariantWithFractions(updated, fractionsMap, pricingMap, modelsMap);

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

    // Trigger email alert if stock dropped to or below minimum stock threshold
    if (newQty <= Number(variant.minimum_stock || 10)) {
      this.triggerStockAlert({
        variantId: variant.id,
        productName: variant.product?.name || 'Alaab',
        variantName: variant.variant_name || 'Default',
        currentStock: newQty,
        minimumStock: Number(variant.minimum_stock || 10),
        unit: variant.selling_unit || 'kg',
        sku: variant.sku,
        barcode: variant.barcode,
      });
    }

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
      pricing_mode?: 'fixed' | 'denomination';
      pricingMode?: 'fixed' | 'denomination';
      sos_price?: number;
      sosPrice?: number;
      buyPrice: number;
      sellPrice: number;
      minimumStock?: number;
      supplierId?: string;
      categoryId?: string;
      management_mode?: ManagementMode;
      managementMode?: ManagementMode;
      source_quantity?: number;
      sourceQuantity?: number;
      source_unit?: string;
      sourceUnit?: string;
      pack_count?: number;
      packCount?: number;
      selling_pack_unit?: string;
      sellingPackUnit?: string;
      container_unit?: string;
      containerUnit?: string;
      container_capacity_liters?: number;
      containerCapacityLiters?: number;
      initial_containers?: number;
      container_count?: number;
      containerCount?: number;
      total_purchase_cost?: number;
      totalPurchaseCost?: number;
      batch_total_cost?: number;
      batch_cost?: number;
      batchCost?: number;
      batch_reference?: string;
      batchReference?: string;
      selling_options?: AmountSellingOption[];
      sellingOptions?: AmountSellingOption[];
    },
    reason?: string
  ): Promise<{ success: boolean; variant_id: string; batch_id?: string }> {
    await this.checkAdminAuth('Soo galis Alaab (Stock In)');

    const mMode: ManagementMode = data.management_mode || data.managementMode || 'standard';
    let division = Math.max(1, Number(data.unitDivision) || 1);
    let minSellable = data.minSellableQty !== undefined && Number(data.minSellableQty) > 0
      ? Number(data.minSellableQty)
      : calculateMinSellableQty(division);
    const pMode = (data.pricing_mode || data.pricingMode) === 'denomination' ? 'denomination' : 'fixed';
    const sPrice = Number(data.sos_price || data.sosPrice) > 0 ? Number(data.sos_price || data.sosPrice) : undefined;

    let purchaseUnit = data.purchaseUnit || 'jawan';
    let sellingUnit = data.sellingUnit || 'kg';
    let conversionFactor = Number(data.conversionFactor) || 1;
    let addedQtyInSelling = Number((data.quantity * conversionFactor).toFixed(4));
    let batchTotalCost = Number(data.total_purchase_cost || data.totalPurchaseCost || data.batch_cost || data.batchCost || 0);

    if (mMode === 'pack_based') {
      division = 1;
      minSellable = 1;
      sellingUnit = data.selling_pack_unit || data.sellingPackUnit || data.sellingUnit || 'bac';
      purchaseUnit = data.source_unit || data.sourceUnit || data.purchaseUnit || 'g';
      addedQtyInSelling = Number(data.pack_count || data.packCount || data.quantity);
    } else if (mMode === 'amount_based') {
      sellingUnit = 'liter';
      purchaseUnit = data.container_unit || data.containerUnit || data.purchaseUnit || 'caag';
      const containerCapacity = Number(data.container_capacity_liters || data.containerCapacityLiters || conversionFactor || 20);
      conversionFactor = containerCapacity;
      const containers = Number(data.container_count || data.containerCount || data.initial_containers || data.quantity || 1);
      addedQtyInSelling = Number((containers * containerCapacity).toFixed(4));
      if (!batchTotalCost || batchTotalCost <= 0) {
        batchTotalCost = Number((data.buyPrice * containers).toFixed(2));
      }
      minSellable = minSellable > 0 ? minSellable : 0.25;
    }

    // Search for existing product & variant
    const { data: existingProds } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', data.productName.trim())
      .limit(1);

    let productId = existingProds?.[0]?.id;
    let variantId: string | null = null;
    let createdBatchId: string | undefined = undefined;

    if (productId) {
      const { data: existingVars } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .ilike('variant_name', data.variantName.trim())
        .limit(1);

      if (existingVars?.[0]) {
        const vId = existingVars[0].id;
        variantId = vId;
        const currentVar = existingVars[0];
        const prevStock = Number(currentVar.stock_quantity);
        const newStock = Number((prevStock + addedQtyInSelling).toFixed(4));

        const effectiveBuyPrice = (mMode === 'amount_based' && addedQtyInSelling > 0 && batchTotalCost > 0)
          ? Number((batchTotalCost / addedQtyInSelling).toFixed(4))
          : data.buyPrice;

        const updatePayload: any = {
          stock_quantity: newStock,
          buy_price: effectiveBuyPrice,
          sell_price: data.sellPrice,
          purchase_unit: purchaseUnit,
          selling_unit: sellingUnit,
          conversion_factor: conversionFactor,
          unit_division: division,
          min_sellable_qty: minSellable,
          pricing_mode: pMode,
          sos_price: sPrice || null,
          minimum_stock: data.minimumStock || currentVar.minimum_stock,
          supplier_id: data.supplierId || currentVar.supplier_id,
          management_mode: mMode,
          source_quantity: data.source_quantity || data.sourceQuantity || currentVar.source_quantity,
          source_unit: data.source_unit || data.sourceUnit || currentVar.source_unit,
          pack_count: data.pack_count || data.packCount || currentVar.pack_count,
          selling_pack_unit: data.selling_pack_unit || data.sellingPackUnit || currentVar.selling_pack_unit,
          container_unit: data.container_unit || data.containerUnit || currentVar.container_unit,
          container_capacity_liters: data.container_capacity_liters || data.containerCapacityLiters || currentVar.container_capacity_liters,
          selling_options: data.selling_options || data.sellingOptions || currentVar.selling_options,
          updated_at: new Date().toISOString(),
        };

        let { error: stockUpErr } = await supabase.from('product_variants').update(updatePayload).eq('id', vId);
        if (stockUpErr) {
          const { 
            unit_division, min_sellable_qty, pricing_mode, sos_price,
            management_mode, source_quantity, source_unit, pack_count, selling_pack_unit,
            container_unit, container_capacity_liters, selling_options,
            ...fallbackStockPayload 
          } = updatePayload;
          await supabase.from('product_variants').update(fallbackStockPayload).eq('id', vId);
        }

        // Persist fractional division, pricing mode & model data
        await this.saveVariantFraction(vId, division, minSellable);
        if (data.pricing_mode || data.pricingMode || data.sos_price || data.sosPrice) {
          await this.saveVariantPricing(vId, pMode, sPrice);
        }
        await this.saveVariantModel(vId, {
          management_mode: mMode,
          source_quantity: updatePayload.source_quantity,
          source_unit: updatePayload.source_unit,
          pack_count: updatePayload.pack_count,
          selling_pack_unit: updatePayload.selling_pack_unit,
          container_unit: updatePayload.container_unit,
          container_capacity_liters: updatePayload.container_capacity_liters,
          selling_options: updatePayload.selling_options,
        });

        // If amount_based oil, create a separate batch record
        if (mMode === 'amount_based') {
          const containers = Number(data.container_count || data.containerCount || data.initial_containers || data.quantity || 1);
          const containerCapacity = Number(data.container_capacity_liters || data.containerCapacityLiters || conversionFactor || 20);
          const costPerL = addedQtyInSelling > 0 ? Number((batchTotalCost / addedQtyInSelling).toFixed(4)) : effectiveBuyPrice;
          const batchNumber = data.batch_reference || data.batchReference || `DUF-${Date.now().toString().slice(-4)}`;

          const batchRecord: ProductBatch = {
            id: generateId(),
            product_variant_id: vId,
            batch_number: batchNumber,
            container_count: containers,
            liters_per_container: containerCapacity,
            total_liters: addedQtyInSelling,
            remaining_quantity: addedQtyInSelling,
            total_purchase_cost: batchTotalCost,
            cost_per_liter: costPerL,
            cost_currency: '$',
            supplier_id: data.supplierId || currentVar.supplier_id || null,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          try {
            await supabase.from('product_batches').insert([batchRecord]);
          } catch (bErr) {
            console.warn('Fallback saving batch to settings:', bErr);
          }
          await this.saveProductBatchToSettings(batchRecord);
          createdBatchId = batchRecord.id;
        }

        await supabase.from('stock_movements').insert([{
          id: generateId(),
          product_variant_id: vId,
          type: 'purchase',
          quantity: addedQtyInSelling,
          previous_quantity: prevStock,
          new_quantity: newStock,
          unit: sellingUnit,
          reference_type: mMode === 'amount_based' ? 'product_batch' : 'manual_stock_in',
          reference_id: createdBatchId || null,
          notes: reason || (mMode === 'amount_based' 
            ? `Soo galis dufcad saliid: +${addedQtyInSelling}L ($${batchTotalCost})` 
            : (mMode === 'pack_based' ? `Soo galis baakado: +${addedQtyInSelling} ${sellingUnit}` : `Soo galis toos ah: +${data.quantity} ${purchaseUnit}`)),
          created_at: new Date().toISOString(),
        }]);

        await this.recordAuditLog('INCOMING_STOCK', 'product_variant', vId, currentVar, { stock_quantity: newStock }, reason);
        return { success: true, variant_id: vId, batch_id: createdBatchId };
      }
    }

    // Create new product & variant if not found
    const created = await this.createProduct(
      { name: data.productName, category_id: data.categoryId },
      {
        variant_name: data.variantName,
        buy_price: data.buyPrice,
        purchase_unit: purchaseUnit,
        sell_price: data.sellPrice,
        selling_unit: sellingUnit,
        conversion_factor: conversionFactor,
        unit_division: division,
        min_sellable_qty: minSellable,
        pricing_mode: pMode,
        sos_price: sPrice,
        stock_quantity: addedQtyInSelling,
        minimum_stock: data.minimumStock || 10,
        supplier_id: data.supplierId,
        management_mode: mMode,
        source_quantity: data.source_quantity || data.sourceQuantity,
        source_unit: data.source_unit || data.sourceUnit,
        pack_count: data.pack_count || data.packCount,
        selling_pack_unit: data.selling_pack_unit || data.sellingPackUnit,
        container_unit: data.container_unit || data.containerUnit,
        container_capacity_liters: data.container_capacity_liters || data.containerCapacityLiters,
        selling_options: data.selling_options || data.sellingOptions,
        initial_containers: data.container_count || data.containerCount || data.initial_containers || data.quantity,
        batch_cost: batchTotalCost,
        batch_reference: data.batch_reference || data.batchReference,
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
      pricingMode?: 'fixed' | 'denomination';
      sosPrice?: number;
      quantityToAdd?: number;
      minimumStock?: number;
      categoryId?: string;
      supplierId?: string;
      management_mode?: ManagementMode;
      managementMode?: ManagementMode;
      source_quantity?: number;
      sourceQuantity?: number;
      source_unit?: string;
      sourceUnit?: string;
      pack_count?: number;
      packCount?: number;
      selling_pack_unit?: string;
      sellingPackUnit?: string;
      container_unit?: string;
      containerUnit?: string;
      container_capacity_liters?: number;
      containerCapacityLiters?: number;
      selling_options?: AmountSellingOption[];
      sellingOptions?: AmountSellingOption[];
      batch_cost?: number;
      batchCost?: number;
      batch_reference?: string;
      batchReference?: string;
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

    const mMode: ManagementMode = data.managementMode || variant.management_mode || 'standard';

    let division = Math.max(1, Number(data.unitDivision) || Number(variant.unit_division) || 1);
    let minSellable = data.minSellableQty !== undefined && Number(data.minSellableQty) > 0
      ? Number(data.minSellableQty)
      : calculateMinSellableQty(division);

    let purchaseUnit = data.purchaseUnit || variant.purchase_unit || 'jawan';
    let sellingUnit = data.sellingUnit || variant.selling_unit || 'kg';
    let conversionFactor = Number(data.conversionFactor) || Number(variant.conversion_factor) || 1;
    let addedQty = Number(((Number(data.quantityToAdd || 0)) * conversionFactor).toFixed(4));

    if (mMode === 'pack_based') {
      division = 1;
      minSellable = 1;
      sellingUnit = data.sellingPackUnit || variant.selling_pack_unit || sellingUnit || 'bac';
      purchaseUnit = data.sourceUnit || variant.source_unit || purchaseUnit || 'g';
      addedQty = Number(data.packCount || data.quantityToAdd || 0);
    } else if (mMode === 'amount_based') {
      sellingUnit = 'liter';
      purchaseUnit = data.containerUnit || variant.container_unit || purchaseUnit || 'caag';
      conversionFactor = Number(data.containerCapacityLiters || variant.container_capacity_liters || conversionFactor || 20);
      addedQty = Number(((Number(data.quantityToAdd || 0)) * conversionFactor).toFixed(4));
      minSellable = minSellable > 0 ? minSellable : 0.25;
    }

    const prevStock = Number(variant.stock_quantity || 0);
    const newStock = Number((prevStock + addedQty).toFixed(4));
    const cleanSuppId = data.supplierId && typeof data.supplierId === 'string' && data.supplierId.trim().length > 0 ? data.supplierId.trim() : null;

    const pMode: 'fixed' | 'denomination' = (data.pricingMode || (data as any).pricing_mode) === 'denomination' ? 'denomination' : 'fixed';
    const sPrice = Number(data.sosPrice || (data as any).sos_price) > 0 ? Number(data.sosPrice || (data as any).sos_price) : null;

    const finalizePayload: any = {
      variant_name: data.variantName.trim(),
      sku: data.sku?.trim() || null,
      barcode: data.barcode?.trim() || null,
      buy_price: Number(data.buyPrice),
      purchase_unit: purchaseUnit,
      sell_price: Number(data.sellPrice),
      selling_unit: sellingUnit,
      conversion_factor: conversionFactor,
      unit_division: division,
      min_sellable_qty: minSellable,
      pricing_mode: pMode,
      sos_price: sPrice,
      stock_quantity: newStock,
      minimum_stock: Number(data.minimumStock || 10),
      supplier_id: cleanSuppId,
      management_mode: mMode,
      source_quantity: data.sourceQuantity || variant.source_quantity || null,
      source_unit: data.sourceUnit || variant.source_unit || null,
      pack_count: data.packCount || variant.pack_count || null,
      selling_pack_unit: data.sellingPackUnit || variant.selling_pack_unit || null,
      container_unit: data.containerUnit || variant.container_unit || null,
      container_capacity_liters: data.containerCapacityLiters || variant.container_capacity_liters || null,
      selling_options: data.sellingOptions || variant.selling_options || null,
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

    if (error) {
      const { 
        unit_division, min_sellable_qty, pricing_mode, sos_price,
        management_mode, source_quantity, source_unit, pack_count, selling_pack_unit,
        container_unit, container_capacity_liters, selling_options,
        ...fallbackFinalize 
      } = finalizePayload;
      const retryRes = await supabase
        .from('product_variants')
        .update(fallbackFinalize)
        .eq('id', variantId)
        .select('*, product:products(*)')
        .single();
      if (!retryRes.error && retryRes.data) {
        updated = { 
          ...retryRes.data, 
          unit_division, 
          min_sellable_qty, 
          pricing_mode: pMode, 
          sos_price: sPrice || undefined,
          management_mode: mMode,
          source_quantity: finalizePayload.source_quantity,
          source_unit: finalizePayload.source_unit,
          pack_count: finalizePayload.pack_count,
          selling_pack_unit: finalizePayload.selling_pack_unit,
          container_unit: finalizePayload.container_unit,
          container_capacity_liters: finalizePayload.container_capacity_liters,
          selling_options: finalizePayload.selling_options,
        };
        error = null;
      } else if (retryRes.error) {
        error = retryRes.error;
      }
    }

    if (error) {
      throw new Error(`Khalad xaqiijinta alaabta: ${error.message}`);
    }

    // Persist fractional division & pricing mode & model data directly to Supabase settings store
    await this.saveVariantFraction(variantId, division, minSellable);
    if (data.pricingMode || (data as any).pricing_mode || data.sosPrice || (data as any).sos_price) {
      await this.saveVariantPricing(variantId, pMode, sPrice || undefined);
    }
    await this.saveVariantModel(variantId, {
      management_mode: mMode,
      source_quantity: finalizePayload.source_quantity,
      source_unit: finalizePayload.source_unit,
      pack_count: finalizePayload.pack_count,
      selling_pack_unit: finalizePayload.selling_pack_unit,
      container_unit: finalizePayload.container_unit,
      container_capacity_liters: finalizePayload.container_capacity_liters,
      selling_options: finalizePayload.selling_options,
    });

    const { fractionsMap, pricingMap, modelsMap } = await this.getVariantMaps();
    updated = this.formatVariantWithFractions(updated, fractionsMap, pricingMap, modelsMap);

    // If amount_based oil and stock added, create batch
    if (mMode === 'amount_based' && addedQty > 0) {
      const containerCount = Number(data.quantityToAdd || (addedQty / conversionFactor).toFixed(2));
      const totalBatchCost = data.batchCost !== undefined && Number(data.batchCost) > 0
        ? Number(data.batchCost)
        : Number((data.buyPrice * containerCount).toFixed(2));
      const costPerLiter = addedQty > 0 ? Number((totalBatchCost / addedQty).toFixed(4)) : data.buyPrice;

      const batchPayload: ProductBatch = {
        id: generateId(),
        product_variant_id: variantId,
        batch_number: data.batchReference?.trim() || `DUF-${Date.now().toString().slice(-4)}`,
        container_count: containerCount,
        liters_per_container: conversionFactor,
        total_liters: addedQty,
        remaining_quantity: addedQty,
        total_purchase_cost: totalBatchCost,
        cost_per_liter: costPerLiter,
        cost_currency: '$',
        supplier_id: cleanSuppId,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await supabase.from('product_batches').insert([batchPayload]);
      } catch (bErr) {
        console.warn('Fallback saving batch to settings:', bErr);
      }
      await this.saveProductBatchToSettings(batchPayload);
    }

    if (addedQty > 0) {
      await supabase.from('stock_movements').insert([{
        id: generateId(),
        product_variant_id: variantId,
        type: 'purchase',
        quantity: addedQty,
        previous_quantity: prevStock,
        new_quantity: newStock,
        unit: sellingUnit,
        reference_type: 'variant_finalize',
        notes: reason || 'Xaqiijinta alaab cusub',
        created_at: new Date().toISOString(),
      }]);
    }

    await this.recordAuditLog(
      'FINALIZE_PENDING_VARIANT',
      'product_variant',
      variantId,
      variant,
      updated,
      reason || 'Xaqiijinta alaab cusub'
    );

    return updated as ProductVariant;
  }

  // ==========================================
  // PRODUCT BATCHES & OIL MANAGEMENT
  // ==========================================
  private async saveProductBatchToSettings(batch: ProductBatch): Promise<void> {
    try {
      const { data: shop } = await supabase.from('shops').select('id, settings').limit(1).maybeSingle();
      if (shop) {
        const currentSettings = typeof shop.settings === 'object' && shop.settings !== null ? shop.settings : {};
        const existingBatches: ProductBatch[] = Array.isArray(currentSettings.product_batches) ? currentSettings.product_batches : [];
        const filtered = existingBatches.filter(b => b.id !== batch.id);
        filtered.push(batch);
        await supabase.from('shops').update({
          settings: {
            ...currentSettings,
            product_batches: filtered
          }
        }).eq('id', shop.id);
      }
    } catch (err) {
      console.warn('Error saving batch to shop settings:', err);
    }
  }

  public async createProductBatch(data: {
    variantId: string;
    batchNumber?: string;
    containerCount: number;
    litersPerContainer: number;
    totalPurchaseCost: number;
    costCurrency?: string;
    supplierId?: string;
    notes?: string;
  }, reason?: string): Promise<ProductBatch> {
    const user = await this.checkAdminAuth('Abuuris Dufcad Cusub oo Saliid ah');

    const totalLiters = Number((data.containerCount * data.litersPerContainer).toFixed(4));
    const costPerLiter = totalLiters > 0 ? Number((data.totalPurchaseCost / totalLiters).toFixed(4)) : 0;
    const batchId = generateId();
    const batchNumber = data.batchNumber?.trim() || `DUF-${Date.now().toString().slice(-4)}`;

    const newBatch: ProductBatch = {
      id: batchId,
      product_variant_id: data.variantId,
      batch_number: batchNumber,
      container_count: data.containerCount,
      liters_per_container: data.litersPerContainer,
      total_liters: totalLiters,
      remaining_quantity: totalLiters,
      total_purchase_cost: data.totalPurchaseCost,
      cost_per_liter: costPerLiter,
      cost_currency: data.costCurrency || '$',
      supplier_id: data.supplierId || null,
      status: 'active',
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { error: insertErr } = await supabase.from('product_batches').insert([newBatch]);
    if (insertErr) {
      console.warn('[Supabase Schema] product_batches table insert fallback:', insertErr.message);
    }
    await this.saveProductBatchToSettings(newBatch);

    // Update variant stock quantity and buy_price
    const { data: curVar } = await supabase.from('product_variants').select('stock_quantity, buy_price').eq('id', data.variantId).single();
    const prevStock = Number(curVar?.stock_quantity || 0);
    const newStock = Number((prevStock + totalLiters).toFixed(4));

    await supabase.from('product_variants').update({
      stock_quantity: newStock,
      buy_price: costPerLiter,
      updated_at: new Date().toISOString(),
    }).eq('id', data.variantId);

    await supabase.from('stock_movements').insert([{
      id: generateId(),
      product_variant_id: data.variantId,
      type: 'purchase',
      quantity: totalLiters,
      previous_quantity: prevStock,
      new_quantity: newStock,
      unit: 'liter',
      reference_type: 'product_batch',
      reference_id: batchId,
      notes: `Soo galis dufcad saliid: ${data.containerCount} Caag x ${data.litersPerContainer}L = ${totalLiters}L ($${data.totalPurchaseCost})`,
      created_at: new Date().toISOString(),
    }]);

    await this.recordAuditLog(
      'CREATE_BATCH',
      'product_batch',
      batchId,
      undefined,
      newBatch,
      reason || `Abuuris Dufcad Saliid: #${batchNumber} (${totalLiters}L - $${data.totalPurchaseCost})`
    );

    return newBatch;
  }

  public async getProductBatches(
    variantId?: string,
    status?: 'all' | 'active' | 'finished' | 'reconciled'
  ): Promise<ProductBatch[]> {
    let dbBatches: ProductBatch[] = [];
    try {
      let query = supabase
        .from('product_batches')
        .select('*, product_variant:product_variants(*, product:products(*)), supplier:suppliers(*)')
        .order('created_at', { ascending: false });

      if (variantId) {
        query = query.eq('product_variant_id', variantId);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (!error && data) {
        dbBatches = data as ProductBatch[];
      }
    } catch (e) {
      console.warn('Error querying product_batches table:', e);
    }

    // Also check shops.settings.product_batches for resilience
    let settingsBatches: ProductBatch[] = [];
    try {
      const { data: shop } = await supabase.from('shops').select('settings').limit(1).maybeSingle();
      if (shop?.settings?.product_batches && Array.isArray(shop.settings.product_batches)) {
        settingsBatches = shop.settings.product_batches;
      }
    } catch (e) {
      console.warn('Error reading batches from settings:', e);
    }

    // Deduplicate
    const map = new Map<string, ProductBatch>();
    for (const b of settingsBatches) {
      map.set(b.id, b);
    }
    for (const b of dbBatches) {
      map.set(b.id, b);
    }

    let allBatches = Array.from(map.values());
    if (variantId) {
      allBatches = allBatches.filter(b => b.product_variant_id === variantId);
    }
    if (status && status !== 'all') {
      allBatches = allBatches.filter(b => b.status === status);
    }

    return allBatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getActiveBatch(variantId: string): Promise<ProductBatch | null> {
    const batches = await this.getProductBatches(variantId, 'active');
    const available = batches.filter(b => Number(b.remaining_quantity || 0) > 0.0001);
    if (available.length === 0) return null;
    // Earliest created active batch (FIFO)
    return available.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0] || null;
  }

  public async updateBatchRemaining(batchId: string, newRemaining: number): Promise<void> {
    const isFinished = newRemaining <= 0.001;
    const updates = {
      remaining_quantity: Math.max(0, Number(newRemaining.toFixed(4))),
      status: isFinished ? ('finished' as const) : ('active' as const),
      updated_at: new Date().toISOString(),
    };

    try {
      await supabase.from('product_batches').update(updates).eq('id', batchId);
    } catch (e) {
      console.warn('Error updating product_batches remaining in db:', e);
    }

    // Update settings fallback
    try {
      const { data: shop } = await supabase.from('shops').select('id, settings').limit(1).maybeSingle();
      if (shop?.settings?.product_batches && Array.isArray(shop.settings.product_batches)) {
        const updated = shop.settings.product_batches.map((b: ProductBatch) => 
          b.id === batchId ? { ...b, ...updates } : b
        );
        await supabase.from('shops').update({ settings: { ...shop.settings, product_batches: updated } }).eq('id', shop.id);
      }
    } catch (e) {
      console.warn('Error updating batch in settings:', e);
    }
  }

  public async reconcileProductBatch(payload: BatchReconciliationPayload, reason?: string): Promise<ProductBatch> {
    const user = await this.checkAdminAuth('Dib-u-heshiisiinta Dufcad Saliid (Batch Reconciliation)');

    const batches = await this.getProductBatches();
    const batch = batches.find(b => b.id === payload.batch_id);
    if (!batch) {
      throw new Error('Dufcadda lama helin');
    }

    const expectedRemaining = Number(batch.remaining_quantity || 0);
    const physicalRemaining = Number(payload.actual_remaining_liters ?? payload.physicalRemaining ?? 0);
    const varianceRes = calculateBatchVariance(expectedRemaining, physicalRemaining);
    const variance = varianceRes.variance;
    const newStatus = payload.status || 'reconciled';

    const updates: Partial<ProductBatch> = {
      actual_remaining_liters: physicalRemaining,
      variance_liters: variance,
      status: newStatus,
      reconciled_at: new Date().toISOString(),
      reconciled_by: user.name,
      notes: payload.notes || batch.notes,
      updated_at: new Date().toISOString(),
    };

    try {
      await supabase.from('product_batches').update(updates).eq('id', batch.id);
    } catch (e) {
      console.warn('Error updating reconciled batch in DB:', e);
    }

    const reconciledBatch: ProductBatch = {
      ...batch,
      ...updates,
    };
    await this.saveProductBatchToSettings(reconciledBatch);

    // If there is variance, adjust variant stock quantity and log stock movement
    if (Math.abs(variance) > 0.0001) {
      const { data: curVar } = await supabase.from('product_variants').select('stock_quantity').eq('id', batch.product_variant_id).single();
      const prevStock = Number(curVar?.stock_quantity || 0);
      const newStock = Math.max(0, Number((prevStock + variance).toFixed(4)));

      await supabase.from('product_variants').update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      }).eq('id', batch.product_variant_id);

      await supabase.from('stock_movements').insert([{
        id: generateId(),
        product_variant_id: batch.product_variant_id,
        type: 'adjustment',
        quantity: variance,
        previous_quantity: prevStock,
        new_quantity: newStock,
        unit: 'liter',
        reference_type: 'batch_reconciliation',
        reference_id: batch.id,
        notes: `Dib-u-heshiisiin Dufcad: #${batch.batch_number} (Variance: ${variance > 0 ? '+' : ''}${variance}L)`,
        created_at: new Date().toISOString(),
      }]);
    }

    await this.recordAuditLog(
      'RECONCILE_BATCH',
      'product_batch',
      batch.id,
      batch,
      reconciledBatch,
      reason || `Dib-u-heshiisiin Dufcad: #${batch.batch_number} (Variance: ${variance}L)`
    );

    return reconciledBatch;
  }

  public async getBatchTransactions(batchId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*, sale:sales(*, customer:customers(*)), product_variant:product_variants(*, product:products(*))')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Error querying batch sale items:', e);
    }
    return [];
  }

  public async getOilBatchReports(variantId?: string): Promise<OilBatchReportRow[]> {
    const user = await this.getCurrentUser();
    if (user?.role === 'seller') {
      throw new Error('Seller / Iibiye ma laha ogolaansho uu ku eego warbixinnada dufcadaha.');
    }

    const batches = await this.getProductBatches(variantId);
    const rows: OilBatchReportRow[] = [];

    for (const batch of batches) {
      // Get linked transactions
      const txs = await this.getBatchTransactions(batch.id);
      let recordedUsage = 0;
      let totalRevenue = 0;

      const totalLiters = Number(batch.total_liters ?? 0);
      const costPerL = Number(batch.cost_per_liter ?? 0);
      const totalCost = Number(batch.total_purchase_cost ?? 0);
      const remainingLiters = Number(batch.remaining_quantity ?? 0);

      if (txs.length > 0) {
        for (const tx of txs) {
          const qty = Number(tx.actual_quantity_used || tx.quantity || 0);
          recordedUsage += qty;
          totalRevenue += Number(tx.total_price || 0);
        }
      } else {
        recordedUsage = Math.max(0, Number((totalLiters - remainingLiters).toFixed(4)));
        totalRevenue = Number((recordedUsage * (costPerL * 1.3)).toFixed(2));
      }

      recordedUsage = Number(recordedUsage.toFixed(4));
      totalRevenue = Number(totalRevenue.toFixed(2));

      const pl = calculateBatchProfitLoss({
        total_initial_quantity: totalLiters,
        total_purchase_cost: totalCost,
        cost_per_unit: costPerL,
        quantity_sold: recordedUsage,
        total_revenue: totalRevenue,
        physical_remaining_quantity: batch.actual_remaining_liters,
      });

      const variant = batch.product_variant as any;
      const product = variant?.product;

      rows.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        date: batch.created_at ? batch.created_at.split('T')[0] : '',
        productId: product?.id || '',
        productName: product?.name || 'Saliid (Cooking Oil)',
        variantId: batch.product_variant_id,
        variantName: variant?.variant_name || 'Default',
        supplierName: batch.supplier?.name || 'Qeybiye',
        containersReceived: batch.container_count,
        litersPerContainer: batch.liters_per_container,
        totalLitersReceived: totalLiters,
        totalPurchaseCost: totalCost,
        costPerLiter: costPerL,
        litersSold: recordedUsage,
        totalSalesRevenue: totalRevenue,
        costOfOilSold: pl.costOfSoldOil,
        grossProfitLoss: pl.grossProfit,
        expectedRemainingLiters: pl.expectedRemainingLiters,
        actualRemainingLiters: batch.actual_remaining_liters,
        varianceLiters: pl.varianceLiters,
        varianceLossCost: pl.shrinkageCost,
        status: batch.status,
      });
    }

    return rows;
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

    // Check if any cart item has special management mode, denomination pricing mode, or actual quantity override
    const hasSpecialItems = rawItems.some(i => 
      i.variant?.management_mode === 'amount_based' ||
      i.variant?.management_mode === 'pack_based' ||
      i.actual_quantity_used !== undefined ||
      i.pricing_mode === 'denomination' || 
      i.variant?.pricing_mode === 'denomination' ||
      (i.sosPrice && i.sosPrice > 0) ||
      (i.variant?.sos_price && i.variant.sos_price > 0)
    );

    // 1. Try PostgreSQL RPC `execute_sale` ONLY if no special/denomination items are present
    if (!hasSpecialItems) {
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
    }

    // 2. Direct transactional sequence with batch & stock deduction
    // Pre-validate stock availability for all items to guarantee atomic transaction
    for (const item of rawItems) {
      const isAmountBased = item.variant?.management_mode === 'amount_based' || item.actual_quantity_used !== undefined;
      const qtyToDeduct = isAmountBased && item.actual_quantity_used !== undefined 
        ? Number(item.actual_quantity_used) 
        : Number(item.quantity);

      const { data: curVar } = await supabase.from('product_variants').select('stock_quantity, selling_unit, variant_name, product:products(name)').eq('id', item.variant.id).single();
      const currentStock = Number(curVar?.stock_quantity ?? item.variant.stock_quantity ?? 0);
      const unitLabel = curVar?.selling_unit || item.variant.selling_unit || 'xabo';
      const itemName = (curVar?.product as any)?.name || item.product?.name || item.variant?.variant_name || 'Alaabta';

      if (currentStock < qtyToDeduct) {
        throw new Error(`Stock-ga kuma filna: ${itemName}. Waxaa haray kaliya ${currentStock} ${unitLabel}, laakiin waxaad isku dayday inaad iibiso ${qtyToDeduct} ${unitLabel}.`);
      }
    }

    const saleCalc = calculateSaleTotal(rawItems, Number(params.overallDiscount || 0));
    const subtotal = saleCalc.subtotal;
    const costAmount = saleCalc.costAmount;
    const discount = saleCalc.totalDiscount;
    const totalAmount = saleCalc.totalAmount;
    const amountPaid = params.paymentMethod === 'cash' ? totalAmount : Math.min(totalAmount, Math.max(0, Number(params.amountPaid || 0)));
    const debtAmount = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);
    const grossProfit = saleCalc.grossProfit;

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
      const mode = item.pricing_mode || item.variant?.pricing_mode || 'fixed';
      const itemSos = item.sosPrice ?? item.variant?.sos_price ?? 0;
      const isAmountBased = item.variant?.management_mode === 'amount_based' || item.actual_quantity_used !== undefined;
      const actualLitersUsed = isAmountBased && item.actual_quantity_used !== undefined ? Number(item.actual_quantity_used) : Number(item.quantity);

      let itemLineTotal = Math.round((item.quantity * item.unitPrice - (item.discount || 0)) * 100) / 100;

      if (mode === 'denomination' && itemSos > 0) {
        const denomRes = calculateSosDenomination(Math.round(itemSos * item.quantity));
        itemLineTotal = denomRes.denominationUsd;
      }

      // If oil product, resolve active batch for FIFO deduction and batch cost
      let activeBatch: ProductBatch | null = null;
      let effectiveUnitCost = item.unitCost;

      if (isAmountBased) {
        activeBatch = await this.getActiveBatch(item.variant.id);
        if (activeBatch) {
          effectiveUnitCost = activeBatch.cost_per_liter || item.unitCost;
          const remainingQty = Number(activeBatch.remaining_quantity || 0);
          const newBatchRemaining = Math.max(0, Number((remainingQty - actualLitersUsed).toFixed(4)));
          await this.updateBatchRemaining(activeBatch.id, newBatchRemaining);
        }
      }

      const itemCostTotal = isAmountBased ? Number((actualLitersUsed * effectiveUnitCost).toFixed(4)) : Number((item.quantity * effectiveUnitCost).toFixed(4));
      const itemProfit = Math.round((itemLineTotal - itemCostTotal) * 100) / 100;

      const saleItemPayload: any = {
        id: generateId(),
        sale_id: saleId,
        product_variant_id: item.variant.id,
        quantity: item.quantity,
        unit: item.variant.selling_unit,
        unit_price: item.unitPrice,
        unit_cost: effectiveUnitCost,
        discount: item.discount || 0,
        total_price: itemLineTotal,
        gross_profit: itemProfit,
        batch_id: activeBatch?.id || null,
        actual_quantity_used: isAmountBased ? actualLitersUsed : null,
        selling_method: item.selling_method || (isAmountBased ? (item.amount_based_value ? 'money' : 'liter') : 'liter'),
        selling_option_label: item.selling_option_label || null,
        created_at: new Date().toISOString(),
      };

      const { error: saleItemErr } = await supabase.from('sale_items').insert([saleItemPayload]);
      if (saleItemErr) {
        // Fallback for schema cache if batch_id/actual_quantity_used/selling_method not recognized yet
        const { batch_id, actual_quantity_used, selling_option_label, selling_method, ...fallbackSaleItem } = saleItemPayload;
        await supabase.from('sale_items').insert([fallbackSaleItem]);
      }

      const { data: curVar } = await supabase.from('product_variants').select('stock_quantity, selling_unit, minimum_stock, sku, barcode').eq('id', item.variant.id).single();
      const prevStock = Number(curVar?.stock_quantity || 0);
      const qtyDeducted = isAmountBased ? actualLitersUsed : item.quantity;
      const newStock = Math.max(0, Number((prevStock - qtyDeducted).toFixed(4)));
      const minStock = Number(curVar?.minimum_stock || item.variant?.minimum_stock || 10);

      await supabase.from('product_variants').update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      }).eq('id', item.variant.id);

      await supabase.from('stock_movements').insert([{
        id: generateId(),
        product_variant_id: item.variant.id,
        type: 'sale',
        quantity: -qtyDeducted,
        previous_quantity: prevStock,
        new_quantity: newStock,
        unit: curVar?.selling_unit || item.variant.selling_unit,
        reference_id: saleId,
        reference_type: 'sale',
        notes: `POS Sale: #${saleId.slice(0, 8)}${item.selling_option_label ? ' (' + item.selling_option_label + ')' : ''}`,
        created_at: new Date().toISOString(),
      }]);

      // Trigger automatic stock email alert if stock drops to or below minimum stock
      if (newStock <= minStock) {
        this.triggerStockAlert({
          variantId: item.variant.id,
          productName: item.product?.name || 'Alaab',
          variantName: item.variant?.variant_name || 'Default',
          currentStock: newStock,
          minimumStock: minStock,
          unit: curVar?.selling_unit || item.variant?.selling_unit || 'kg',
          sku: curVar?.sku || item.variant?.sku,
          barcode: curVar?.barcode || item.variant?.barcode,
        });
      }
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
  private async syncUsersToShopSettings(shopId: string, users: SystemUser[]): Promise<void> {
    try {
      const { data: shop } = await supabase.from('shops').select('settings').eq('id', shopId).maybeSingle();
      const currentSettings = shop?.settings || {};
      await supabase.from('shops').update({
        settings: {
          ...currentSettings,
          users,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', shopId);
    } catch (e) {
      console.warn('syncUsersToShopSettings notice:', e);
    }
  }

  public async getUsers(): Promise<SystemUser[]> {
    const shopId = await this.getCurrentShopId();

    // 1. Fetch current shop settings which stores the shop's user roster
    let shopSettingsUsers: SystemUser[] = [];
    if (shopId) {
      try {
        const { data: shop } = await supabase
          .from('shops')
          .select('settings')
          .eq('id', shopId)
          .maybeSingle();
        if (shop?.settings?.users && Array.isArray(shop.settings.users)) {
          shopSettingsUsers = shop.settings.users;
        }
      } catch (shopErr) {
        console.warn('Error fetching shop user roster:', shopErr);
      }
    }

    // 2. Fetch profiles for this shop
    let profileUsers: SystemUser[] = [];
    try {
      let query = supabase.from('profiles').select('*');
      if (shopId) {
        query = query.or(`shop_id.eq.${shopId},shop_id.is.null`);
      }
      const { data, error } = await query.order('created_at', { ascending: true });
      if (!error && data) {
        profileUsers = data.map(p => {
          const roleStr = String(p.role || '').toLowerCase();
          const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
          const email = p.phone && p.phone.includes('@') 
            ? p.phone 
            : (p.email || `${(p.full_name || 'user').toLowerCase().replace(/\s+/g, '')}@tukaan.so`);
          return {
            id: p.id,
            name: p.full_name || email.split('@')[0] || 'User',
            email,
            role,
            status: 'active' as UserStatus,
            created_at: p.created_at || new Date().toISOString(),
          };
        });
      }
    } catch (e) {
      console.warn('Profiles query notice in getUsers:', e);
    }

    // 3. Check currently authenticated Supabase Auth user
    let currentUser: SystemUser | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metaRole = String(user.user_metadata?.role || '').toLowerCase();
        const authRole: UserRole = metaRole === 'reporter' ? 'reporter' : (metaRole === 'seller' ? 'seller' : 'admin');
        const authEmail = user.email || '';
        currentUser = {
          id: user.id,
          name: user.user_metadata?.full_name || authEmail.split('@')[0] || 'Admin',
          email: authEmail,
          role: authRole,
          status: 'active' as UserStatus,
          created_at: user.created_at || new Date().toISOString(),
        };
      }
    } catch (authErr) {
      console.warn('Current auth user lookup notice:', authErr);
    }

    // 4. Combine and deduplicate users (indexed by ID or lowercase email)
    const usersMap = new Map<string, SystemUser>();

    // Add from shopSettingsUsers first
    for (const u of shopSettingsUsers) {
      const key = u.id || u.email.toLowerCase();
      usersMap.set(key, {
        ...u,
        status: u.status || 'active',
      });
    }

    // Merge profileUsers
    for (const p of profileUsers) {
      const key = p.id || p.email.toLowerCase();
      const existing = usersMap.get(key) || usersMap.get(p.email.toLowerCase());
      if (existing) {
        usersMap.set(key, {
          ...existing,
          ...p,
          role: existing.role || p.role,
          status: existing.status || p.status || 'active',
        });
      } else {
        usersMap.set(key, p);
      }
    }

    // Ensure currently authenticated user is in the list
    if (currentUser) {
      const key = currentUser.id;
      const existing = usersMap.get(key) || usersMap.get(currentUser.email.toLowerCase());
      if (existing) {
        usersMap.set(key, {
          ...existing,
          id: currentUser.id,
          email: currentUser.email || existing.email,
        });
      } else {
        usersMap.set(key, currentUser);
        // Automatically sync into profiles in background if shopId exists
        if (shopId) {
          try {
            await supabase.from('profiles').upsert([{
              id: currentUser.id,
              full_name: currentUser.name,
              phone: currentUser.email,
              role: currentUser.role,
              shop_id: shopId,
              created_at: currentUser.created_at,
              updated_at: new Date().toISOString(),
            }]);
          } catch (upsertErr) {
            console.warn('Auto-sync profile notice:', upsertErr);
          }
        }
      }
    }

    const mergedUsers = Array.from(usersMap.values());

    // If shopSettings did not have these users saved yet, sync them to shop.settings.users
    if (shopId && mergedUsers.length > 0) {
      this.syncUsersToShopSettings(shopId, mergedUsers).catch(() => {});
    }

    return mergedUsers;
  }

  public async getUserById(id: string): Promise<SystemUser | null> {
    const users = await this.getUsers();
    return users.find(u => u.id === id) || null;
  }

  public async getUserByEmail(email: string): Promise<SystemUser | null> {
    const cleanEmail = email.trim().toLowerCase();
    const users = await this.getUsers();
    return users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }

  public async createUser(data: { name: string; email: string; role: UserRole; password?: string }, reason?: string): Promise<SystemUser> {
    await this.checkAdminAuth('Abuuris Isticmaale Cusub');

    const shopId = await this.getCurrentShopId();
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
      phone: data.email.trim(),
      role: data.role,
      shop_id: shopId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert into profiles table
    try {
      await supabase
        .from('profiles')
        .upsert([newProfile]);
    } catch (pErr: any) {
      console.warn('Profile upsert notice in createUser:', pErr.message);
    }

    const newUserObj: SystemUser = {
      id: authUserId,
      name: data.name.trim(),
      email: data.email.trim(),
      role: data.role,
      status: 'active',
      created_at: newProfile.created_at,
    };

    // Save to shop settings roster for full persistence
    if (shopId) {
      const currentUsers = await this.getUsers();
      const updatedRoster = [
        ...currentUsers.filter(u => u.id !== authUserId && u.email.toLowerCase() !== data.email.trim().toLowerCase()),
        newUserObj,
      ];
      await this.syncUsersToShopSettings(shopId, updatedRoster);
    }

    await this.recordAuditLog(
      'CREATE_USER',
      'profile',
      authUserId,
      undefined,
      newUserObj,
      reason || `Abuuris User: ${newUserObj.name} (${newUserObj.role})`
    );

    return newUserObj;
  }

  public async updateUser(id: string, updates: Partial<SystemUser>, reason?: string): Promise<SystemUser> {
    await this.checkAdminAuth('Wax ka beddel Isticmaale');

    const shopId = await this.getCurrentShopId();
    const currentUsers = await this.getUsers();
    const prevUser = currentUsers.find(u => u.id === id);

    if (!prevUser) {
      throw new Error('Isticmaalaha lama helin (User not found)');
    }

    const updatedUser: SystemUser = {
      ...prevUser,
      name: updates.name?.trim() || prevUser.name,
      email: updates.email?.trim() || prevUser.email,
      role: updates.role || prevUser.role,
      status: updates.status || prevUser.status || 'active',
    };

    // 1. Update profiles table if matching
    try {
      await supabase
        .from('profiles')
        .update({
          full_name: updatedUser.name,
          phone: updatedUser.email,
          role: updatedUser.role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (pErr: any) {
      console.warn('Profile update notice:', pErr.message);
    }

    // 2. Update shop settings roster
    if (shopId) {
      const updatedRoster = currentUsers.map(u => u.id === id ? updatedUser : u);
      await this.syncUsersToShopSettings(shopId, updatedRoster);
    }

    await this.recordAuditLog(
      'EDIT_USER',
      'profile',
      id,
      prevUser,
      updatedUser,
      reason || `Wax ka beddel User: ${updatedUser.name} (${updatedUser.role}, ${updatedUser.status})`
    );

    return updatedUser;
  }

  public async toggleUserStatus(id: string): Promise<SystemUser> {
    await this.checkAdminAuth('Beddelka Xaaladda Isticmaale (Toggle Status)');
    const currentUsers = await this.getUsers();
    const user = currentUsers.find(u => u.id === id);
    if (!user) throw new Error('Isticmaalaha lama helin (User not found)');

    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    return await this.updateUser(id, { status: newStatus }, `Beddelay xaaladda user: ${user.name} -> ${newStatus}`);
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
    const shopId = await this.getCurrentShopId();
    const currentUsers = await this.getUsers();
    const prev = currentUsers.find(u => u.id === id);

    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch (pErr) {
      console.warn('Profile delete notice:', pErr);
    }

    if (shopId) {
      const updatedRoster = currentUsers.filter(u => u.id !== id);
      await this.syncUsersToShopSettings(shopId, updatedRoster);
    }

    await this.recordAuditLog(
      'DELETE_USER',
      'profile',
      id,
      prev,
      undefined,
      `Tirtirid User: ${prev?.name || id}`
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
      .select('id, sale_id, quantity, unit, unit_price, total_price, gross_profit, selling_method, selling_option_label, actual_quantity_used, created_at, sale:sales(id, created_at, payment_method, total_amount, amount_paid, debt_amount, customer:customers(name))', { count: 'exact' })
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
        selling_method: item.selling_method,
        selling_option_label: item.selling_option_label,
        actual_quantity_used: item.actual_quantity_used,
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
