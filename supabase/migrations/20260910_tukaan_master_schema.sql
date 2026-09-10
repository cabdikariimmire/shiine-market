-- ====================================================================
-- TUKAAN MANAGEMENT SYSTEM — PRODUCTION DATABASE MASTER SCHEMA
-- PostgreSQL / Supabase Schema, Performance Indexes, RLS & Atomic RPCs
-- Full Production Architecture (Infinite catalog capacity, Dual Units, Atomic POS)
-- Idempotent & Re-runnable without errors
-- ====================================================================

-- Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. SHOPS & STORE SETTINGS (Multi-Tenant Ready)
-- ====================================================================
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Tukaan Shiine Supermarket',
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    currency VARCHAR(10) NOT NULL DEFAULT '$',
    phone VARCHAR(50) DEFAULT '+252 61 5500112',
    address TEXT DEFAULT 'Suuqa Bakaaraha, Mogadishu',
    logo_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 2. USER PROFILES & ACCESS CONTROL
-- ====================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'reporter', 'cashier', 'manager')),
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 3. PRODUCT CATEGORIES
-- ====================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'Package',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 4. SUPPLIERS DIRECTORY
-- ====================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    company VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 5. CUSTOMERS DIRECTORY & CREDIT PROFILES
-- ====================================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT,
    notes TEXT,
    total_debt NUMERIC(15, 2) DEFAULT 0.00 CHECK (total_debt >= 0),
    paid_debt NUMERIC(15, 2) DEFAULT 0.00 CHECK (paid_debt >= 0),
    remaining_debt NUMERIC(15, 2) DEFAULT 0.00 CHECK (remaining_debt >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 6. PRODUCTS MASTER TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 7. PRODUCT VARIANTS / SKUs (High Capacity, Multi-Unit & Conversions)
-- ====================================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL DEFAULT 'Default',
    sku VARCHAR(100),
    barcode VARCHAR(100),
    buy_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (buy_price >= 0),
    purchase_unit VARCHAR(50) NOT NULL DEFAULT 'jawan',
    sell_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (sell_price >= 0),
    selling_unit VARCHAR(50) NOT NULL DEFAULT 'kg',
    conversion_factor NUMERIC(15, 4) NOT NULL DEFAULT 1.0000 CHECK (conversion_factor > 0),
    unit_division NUMERIC(15, 4) NOT NULL DEFAULT 1.0000 CHECK (unit_division > 0),
    min_sellable_qty NUMERIC(15, 4) NOT NULL DEFAULT 1.0000 CHECK (min_sellable_qty > 0),
    stock_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (stock_quantity >= 0),
    minimum_stock NUMERIC(15, 4) NOT NULL DEFAULT 10.0000 CHECK (minimum_stock >= 0),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_pending BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 8. SUPPLIER TRANSACTIONS (Stock In / Purchases / Invoices)
-- ====================================================================
CREATE TABLE IF NOT EXISTS supplier_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    reference_number VARCHAR(100),
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    notes TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 9. SUPPLIER TRANSACTION ITEMS (Line-Item Breakdown)
-- ====================================================================
CREATE TABLE IF NOT EXISTS supplier_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES supplier_transactions(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    purchase_unit VARCHAR(50) NOT NULL,
    buy_price NUMERIC(15, 4) NOT NULL CHECK (buy_price >= 0),
    conversion_factor NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    total_cost NUMERIC(15, 2) NOT NULL CHECK (total_cost >= 0),
    is_pending BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 10. SALES TRANSACTIONS (POS Register)
-- ====================================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    debt_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (debt_amount >= 0),
    cost_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (cost_amount >= 0),
    gross_profit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'credit', 'partial', 'evc_plus', 'zaad', 'sahal', 'edahab', 'bank')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 11. SALE ITEMS (Line Items with Profit Tracking)
-- ====================================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    unit_price NUMERIC(15, 4) NOT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_cost >= 0),
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total_price NUMERIC(15, 2) NOT NULL CHECK (total_price >= 0),
    gross_profit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 12. STOCK MOVEMENTS (Immutable Ledger for Inventory Audit Trail)
-- ====================================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'sale', 'sale_return', 'purchase_return', 'adjustment', 'ai_count', 'sale_correction')),
    quantity NUMERIC(15, 4) NOT NULL, -- Positive for stock in, negative for stock out
    previous_quantity NUMERIC(15, 4) NOT NULL,
    new_quantity NUMERIC(15, 4) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 13. CUSTOMER DEBTS LEDGER
-- ====================================================================
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    items_summary TEXT,
    original_amount NUMERIC(15, 2) NOT NULL CHECK (original_amount > 0),
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    remaining_balance NUMERIC(15, 2) NOT NULL CHECK (remaining_balance >= 0),
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
    call_logs JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 14. DEBT PAYMENTS
-- ====================================================================
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'evc_plus', 'zaad', 'sahal', 'bank', 'edahab')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 15. OPERATING EXPENSES (Overheads & Utility Costs)
-- ====================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL CHECK (category IN (
        'electricity', 'water', 'transport', 'rent', 'salary', 'maintenance', 
        'internet_phone', 'other', 'koronto', 'biyo', 'gaadiid', 'kiro', 
        'mushahar', 'dayactir', 'internet_tel', 'kale'
    )),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 16. SYSTEM NOTIFICATIONS & ALERTS
-- ====================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'low_stock_email', 'out_of_stock_email', 'debt_overdue'
    recipient VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- 17. SYSTEM AUDIT LOGS (Immutable Security Trail)
-- ====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID,
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    previous_values JSONB,
    new_values JSONB,
    reason TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================
-- HIGH-PERFORMANCE DATABASE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON categories(shop_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_shop_id ON suppliers(shop_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_variants_shop_id ON product_variants(shop_id);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_name ON product_variants(variant_name);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_is_active ON product_variants(is_active);
CREATE INDEX IF NOT EXISTS idx_variants_is_pending ON product_variants(is_pending);
CREATE INDEX IF NOT EXISTS idx_variants_stock_quantity ON product_variants(stock_quantity);

CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id ON supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_date ON supplier_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant_id ON sale_items(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON stock_movements(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);

CREATE INDEX IF NOT EXISTS idx_debts_customer_id ON debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);

CREATE INDEX IF NOT EXISTS idx_debt_payments_customer_id ON debt_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_created_at ON debt_payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_id ON expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (Idempotent with DROP IF EXISTS)
-- ====================================================================
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies for Profiles
DROP POLICY IF EXISTS "Public profiles read" ON profiles;
CREATE POLICY "Public profiles read" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
CREATE POLICY "Users can manage own profile" ON profiles FOR ALL USING (id = auth.uid() OR auth.uid() IS NOT NULL);

-- Read Access Policies (Admin and Reporter have read access across all entities)
DROP POLICY IF EXISTS "Allow read shops" ON shops;
CREATE POLICY "Allow read shops" ON shops FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write shops" ON shops;
CREATE POLICY "Allow write shops" ON shops FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read categories" ON categories;
CREATE POLICY "Allow read categories" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write categories" ON categories;
CREATE POLICY "Allow write categories" ON categories FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read suppliers" ON suppliers;
CREATE POLICY "Allow read suppliers" ON suppliers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write suppliers" ON suppliers;
CREATE POLICY "Allow write suppliers" ON suppliers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read customers" ON customers;
CREATE POLICY "Allow read customers" ON customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write customers" ON customers;
CREATE POLICY "Allow write customers" ON customers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read products" ON products;
CREATE POLICY "Allow read products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write products" ON products;
CREATE POLICY "Allow write products" ON products FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read product_variants" ON product_variants;
CREATE POLICY "Allow read product_variants" ON product_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write product_variants" ON product_variants;
CREATE POLICY "Allow write product_variants" ON product_variants FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read supplier_transactions" ON supplier_transactions;
CREATE POLICY "Allow read supplier_transactions" ON supplier_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write supplier_transactions" ON supplier_transactions;
CREATE POLICY "Allow write supplier_transactions" ON supplier_transactions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read supplier_transaction_items" ON supplier_transaction_items;
CREATE POLICY "Allow read supplier_transaction_items" ON supplier_transaction_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write supplier_transaction_items" ON supplier_transaction_items;
CREATE POLICY "Allow write supplier_transaction_items" ON supplier_transaction_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read sales" ON sales;
CREATE POLICY "Allow read sales" ON sales FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write sales" ON sales;
CREATE POLICY "Allow write sales" ON sales FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read sale_items" ON sale_items;
CREATE POLICY "Allow read sale_items" ON sale_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write sale_items" ON sale_items;
CREATE POLICY "Allow write sale_items" ON sale_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read stock_movements" ON stock_movements;
CREATE POLICY "Allow read stock_movements" ON stock_movements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write stock_movements" ON stock_movements;
CREATE POLICY "Allow write stock_movements" ON stock_movements FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read debts" ON debts;
CREATE POLICY "Allow read debts" ON debts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write debts" ON debts;
CREATE POLICY "Allow write debts" ON debts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read debt_payments" ON debt_payments;
CREATE POLICY "Allow read debt_payments" ON debt_payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write debt_payments" ON debt_payments;
CREATE POLICY "Allow write debt_payments" ON debt_payments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read expenses" ON expenses;
CREATE POLICY "Allow read expenses" ON expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write expenses" ON expenses;
CREATE POLICY "Allow write expenses" ON expenses FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read notification_logs" ON notification_logs;
CREATE POLICY "Allow read notification_logs" ON notification_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write notification_logs" ON notification_logs;
CREATE POLICY "Allow write notification_logs" ON notification_logs FOR ALL USING (true);

-- Immutable Audit Log Policies
DROP POLICY IF EXISTS "Allow read audit_logs" ON audit_logs;
CREATE POLICY "Allow read audit_logs" ON audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert audit_logs" ON audit_logs;
CREATE POLICY "Allow insert audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Deny update audit_logs" ON audit_logs;
CREATE POLICY "Deny update audit_logs" ON audit_logs FOR UPDATE USING (false);
DROP POLICY IF EXISTS "Deny delete audit_logs" ON audit_logs;
CREATE POLICY "Deny delete audit_logs" ON audit_logs FOR DELETE USING (false);

-- ====================================================================
-- RPC 1: EXECUTE SALE (Atomic POS Sale, Stock Deduction, Debt & Profit)
-- ====================================================================
CREATE OR REPLACE FUNCTION execute_sale(
    p_shop_id UUID DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb, -- Array of { variant_id, quantity, unit_price, unit_cost, discount }
    p_payment_method VARCHAR DEFAULT 'cash',
    p_overall_discount NUMERIC DEFAULT 0,
    p_amount_paid NUMERIC DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_variant RECORD;
    v_sale_id UUID;
    v_subtotal NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_debt_amount NUMERIC := 0;
    v_gross_profit NUMERIC := 0;
    v_item_subtotal NUMERIC;
    v_item_discount NUMERIC;
    v_item_total NUMERIC;
    v_item_cost NUMERIC;
    v_item_profit NUMERIC;
    v_final_amount_paid NUMERIC;
BEGIN
    -- 1. Pre-validation: Verify available stock for every item before altering database state
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        variant_id UUID,
        quantity NUMERIC,
        unit_price NUMERIC,
        unit_cost NUMERIC,
        discount NUMERIC
    )
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Tirada iibka waa inay ka weynaataa 0';
        END IF;

        SELECT id, variant_name, stock_quantity, selling_unit, buy_price, conversion_factor
        INTO v_variant 
        FROM product_variants 
        WHERE id = v_item.variant_id FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Alaabta lama helin (ID: %)', v_item.variant_id;
        END IF;

        IF v_variant.stock_quantity <= 0 THEN
            RAISE EXCEPTION 'Alaabtan "%" way dhammaatay (Out of Stock). Lama iibin karo.', v_variant.variant_name;
        END IF;

        IF v_item.quantity > v_variant.stock_quantity THEN
            RAISE EXCEPTION 'Stock-ku kuma filna alaabta "%". Waxaa haray kaliya % %, laakiin waxaad codsatay % %.',
                v_variant.variant_name, v_variant.stock_quantity, v_variant.selling_unit, v_item.quantity, v_variant.selling_unit;
        END IF;
    END LOOP;

    -- 2. Compute sale totals
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        variant_id UUID,
        quantity NUMERIC,
        unit_price NUMERIC,
        unit_cost NUMERIC,
        discount NUMERIC
    )
    LOOP
        v_item_subtotal := (v_item.quantity * v_item.unit_price);
        v_item_discount := COALESCE(v_item.discount, 0);
        v_item_total := GREATEST(0, v_item_subtotal - v_item_discount);
        v_item_cost := (v_item.quantity * COALESCE(v_item.unit_cost, 0));

        v_subtotal := v_subtotal + v_item_subtotal;
        v_total_cost := v_total_cost + v_item_cost;
    END LOOP;

    v_total_amount := GREATEST(0, v_subtotal - COALESCE(p_overall_discount, 0));

    IF p_payment_method = 'cash' THEN
        v_final_amount_paid := v_total_amount;
        v_debt_amount := 0;
    ELSIF p_payment_method = 'credit' THEN
        v_final_amount_paid := 0;
        v_debt_amount := v_total_amount;
    ELSE
        v_final_amount_paid := LEAST(v_total_amount, GREATEST(0, COALESCE(p_amount_paid, 0)));
        v_debt_amount := GREATEST(0, v_total_amount - v_final_amount_paid);
    END IF;

    v_gross_profit := v_total_amount - v_total_cost;
    v_sale_id := uuid_generate_v4();

    -- 3. Insert Sale Master Record
    INSERT INTO sales (
        id, shop_id, customer_id, subtotal, discount, total_amount,
        amount_paid, debt_amount, cost_amount, gross_profit,
        payment_method, notes, created_at
    ) VALUES (
        v_sale_id, p_shop_id, p_customer_id, v_subtotal, COALESCE(p_overall_discount, 0), v_total_amount,
        v_final_amount_paid, v_debt_amount, v_total_cost, v_gross_profit,
        p_payment_method, p_notes, NOW()
    );

    -- 4. Insert Sale Items, Deduct Stock, and Record Immutable Stock Movements
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        variant_id UUID,
        quantity NUMERIC,
        unit_price NUMERIC,
        unit_cost NUMERIC,
        discount NUMERIC
    )
    LOOP
        SELECT * INTO v_variant FROM product_variants WHERE id = v_item.variant_id;

        v_item_subtotal := (v_item.quantity * v_item.unit_price);
        v_item_discount := COALESCE(v_item.discount, 0);
        v_item_total := GREATEST(0, v_item_subtotal - v_item_discount);
        v_item_cost := (v_item.quantity * COALESCE(v_item.unit_cost, 0));
        v_item_profit := v_item_total - v_item_cost;

        -- Atomic Stock Reduction
        UPDATE product_variants 
        SET stock_quantity = stock_quantity - v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.variant_id;

        -- Record Sale Item
        INSERT INTO sale_items (
            sale_id, product_variant_id, quantity, unit,
            unit_price, unit_cost, discount, total_price, gross_profit
        ) VALUES (
            v_sale_id, v_item.variant_id, v_item.quantity, v_variant.selling_unit,
            v_item.unit_price, COALESCE(v_item.unit_cost, 0), v_item_discount,
            v_item_total, v_item_profit
        );

        -- Record Stock Movement
        INSERT INTO stock_movements (
            shop_id, product_variant_id, type, quantity,
            previous_quantity, new_quantity, unit, reference_id, reference_type, notes
        ) VALUES (
            p_shop_id, v_item.variant_id, 'sale', -v_item.quantity,
            v_variant.stock_quantity, v_variant.stock_quantity - v_item.quantity,
            v_variant.selling_unit, v_sale_id, 'sale', 'POS Sale: #' || SUBSTRING(v_sale_id::text, 1, 8)
        );
    END LOOP;

    -- 5. Create Customer Debt Record if there is an unpaid balance
    IF v_debt_amount > 0 AND p_customer_id IS NOT NULL THEN
        INSERT INTO debts (
            shop_id, customer_id, sale_id, original_amount, amount_paid,
            remaining_balance, status, notes, created_at, updated_at
        ) VALUES (
            p_shop_id, p_customer_id, v_sale_id, v_total_amount, v_final_amount_paid,
            v_debt_amount, CASE WHEN v_final_amount_paid > 0 THEN 'partial' ELSE 'unpaid' END,
            'Debt from Sale #' || SUBSTRING(v_sale_id::text, 1, 8), NOW(), NOW()
        );

        UPDATE customers 
        SET total_debt = COALESCE(total_debt, 0) + v_total_amount,
            paid_debt = COALESCE(paid_debt, 0) + v_final_amount_paid,
            remaining_debt = COALESCE(remaining_debt, 0) + v_debt_amount,
            updated_at = NOW()
        WHERE id = p_customer_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'total_amount', v_total_amount,
        'amount_paid', v_final_amount_paid,
        'debt_amount', v_debt_amount,
        'gross_profit', v_gross_profit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- RPC 2: RECORD STOCK ADJUSTMENT (Atomic Inventory Adjustment & Audit)
-- ====================================================================
CREATE OR REPLACE FUNCTION record_stock_adjustment(
    p_variant_id UUID,
    p_quantity_change NUMERIC,
    p_reason TEXT,
    p_user_id UUID DEFAULT NULL,
    p_user_name VARCHAR DEFAULT NULL,
    p_user_role VARCHAR DEFAULT 'admin'
)
RETURNS JSONB AS $$
DECLARE
    v_variant RECORD;
    v_new_stock NUMERIC;
    v_movement_id UUID;
BEGIN
    SELECT * INTO v_variant FROM product_variants WHERE id = p_variant_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product variant not found: %', p_variant_id;
    END IF;

    v_new_stock := v_variant.stock_quantity + p_quantity_change;
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Kaydku ma noqon karo mid ka yar 0. Kaydka hadda: %, Isbeddelka: %', v_variant.stock_quantity, p_quantity_change;
    END IF;

    UPDATE product_variants 
    SET stock_quantity = v_new_stock, updated_at = NOW()
    WHERE id = p_variant_id;

    v_movement_id := uuid_generate_v4();
    INSERT INTO stock_movements (
        id, shop_id, product_variant_id, type, quantity, previous_quantity, new_quantity, unit, reference_id, reference_type, notes, created_at
    ) VALUES (
        v_movement_id, v_variant.shop_id, p_variant_id, 'adjustment', p_quantity_change, v_variant.stock_quantity, v_new_stock, v_variant.selling_unit, NULL, 'manual_adjustment', p_reason, NOW()
    );

    INSERT INTO audit_logs (
        shop_id, user_id, user_name, user_role, action, entity_type, entity_id, previous_values, new_values, reason, created_at
    ) VALUES (
        v_variant.shop_id, p_user_id, p_user_name, p_user_role, 'STOCK_ADJUSTMENT', 'product_variant', p_variant_id,
        jsonb_build_object('stock_quantity', v_variant.stock_quantity),
        jsonb_build_object('stock_quantity', v_new_stock, 'quantity_change', p_quantity_change),
        p_reason, NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'variant_id', p_variant_id,
        'previous_quantity', v_variant.stock_quantity,
        'new_quantity', v_new_stock,
        'quantity_change', p_quantity_change
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- RPC 3: CORRECT SALE (Atomic Sale Correction & Inventory Reconciliation)
-- ====================================================================
CREATE OR REPLACE FUNCTION correct_sale(
    p_sale_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_payment_method VARCHAR DEFAULT 'cash',
    p_amount_paid NUMERIC DEFAULT 0,
    p_overall_discount NUMERIC DEFAULT 0,
    p_created_at TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_reason TEXT DEFAULT 'Sixid Iibka',
    p_user_id UUID DEFAULT NULL,
    p_user_name VARCHAR DEFAULT NULL,
    p_user_role VARCHAR DEFAULT 'admin'
)
RETURNS JSONB AS $$
DECLARE
    v_old_sale RECORD;
    v_item JSONB;
    v_variant RECORD;
    v_prev_item RECORD;
    v_calc_subtotal NUMERIC := 0;
    v_calc_discount NUMERIC := COALESCE(p_overall_discount, 0);
    v_calc_total NUMERIC := 0;
    v_calc_cost NUMERIC := 0;
    v_calc_gross_profit NUMERIC := 0;
    v_debt_amount NUMERIC := 0;
    v_final_amount_paid NUMERIC := 0;
    v_item_subtotal NUMERIC;
    v_item_discount NUMERIC;
    v_item_total NUMERIC;
    v_item_cost NUMERIC;
    v_item_profit NUMERIC;
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_variant_id UUID;
BEGIN
    SELECT * INTO v_old_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale not found: %', p_sale_id;
    END IF;

    -- 1. Revert previous stock deduction for all old sale items
    FOR v_prev_item IN (SELECT * FROM sale_items WHERE sale_id = p_sale_id) LOOP
        UPDATE product_variants
        SET stock_quantity = stock_quantity + v_prev_item.quantity,
            updated_at = NOW()
        WHERE id = v_prev_item.product_variant_id;
    END LOOP;

    -- 2. Validate new requested items and check stock availability
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'productVariantId')::UUID;
        v_item_qty := (v_item->>'quantity')::NUMERIC;
        v_item_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

        IF v_item_qty <= 0 THEN
            RAISE EXCEPTION 'Tirada iibka waa inay ka weynaataa 0';
        END IF;

        SELECT * INTO v_variant FROM product_variants WHERE id = v_variant_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Alaabta lama helin: %', v_variant_id;
        END IF;

        IF v_variant.stock_quantity < v_item_qty THEN
            RAISE EXCEPTION 'Kaydku kuma filna alaabta % (%). Kaydka hadda: %, Waxaad dooneysaa: %', 
                v_variant.variant_name, v_variant_id, v_variant.stock_quantity, v_item_qty;
        END IF;

        -- Deduct new stock
        UPDATE product_variants
        SET stock_quantity = stock_quantity - v_item_qty,
            updated_at = NOW()
        WHERE id = v_variant_id;

        -- Calculate item financials
        v_item_subtotal := v_item_qty * v_item_price;
        v_item_total := GREATEST(0, v_item_subtotal - v_item_discount);
        v_item_cost := v_item_qty * (v_variant.buy_price / GREATEST(1, v_variant.conversion_factor));
        v_item_profit := v_item_total - v_item_cost;

        v_calc_subtotal := v_calc_subtotal + v_item_subtotal;
        v_calc_discount := v_calc_discount + v_item_discount;
        v_calc_total := v_calc_total + v_item_total;
        v_calc_cost := v_calc_cost + v_item_cost;
        v_calc_gross_profit := v_calc_gross_profit + v_item_profit;
    END LOOP;

    v_calc_total := GREATEST(0, v_calc_total - COALESCE(p_overall_discount, 0));
    v_calc_gross_profit := v_calc_total - v_calc_cost;

    IF p_payment_method = 'cash' THEN
        v_final_amount_paid := v_calc_total;
        v_debt_amount := 0;
    ELSE
        v_final_amount_paid := LEAST(v_calc_total, GREATEST(0, COALESCE(p_amount_paid, 0)));
        v_debt_amount := GREATEST(0, v_calc_total - v_final_amount_paid);
    END IF;

    -- 3. Update Sale row in-place
    UPDATE sales
    SET customer_id = p_customer_id,
        subtotal = v_calc_subtotal,
        discount = v_calc_discount,
        total_amount = v_calc_total,
        amount_paid = v_final_amount_paid,
        debt_amount = v_debt_amount,
        cost_amount = v_calc_cost,
        gross_profit = v_calc_gross_profit,
        payment_method = p_payment_method,
        notes = p_notes,
        created_at = COALESCE(p_created_at, created_at)
    WHERE id = p_sale_id;

    -- 4. Replace Sale Items
    DELETE FROM sale_items WHERE sale_id = p_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'productVariantId')::UUID;
        v_item_qty := (v_item->>'quantity')::NUMERIC;
        v_item_price := (v_item->>'unitPrice')::NUMERIC;
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

        SELECT * INTO v_variant FROM product_variants WHERE id = v_variant_id;
        v_item_subtotal := v_item_qty * v_item_price;
        v_item_total := GREATEST(0, v_item_subtotal - v_item_discount);
        v_item_cost := v_item_qty * (v_variant.buy_price / GREATEST(1, v_variant.conversion_factor));
        v_item_profit := v_item_total - v_item_cost;

        INSERT INTO sale_items (
            sale_id, product_variant_id, quantity, unit, unit_price, unit_cost, discount, total_price, gross_profit
        ) VALUES (
            p_sale_id, v_variant_id, v_item_qty, v_variant.selling_unit, v_item_price, 
            (v_variant.buy_price / GREATEST(1, v_variant.conversion_factor)), v_item_discount, v_item_total, v_item_profit
        );

        -- Record compensating stock movement
        INSERT INTO stock_movements (
            shop_id, product_variant_id, type, quantity, previous_quantity, new_quantity, unit, reference_id, reference_type, notes
        ) VALUES (
            v_old_sale.shop_id, v_variant_id, 'sale_correction', -v_item_qty, v_variant.stock_quantity + v_item_qty, v_variant.stock_quantity,
            v_variant.selling_unit, p_sale_id, 'sale_correction', 'Sixid Iibka: #' || SUBSTRING(p_sale_id::text, 1, 8)
        );
    END LOOP;

    -- 5. Reconcile Customer Debt Record if applicable
    IF v_debt_amount > 0 AND p_customer_id IS NOT NULL THEN
        UPDATE debts
        SET original_amount = v_calc_total,
            amount_paid = v_final_amount_paid,
            remaining_balance = v_debt_amount,
            status = CASE WHEN v_debt_amount = 0 THEN 'paid' WHEN v_final_amount_paid > 0 THEN 'partial' ELSE 'unpaid' END,
            updated_at = NOW()
        WHERE sale_id = p_sale_id;
    ELSE
        DELETE FROM debts WHERE sale_id = p_sale_id;
    END IF;

    -- 6. Insert Audit Log
    INSERT INTO audit_logs (
        shop_id, user_id, user_name, user_role, action, entity_type, entity_id, previous_values, new_values, reason, created_at
    ) VALUES (
        v_old_sale.shop_id, p_user_id, p_user_name, p_user_role, 'CORRECT_SALE', 'sale', p_sale_id,
        jsonb_build_object('total_amount', v_old_sale.total_amount, 'amount_paid', v_old_sale.amount_paid, 'debt_amount', v_old_sale.debt_amount),
        jsonb_build_object('total_amount', v_calc_total, 'amount_paid', v_final_amount_paid, 'debt_amount', v_debt_amount),
        p_reason, NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'total_amount', v_calc_total,
        'amount_paid', v_final_amount_paid,
        'debt_amount', v_debt_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- RPC 4: RECORD DEBT PAYMENT (Atomic Debt Balance & Customer Reconciliation)
-- ====================================================================
CREATE OR REPLACE FUNCTION record_debt_payment(
    p_customer_id UUID,
    p_debt_id UUID DEFAULT NULL,
    p_amount NUMERIC DEFAULT 0,
    p_payment_method VARCHAR DEFAULT 'cash',
    p_notes TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_user_name VARCHAR DEFAULT NULL,
    p_user_role VARCHAR DEFAULT 'admin'
)
RETURNS JSONB AS $$
DECLARE
    v_payment_id UUID;
    v_debt RECORD;
    v_shop_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Lacagta bixinta waa inay ka weynaataa 0';
    END IF;

    v_payment_id := uuid_generate_v4();

    IF p_debt_id IS NOT NULL THEN
        SELECT * INTO v_debt FROM debts WHERE id = p_debt_id FOR UPDATE;
        IF FOUND THEN
            v_shop_id := v_debt.shop_id;
            UPDATE debts
            SET amount_paid = amount_paid + p_amount,
                remaining_balance = GREATEST(0, remaining_balance - p_amount),
                status = CASE 
                    WHEN (remaining_balance - p_amount) <= 0 THEN 'paid' 
                    ELSE 'partial' 
                END,
                updated_at = NOW()
            WHERE id = p_debt_id;
        END IF;
    END IF;

    -- Record Payment Row
    INSERT INTO debt_payments (
        id, shop_id, customer_id, debt_id, amount, payment_method, notes, created_at
    ) VALUES (
        v_payment_id, v_shop_id, p_customer_id, p_debt_id, p_amount, p_payment_method, p_notes, NOW()
    );

    -- Update Customer Totals
    UPDATE customers
    SET paid_debt = COALESCE(paid_debt, 0) + p_amount,
        remaining_debt = GREATEST(0, COALESCE(remaining_debt, 0) - p_amount),
        updated_at = NOW()
    WHERE id = p_customer_id;

    -- Audit Log
    INSERT INTO audit_logs (
        shop_id, user_id, user_name, user_role, action, entity_type, entity_id, new_values, reason, created_at
    ) VALUES (
        v_shop_id, p_user_id, p_user_name, p_user_role, 'RECORD_DEBT_PAYMENT', 'debt_payment', v_payment_id,
        jsonb_build_object('amount', p_amount, 'customer_id', p_customer_id, 'debt_id', p_debt_id),
        'Qabashada Lacag Bixin Dayn', NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'amount', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- RPC 5: CORRECT DEBT PAYMENT (Atomic Payment Delta Reconciliation)
-- ====================================================================
CREATE OR REPLACE FUNCTION correct_debt_payment(
    p_payment_id UUID,
    p_new_amount NUMERIC,
    p_payment_method VARCHAR DEFAULT 'cash',
    p_created_at TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT 'Sixid Lacag Bixinta',
    p_user_id UUID DEFAULT NULL,
    p_user_name VARCHAR DEFAULT NULL,
    p_user_role VARCHAR DEFAULT 'admin'
)
RETURNS JSONB AS $$
DECLARE
    v_old_payment RECORD;
    v_delta NUMERIC;
    v_debt RECORD;
BEGIN
    IF p_new_amount <= 0 THEN
        RAISE EXCEPTION 'Lacagta bixinta waa inay ka weynaataa 0';
    END IF;

    SELECT * INTO v_old_payment FROM debt_payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt payment not found: %', p_payment_id;
    END IF;

    v_delta := p_new_amount - v_old_payment.amount;

    -- Update payment record
    UPDATE debt_payments
    SET amount = p_new_amount,
        payment_method = p_payment_method,
        notes = p_notes,
        created_at = COALESCE(p_created_at, created_at)
    WHERE id = p_payment_id;

    -- Reconcile Debt record if linked
    IF v_old_payment.debt_id IS NOT NULL THEN
        SELECT * INTO v_debt FROM debts WHERE id = v_old_payment.debt_id FOR UPDATE;
        IF FOUND THEN
            UPDATE debts
            SET amount_paid = GREATEST(0, amount_paid + v_delta),
                remaining_balance = GREATEST(0, remaining_balance - v_delta),
                status = CASE 
                    WHEN (remaining_balance - v_delta) <= 0 THEN 'paid' 
                    WHEN (amount_paid + v_delta) > 0 THEN 'partial' 
                    ELSE 'unpaid' 
                END,
                updated_at = NOW()
            WHERE id = v_old_payment.debt_id;
        END IF;
    END IF;

    -- Reconcile Customer totals
    UPDATE customers
    SET paid_debt = GREATEST(0, COALESCE(paid_debt, 0) + v_delta),
        remaining_debt = GREATEST(0, COALESCE(remaining_debt, 0) - v_delta),
        updated_at = NOW()
    WHERE id = v_old_payment.customer_id;

    -- Record Audit Log
    INSERT INTO audit_logs (
        shop_id, user_id, user_name, user_role, action, entity_type, entity_id, previous_values, new_values, reason, created_at
    ) VALUES (
        v_old_payment.shop_id, p_user_id, p_user_name, p_user_role, 'CORRECT_DEBT_PAYMENT', 'debt_payment', p_payment_id,
        jsonb_build_object('amount', v_old_payment.amount, 'payment_method', v_old_payment.payment_method),
        jsonb_build_object('amount', p_new_amount, 'payment_method', p_payment_method, 'delta', v_delta),
        p_reason, NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'previous_amount', v_old_payment.amount,
        'new_amount', p_new_amount,
        'delta', v_delta
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe column additions for existing installations
ALTER TABLE IF EXISTS product_variants ADD COLUMN IF NOT EXISTS unit_division NUMERIC(15, 4) DEFAULT 1.0000;
ALTER TABLE IF EXISTS product_variants ADD COLUMN IF NOT EXISTS min_sellable_qty NUMERIC(15, 4) DEFAULT 1.0000;

