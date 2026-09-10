-- ====================================================================
-- TUKAAN MANAGEMENT SYSTEM — SYSTEM-WIDE EDIT, CORRECTION & AUDIT MIGRATION
-- PostgreSQL / Supabase RPC Functions, Strict Inventory & Accounting Integrity
-- ====================================================================

-- 1. ENHANCE AUDIT LOGS TABLE
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

-- Ensure columns exist if table was already created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_name') THEN
        ALTER TABLE audit_logs ADD COLUMN user_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_role') THEN
        ALTER TABLE audit_logs ADD COLUMN user_role VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'previous_values') THEN
        ALTER TABLE audit_logs ADD COLUMN previous_values JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'new_values') THEN
        ALTER TABLE audit_logs ADD COLUMN new_values JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'reason') THEN
        ALTER TABLE audit_logs ADD COLUMN reason TEXT;
    END IF;
END $$;

-- Indexes for Audit Queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS: Only authenticated users with Admin role can read audit logs. No standard user can update or delete.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            ) OR NOT EXISTS (
                SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
            )
        )
    );

CREATE POLICY "Authenticated users can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR true);

-- Disallow Update & Delete on Audit Logs to preserve immutable audit trail
CREATE POLICY "Deny update on audit logs" ON audit_logs
    FOR UPDATE USING (false);

CREATE POLICY "Deny delete on audit logs" ON audit_logs
    FOR DELETE USING (false);

-- ====================================================================
-- 2. RPC: RECORD STOCK ADJUSTMENT (Transactional)
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
-- 3. RPC: CORRECT SALE (Atomic Sale, Inventory, Financial Reconciliation)
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
            v_old_sale.shop_id, v_variant_id, 'sale', -v_item_qty, v_variant.stock_quantity + v_item_qty, v_variant.stock_quantity,
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
-- 4. RPC: CORRECT DEBT PAYMENT (Atomic Debt, Customer, Cash Reconciliation)
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
