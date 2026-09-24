import { supabase } from '../lib/supabase';
import {
  Product,
  ProductVariant,
  Category,
  Sale,
  Debt,
  Customer,
  Supplier,
  Expense,
  UserRole,
  CartItem,
  PaymentMethod,
  ProductBatch,
  SystemUser,
} from '../types';
import { calculateSaleTotal, cleanPrecision, roundToCents } from '../lib/calculations/financials';
import { calculateSosDenomination } from '../lib/calculations/denominations';
import { calculateCostPerBaseUnit } from '../lib/calculations/stock';

export interface DashboardData {
  todaySalesCount: number;
  todayRevenue: number;
  openDebtsCount: number;
  openDebtsTotal: number;
  lowStockCount: number;
  outOfStockCount: number;
  activeProductsCount: number;
  recentSales: Array<{
    id: string;
    total_amount: number;
    payment_method: string;
    created_at: string;
    customer_name?: string;
    items_count?: number;
  }>;
}

export interface ProductsQueryParams {
  search?: string;
  categoryId?: string;
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  page?: number;
  pageSize?: number;
}

export interface PaginatedProducts {
  variants: ProductVariant[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

class MobileApiService {
  /**
   * Fetches real-time dashboard data from Supabase.
   * Returns exact 0 metrics if database is empty.
   */
  async getDashboardData(): Promise<DashboardData> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Today's sales
    const { data: salesToday } = await supabase
      .from('sales')
      .select('id, total_amount, payment_method, created_at, customer:customers(name), items:sale_items(id)')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    const todayCount = salesToday?.length || 0;
    const todayRevenue = (salesToday || []).reduce(
      (sum, s) => sum + Number(s.total_amount || 0),
      0
    );

    // 2. Recent sales (up to 5 most recent transactions)
    const recentSales = (salesToday || []).slice(0, 5).map((s: any) => ({
      id: s.id,
      total_amount: Number(s.total_amount || 0),
      payment_method: s.payment_method || 'cash',
      created_at: s.created_at,
      customer_name: s.customer?.name || 'Macaamiil Guud (Cash)',
      items_count: s.items?.length || 0,
    }));

    // If today has less than 5 sales, fetch recent from all sales
    if (recentSales.length < 5) {
      const { data: pastSales } = await supabase
        .from('sales')
        .select('id, total_amount, payment_method, created_at, customer:customers(name), items:sale_items(id)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (pastSales && pastSales.length > 0) {
        recentSales.splice(0, recentSales.length, ...pastSales.map((s: any) => ({
          id: s.id,
          total_amount: Number(s.total_amount || 0),
          payment_method: s.payment_method || 'cash',
          created_at: s.created_at,
          customer_name: s.customer?.name || 'Macaamiil Guud (Cash)',
          items_count: s.items?.length || 0,
        })));
      }
    }

    // 3. Open debts
    const { data: openDebts } = await supabase
      .from('debts')
      .select('remaining_balance')
      .in('status', ['unpaid', 'partial']);

    const openDebtsCount = openDebts?.length || 0;
    const openDebtsTotal = (openDebts || []).reduce(
      (sum, d) => sum + Number(d.remaining_balance || 0),
      0
    );

    // 4. Stock counts across active variants
    const { data: variants } = await supabase
      .from('product_variants')
      .select('stock_quantity, minimum_stock')
      .eq('is_active', true);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    const activeProductsCount = variants?.length || 0;

    for (const v of variants || []) {
      const stock = Number(v.stock_quantity || 0);
      const minStock = Number(v.minimum_stock || 10);
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    }

    return {
      todaySalesCount: todayCount,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      openDebtsCount,
      openDebtsTotal: Math.round(openDebtsTotal * 100) / 100,
      lowStockCount,
      outOfStockCount,
      activeProductsCount,
      recentSales,
    };
  }

  /**
   * Fetches categories for filter tabs and assignment
   */
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Categories query error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Paginated and filtered query for product variants.
   * Optimized for 3,000+ products via server-side limits and offsets.
   */
  async getProductsPaginated(params: ProductsQueryParams): Promise<PaginatedProducts> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(params.pageSize || 20, 50));
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('product_variants')
      .select(`
        *,
        product:products(id, name, category_id, description, image_url, category:categories(id, name))
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Category filter
    if (params.categoryId && params.categoryId !== 'all') {
      query = query.eq('product.category_id', params.categoryId);
    }

    // Search query (matches variant name, sku, or barcode)
    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      query = query.or(`variant_name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`);
    }

    // Stock Status filter
    if (params.stockStatus === 'out_of_stock') {
      query = query.lte('stock_quantity', 0);
    } else if (params.stockStatus === 'low_stock') {
      query = query.gt('stock_quantity', 0).filter('stock_quantity', 'lte', 'minimum_stock');
    } else if (params.stockStatus === 'in_stock') {
      query = query.gt('stock_quantity', 0);
    }

    // Range for pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.warn('Products query notice:', error.message);
      return {
        variants: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      variants: (data as any[]) || [],
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Direct barcode lookup for POS & Products search
   */
  async findVariantByBarcode(barcode: string): Promise<ProductVariant | null> {
    if (!barcode.trim()) return null;
    const cleanBarcode = barcode.trim();

    const { data, error } = await supabase
      .from('product_variants')
      .select(`
        *,
        product:products(id, name, category_id, description, image_url, category:categories(id, name))
      `)
      .or(`barcode.eq.${cleanBarcode},sku.eq.${cleanBarcode}`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as any;
  }

  /**
   * Admin-only: Record stock adjustment
   */
  async adjustStock(
    variantId: string,
    quantityChange: number,
    reason: string,
    userRole: UserRole
  ): Promise<{ success: boolean; error?: string; newStock?: number }> {
    if (userRole !== 'admin') {
      return { success: false, error: 'Kaliya maamulaha (Admin) ayaa awood u leh inuu beddelo stock-ga.' };
    }

    const { data: variant, error: varErr } = await supabase
      .from('product_variants')
      .select('stock_quantity, selling_unit')
      .eq('id', variantId)
      .single();

    if (varErr || !variant) {
      return { success: false, error: 'Alaabta lama helin.' };
    }

    const prevStock = Number(variant.stock_quantity || 0);
    const newStock = Number((prevStock + quantityChange).toFixed(4));

    if (newStock < 0) {
      return { success: false, error: `Stock-gu kama yaraan karo 0. Hadda waxaa yaalla ${prevStock} ${variant.selling_unit}.` };
    }

    const { error: updateErr } = await supabase
      .from('product_variants')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Record stock movement audit log
    await supabase.from('stock_movements').insert([{
      product_variant_id: variantId,
      type: quantityChange > 0 ? 'purchase' : 'adjustment',
      quantity: quantityChange,
      previous_quantity: prevStock,
      new_quantity: newStock,
      unit: variant.selling_unit,
      notes: reason || 'Mobile stock adjustment by Admin',
      created_at: new Date().toISOString(),
    }]);

    return { success: true, newStock };
  }

  /**
   * Admin-only: Create new product and initial variant
   */
  async createProductWithVariant(
    productData: {
      name: string;
      category_id?: string;
      description?: string;
      sku?: string;
      barcode?: string;
      buy_price: number;
      purchase_unit: string;
      sell_price: number;
      selling_unit: string;
      conversion_factor: number;
      initial_stock: number;
      minimum_stock: number;
      unit_division?: number;
      pricing_mode?: 'fixed' | 'denomination';
      sos_price?: number;
      management_mode?: 'standard' | 'pack_based' | 'amount_based';
    },
    userRole: UserRole
  ): Promise<{ success: boolean; error?: string; product?: Product }> {
    if (userRole !== 'admin') {
      return { success: false, error: 'Kaliya maamulaha (Admin) ayaa awood u leh inuu abuuro alaab cusub.' };
    }

    try {
      // 1. Create master product
      const { data: createdProduct, error: prodErr } = await supabase
        .from('products')
        .insert([{
          name: productData.name.trim(),
          category_id: productData.category_id || null,
          description: productData.description?.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (prodErr || !createdProduct) {
        return { success: false, error: prodErr?.message || 'Khalad baa dhacay abuurista alaabta.' };
      }

      // 2. Create primary variant
      const stockQty = Math.max(0, productData.initial_stock || 0);
      const { data: createdVariant, error: varErr } = await supabase
        .from('product_variants')
        .insert([{
          product_id: createdProduct.id,
          variant_name: 'Default',
          sku: productData.sku?.trim() || null,
          barcode: productData.barcode?.trim() || null,
          buy_price: Number(productData.buy_price || 0),
          purchase_unit: productData.purchase_unit || 'jawan',
          sell_price: Number(productData.sell_price || 0),
          selling_unit: productData.selling_unit || 'kg',
          conversion_factor: Number(productData.conversion_factor || 1),
          unit_division: Number(productData.unit_division || 1),
          min_sellable_qty: productData.unit_division ? (1 / productData.unit_division) : 1,
          pricing_mode: productData.pricing_mode || 'fixed',
          sos_price: productData.sos_price ? Number(productData.sos_price) : null,
          management_mode: productData.management_mode || 'standard',
          stock_quantity: stockQty,
          minimum_stock: Number(productData.minimum_stock || 10),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (varErr) {
        return { success: false, error: varErr.message };
      }

      // Log initial stock movement if stock > 0
      if (stockQty > 0 && createdVariant) {
        await supabase.from('stock_movements').insert([{
          product_variant_id: createdVariant.id,
          type: 'purchase',
          quantity: stockQty,
          previous_quantity: 0,
          new_quantity: stockQty,
          unit: productData.selling_unit || 'kg',
          notes: 'Initial stock entry on mobile',
          created_at: new Date().toISOString(),
        }]);
      }

      return { success: true, product: createdProduct };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Khalad lama filaan ah baa dhacay.' };
    }
  }

  /**
   * Admin-only: Update existing variant details
   */
  async updateVariant(
    variantId: string,
    updates: Partial<ProductVariant>,
    userRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    if (userRole !== 'admin') {
      return { success: false, error: 'Kaliya maamulaha (Admin) ayaa awood u leh inuu wax ka beddelo alaabta.' };
    }

    const { error } = await supabase
      .from('product_variants')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  /**
   * Search and list customers
   */
  async getCustomers(search?: string): Promise<Customer[]> {
    let query = supabase.from('customers').select('*').order('name', { ascending: true });
    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
    const { data } = await query;
    return data || [];
  }

  /**
   * Create customer
   */
  async createCustomer(data: { name: string; phone: string; address?: string; notes?: string }): Promise<Customer> {
    const { data: cust, error } = await supabase
      .from('customers')
      .insert([{
        name: data.name.trim(),
        phone: data.phone.trim(),
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
        total_debt: 0,
        paid_debt: 0,
        remaining_debt: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error || !cust) {
      throw new Error(error?.message || 'Khalad baa dhacay abuurista macmiilka.');
    }
    return cust;
  }

  /**
   * Fetch active batch for amount-based items (e.g. Cooking Oil FIFO costing)
   */
  async getActiveOilBatch(variantId: string): Promise<ProductBatch | null> {
    const { data } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_variant_id', variantId)
      .eq('status', 'active')
      .gt('remaining_quantity', 0)
      .order('received_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    return data || null;
  }

  /**
   * Production POS Sale Execution
   * Validates stock, calculates totals, creates sale, sale_items, updates stock_quantity,
   * logs stock_movements, and records debt if credit/partial.
   */
  async executeSale(params: {
    items: CartItem[];
    paymentMethod: PaymentMethod;
    amountPaid?: number;
    overallDiscount?: number;
    customerId?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string; sale?: Sale; saleId?: string }> {
    const { items, paymentMethod, notes } = params;

    if (!items || items.length === 0) {
      return { success: false, error: 'Ma jiro wax alaab ah oo ku jira gaariga iibka (Cart is empty).' };
    }

    // Customer requirement for Credit / Partial sales
    if ((paymentMethod === 'credit' || paymentMethod === 'partial') && !params.customerId) {
      return {
        success: false,
        error: 'Iibka deynta ama qeybta ah wuxuu u baahan yahay macmiil (Customer is required for credit/partial sale).',
      };
    }

    try {
      // 1. Strict server-side pre-validation of stock for all items
      for (const item of items) {
        const isAmountBased = item.variant?.management_mode === 'amount_based' || item.actual_quantity_used !== undefined;
        const qtyToDeduct = isAmountBased && item.actual_quantity_used !== undefined 
          ? Number(item.actual_quantity_used) 
          : Number(item.quantity);

        const { data: curVar, error: varFetchErr } = await supabase
          .from('product_variants')
          .select('stock_quantity, selling_unit, product:products(name)')
          .eq('id', item.variant.id)
          .single();

        if (varFetchErr || !curVar) {
          return { success: false, error: `Alaabta ${item.product.name} lagama helin database-ka.` };
        }

        const currentStock = Number(curVar.stock_quantity ?? 0);
        const unitLabel = curVar.selling_unit || item.variant.selling_unit || 'xabo';
        const itemName = (curVar.product as any)?.name || item.product.name;

        if (currentStock < qtyToDeduct) {
          return {
            success: false,
            error: `Stock-ku kuma filna: ${itemName}. Waxaa haray kaliya ${currentStock} ${unitLabel}, laakiin waxaad isku dayday inaad iibiso ${qtyToDeduct} ${unitLabel}.`,
          };
        }
      }

      // 2. Financial calculation
      const saleCalc = calculateSaleTotal(items, Number(params.overallDiscount || 0));
      const subtotal = saleCalc.subtotal;
      const costAmount = saleCalc.costAmount;
      const discount = saleCalc.totalDiscount;
      const totalAmount = saleCalc.totalAmount;

      const amountPaid = paymentMethod === 'cash' 
        ? totalAmount 
        : Math.min(totalAmount, Math.max(0, Number(params.amountPaid || 0)));
      const debtAmount = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);
      const grossProfit = saleCalc.grossProfit;

      // 3. Create Sale row
      const { data: createdSale, error: saleErr } = await supabase
        .from('sales')
        .insert([{
          customer_id: params.customerId || null,
          subtotal,
          discount,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          debt_amount: debtAmount,
          cost_amount: roundToCents(costAmount),
          gross_profit: roundToCents(grossProfit),
          payment_method: paymentMethod,
          notes: notes || null,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (saleErr || !createdSale) {
        return { success: false, error: saleErr?.message || 'Diiwaangelinta iibka way fashilantay.' };
      }

      const saleId = createdSale.id;

      // 4. Create Sale Items and deduct stock
      for (const item of items) {
        const mode = item.pricing_mode || item.variant?.pricing_mode || 'fixed';
        const itemSos = item.sosPrice ?? item.variant?.sos_price ?? 0;
        const isAmountBased = item.variant?.management_mode === 'amount_based' || item.actual_quantity_used !== undefined;
        const actualLitersUsed = isAmountBased && item.actual_quantity_used !== undefined 
          ? Number(item.actual_quantity_used) 
          : Number(item.quantity);

        let itemLineTotal = Math.round((item.quantity * item.unitPrice - (item.discount || 0)) * 100) / 100;
        if (mode === 'denomination' && itemSos > 0) {
          const denomRes = calculateSosDenomination(Math.round(itemSos * item.quantity));
          itemLineTotal = denomRes.denominationUsd;
        }

        // Active batch lookup for amount-based oil
        let activeBatch: ProductBatch | null = null;
        let effectiveUnitCost = item.unitCost;

        if (isAmountBased) {
          activeBatch = await this.getActiveOilBatch(item.variant.id);
          if (activeBatch) {
            effectiveUnitCost = activeBatch.cost_per_unit || item.unitCost;
            const remainingQty = Number(activeBatch.remaining_quantity || 0);
            const newBatchRemaining = Math.max(0, Number((remainingQty - actualLitersUsed).toFixed(4)));
            await supabase
              .from('product_batches')
              .update({
                remaining_quantity: newBatchRemaining,
                quantity_sold: Number(((activeBatch.quantity_sold || 0) + actualLitersUsed).toFixed(4)),
                status: newBatchRemaining === 0 ? 'finished' : 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', activeBatch.id);
          }
        }

        const itemCostTotal = isAmountBased 
          ? cleanPrecision(actualLitersUsed * effectiveUnitCost) 
          : cleanPrecision(item.quantity * effectiveUnitCost);
        const itemProfit = cleanPrecision(itemLineTotal - itemCostTotal);

        // Insert sale_item
        const saleItemPayload: any = {
          sale_id: saleId,
          product_variant_id: item.variant.id,
          quantity: item.quantity,
          unit: item.variant.selling_unit,
          unit_price: item.unitPrice,
          unit_cost: effectiveUnitCost,
          discount: item.discount || 0,
          total_price: itemLineTotal,
          gross_profit: roundToCents(itemProfit),
          batch_id: activeBatch?.id || null,
          actual_quantity_used: isAmountBased ? actualLitersUsed : null,
          selling_method: item.selling_method || (isAmountBased ? (item.amount_based_value ? 'money' : 'liter') : 'liter'),
          selling_option_label: item.selling_option_label || null,
          created_at: new Date().toISOString(),
        };

        await supabase.from('sale_items').insert([saleItemPayload]);

        // Deduct variant stock
        const { data: curVar } = await supabase
          .from('product_variants')
          .select('stock_quantity, selling_unit')
          .eq('id', item.variant.id)
          .single();

        const prevStock = Number(curVar?.stock_quantity || 0);
        const qtyDeducted = isAmountBased ? actualLitersUsed : item.quantity;
        const newStock = Math.max(0, Number((prevStock - qtyDeducted).toFixed(4)));

        await supabase
          .from('product_variants')
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.variant.id);

        // Record stock movement
        await supabase.from('stock_movements').insert([{
          product_variant_id: item.variant.id,
          type: 'sale',
          quantity: -qtyDeducted,
          previous_quantity: prevStock,
          new_quantity: newStock,
          unit: curVar?.selling_unit || item.variant.selling_unit,
          reference_id: saleId,
          notes: `POS Sale: #${saleId.slice(0, 8)}`,
          created_at: new Date().toISOString(),
        }]);
      }

      // 5. If Debt amount > 0, record in debts table and update customer
      if (debtAmount > 0 && params.customerId) {
        const itemsSummary = items.map(i => `${i.product.name} (${i.quantity} ${i.variant.selling_unit})`).join(', ');
        await supabase.from('debts').insert([{
          customer_id: params.customerId,
          sale_id: saleId,
          items_summary: itemsSummary,
          original_amount: totalAmount,
          amount_paid: amountPaid,
          remaining_balance: debtAmount,
          status: amountPaid > 0 ? 'partial' : 'unpaid',
          notes: notes || 'Dayn POS iib ah',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

        // Update customer total & remaining debt
        const { data: cust } = await supabase
          .from('customers')
          .select('total_debt, remaining_debt')
          .eq('id', params.customerId)
          .single();

        if (cust) {
          const newTotalDebt = Number(((cust.total_debt || 0) + debtAmount).toFixed(2));
          const newRemainingDebt = Number(((cust.remaining_debt || 0) + debtAmount).toFixed(2));
          await supabase
            .from('customers')
            .update({
              total_debt: newTotalDebt,
              remaining_debt: newRemainingDebt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', params.customerId);
        }
      }

      return { success: true, sale: createdSale, saleId };
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('network request failed') ||
        msg.toLowerCase().includes('connection') ||
        msg.toLowerCase().includes('aborterror')
      ) {
        return {
          success: false,
          error: 'Internet connection ayaa loo baahan yahay si iibka loo xaqiijiyo.',
        };
      }
      return { success: false, error: msg || 'Khalad lama filaan ah baa dhacay intii iibka lagu guda jiray.' };
    }
  }

  /**
   * Fetch debts with status filter
   */
  async getDebts(statusFilter: string = 'all'): Promise<Debt[]> {
    let query = supabase
      .from('debts')
      .select('*, customer:customers(*), sale:sales(*)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Debts fetch error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Fetch debt payments history
   */
  async getDebtPayments(debtId?: string): Promise<any[]> {
    let query = supabase
      .from('debt_payments')
      .select('*, customer:customers(*)')
      .order('created_at', { ascending: false });

    if (debtId) {
      query = query.eq('debt_id', debtId);
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * Record debt payment (cash received against prior credit sale)
   */
  async recordDebtPayment(params: {
    customerId: string;
    debtId: string;
    amount: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string; remainingBalance?: number }> {
    const { customerId, debtId, amount, paymentMethod = 'cash', notes } = params;

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Fadlan geli lacag sax ah oo ka weyn 0.' };
    }

    try {
      const { data: debt, error: dErr } = await supabase
        .from('debts')
        .select('*')
        .eq('id', debtId)
        .single();

      if (dErr || !debt) {
        return { success: false, error: 'Deynta lama helin.' };
      }

      if (debt.status === 'paid' || debt.remaining_balance <= 0) {
        return { success: false, error: 'Deyntan hore ayaa loo bixiyay.' };
      }

      if (amount > debt.remaining_balance + 0.01) {
        return {
          success: false,
          error: `Lacagta la bixinayo ($${amount.toFixed(2)}) kama badnaan karto deynta haray ($${debt.remaining_balance.toFixed(2)}).`,
        };
      }

      const newPaid = Number(((debt.amount_paid || 0) + amount).toFixed(2));
      const newRemaining = Math.max(0, Number((debt.original_amount - newPaid).toFixed(2)));
      const newStatus = newRemaining === 0 ? 'paid' : 'partial';

      const { error: payErr } = await supabase.from('debt_payments').insert([{
        customer_id: customerId,
        debt_id: debtId,
        amount,
        payment_method: paymentMethod,
        notes: notes || 'Bixinta deynta mobaylka',
        created_at: new Date().toISOString(),
      }]);

      if (payErr) {
        return { success: false, error: payErr.message };
      }

      await supabase
        .from('debts')
        .update({
          amount_paid: newPaid,
          remaining_balance: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', debtId);

      const { data: cust } = await supabase
        .from('customers')
        .select('paid_debt, remaining_debt')
        .eq('id', customerId)
        .single();

      if (cust) {
        const custNewPaid = Number(((cust.paid_debt || 0) + amount).toFixed(2));
        const custNewRemaining = Math.max(0, Number(((cust.remaining_debt || 0) - amount).toFixed(2)));
        await supabase
          .from('customers')
          .update({
            paid_debt: custNewPaid,
            remaining_debt: custNewRemaining,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId);
      }

      return { success: true, remainingBalance: newRemaining };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Khalad baa dhacay intii lacag bixinta la diiwaangelinayay.' };
    }
  }

  /**
   * Fetch customer profile, debt balance, and sales history
   */
  async getCustomerDetails(customerId: string): Promise<{
    customer: Customer | null;
    debts: Debt[];
    payments: any[];
    sales: any[];
  }> {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    const { data: debts } = await supabase
      .from('debts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const { data: payments } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      customer: customer || null,
      debts: debts || [],
      payments: payments || [],
      sales: sales || [],
    };
  }

  /**
   * Admin-only: Fetch suppliers
   */
  async getSuppliers(userRole: UserRole): Promise<Supplier[]> {
    if (userRole !== 'admin') {
      return [];
    }
    const { data } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
    return data || [];
  }

  /**
   * Admin-only: Create supplier
   */
  async createSupplier(
    data: { name: string; phone: string; company?: string; address?: string; notes?: string },
    userRole: UserRole
  ): Promise<{ success: boolean; error?: string; supplier?: Supplier }> {
    if (userRole !== 'admin') {
      return { success: false, error: 'Kaliya maamulaha (Admin) ayaa awood u leh inuu abuuro alaab-qeybiye.' };
    }
    const { data: sup, error } = await supabase
      .from('suppliers')
      .insert([{
        name: data.name.trim(),
        phone: data.phone.trim(),
        company: data.company?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error || !sup) {
      return { success: false, error: error?.message || 'Khalad baa dhacay abuurista alaab-qeybiyaha.' };
    }
    return { success: true, supplier: sup };
  }

  /**
   * Admin-only: Fetch expenses
   */
  async getExpenses(userRole: UserRole): Promise<Expense[]> {
    if (userRole !== 'admin') {
      return [];
    }
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  /**
   * Admin-only: Create expense
   */
  async createExpense(
    data: { category: string; amount: number; description: string; notes?: string },
    userRole: UserRole
  ): Promise<{ success: boolean; error?: string; expense?: Expense }> {
    if (userRole !== 'admin') {
      return { success: false, error: 'Kaliya maamulaha (Admin) ayaa awood u leh inuu diiwaangeliyo kharash.' };
    }

    if (isNaN(data.amount) || data.amount <= 0) {
      return { success: false, error: 'Fadlan geli lacag sax ah oo ka weyn $0.' };
    }

    const { data: exp, error } = await supabase
      .from('expenses')
      .insert([{
        category: data.category,
        amount: data.amount,
        description: data.description.trim(),
        date: new Date().toISOString().split('T')[0],
        notes: data.notes?.trim() || null,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error || !exp) {
      return { success: false, error: error?.message || 'Khalad baa dhacay diiwaangelinta kharashka.' };
    }
    return { success: true, expense: exp };
  }

  /**
   * Financial & Performance Reports
   * Computes revenue, profit, expenses, debts, and inventory valuation
   */
  async getReportsSummary(period: 'today' | 'week' | 'month' = 'today'): Promise<{
    salesCount: number;
    revenue: number;
    grossProfit: number;
    costAmount: number;
    expensesTotal: number;
    netProfit: number;
    debtsOutstanding: number;
    stockCostValuation: number;
    stockRetailValuation: number;
  }> {
    const now = new Date();
    const startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    // 1. Sales in period
    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount, gross_profit, cost_amount')
      .gte('created_at', startDate.toISOString());

    const salesCount = sales?.length || 0;
    const revenue = (sales || []).reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
    const grossProfit = (sales || []).reduce((acc, s) => acc + Number(s.gross_profit || 0), 0);
    const costAmount = (sales || []).reduce((acc, s) => acc + Number(s.cost_amount || 0), 0);

    // 2. Expenses in period
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .gte('created_at', startDate.toISOString());

    const expensesTotal = (expenses || []).reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const netProfit = Number((grossProfit - expensesTotal).toFixed(2));

    // 3. Outstanding Debts
    const { data: debts } = await supabase
      .from('debts')
      .select('remaining_balance')
      .in('status', ['unpaid', 'partial']);

    const debtsOutstanding = (debts || []).reduce((acc, d) => acc + Number(d.remaining_balance || 0), 0);

    // 4. Stock valuation
    const { data: variants } = await supabase
      .from('product_variants')
      .select('stock_quantity, buy_price, sell_price, conversion_factor')
      .eq('is_active', true);

    let stockCostValuation = 0;
    let stockRetailValuation = 0;

    for (const v of variants || []) {
      const qty = Math.max(0, Number(v.stock_quantity || 0));
      const unitCost = calculateCostPerBaseUnit(Number(v.buy_price || 0), Number(v.conversion_factor || 1));
      const unitPrice = Number(v.sell_price || 0);
      stockCostValuation += qty * unitCost;
      stockRetailValuation += qty * unitPrice;
    }

    return {
      salesCount,
      revenue: roundToCents(revenue),
      grossProfit: roundToCents(grossProfit),
      costAmount: roundToCents(costAmount),
      expensesTotal: roundToCents(expensesTotal),
      netProfit: roundToCents(grossProfit - expensesTotal),
      debtsOutstanding: roundToCents(debtsOutstanding),
      stockCostValuation: roundToCents(stockCostValuation),
      stockRetailValuation: roundToCents(stockRetailValuation),
    };
  }

  /**
   * Admin-only: Fetch system user profiles
   */
  async getProfiles(userRole: UserRole): Promise<SystemUser[]> {
    if (userRole !== 'admin') {
      return [];
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((p: any) => {
      const roleStr = String(p.role || '').toLowerCase();
      const role: UserRole = roleStr === 'reporter' ? 'reporter' : (roleStr === 'seller' ? 'seller' : 'admin');
      const email = p.email || (p.phone ? `${p.phone}@tukaan.so` : 'user@tukaan.so');
      return {
        id: p.id,
        name: p.full_name || email.split('@')[0] || 'User',
        email,
        role,
        status: 'active',
        created_at: p.created_at || new Date().toISOString(),
        shop_id: p.shop_id || null,
      };
    });
  }

  /**
   * Admin-only: Update a profile's role
   */
  async updateProfileRole(
    targetUserId: string,
    newRole: UserRole,
    currentUserRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    if (currentUserRole !== 'admin') {
      return { success: false, error: 'Kaliya maamulaha (Admin) ayaa awood u leh inuu beddelo doorarka.' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role: newRole,
      })
      .eq('id', targetUserId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }
}

export const mobileApi = new MobileApiService();
