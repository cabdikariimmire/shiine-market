-- ====================================================================
-- MIGRATION: Add Special Product Management Models & Oil Batch Costing
-- Safe & Non-Destructive: Preserves all existing products, variants, sales, and stock
-- ====================================================================

-- 1. Add Management Mode & Pack/Container configuration columns to product_variants
ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS management_mode VARCHAR(30) NOT NULL DEFAULT 'standard';

ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS pack_source_quantity NUMERIC(15, 4) DEFAULT NULL;

ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS pack_source_unit VARCHAR(50) DEFAULT NULL;

ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS pack_count NUMERIC(15, 4) DEFAULT NULL;

ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS pack_qty_per_pack NUMERIC(15, 4) DEFAULT NULL;

ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS container_unit VARCHAR(50) DEFAULT NULL;

ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS container_capacity NUMERIC(15, 4) DEFAULT NULL;

ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS selling_options JSONB DEFAULT '[]'::jsonb;

-- Add check constraint for management_mode if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_management_mode_check'
    ) THEN
        ALTER TABLE product_variants ADD CONSTRAINT product_variants_management_mode_check 
        CHECK (management_mode IN ('standard', 'pack_based', 'amount_based'));
    END IF;
END $$;

-- 2. Create product_batches table for batch-specific costing (e.g. Cooking Oil)
CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    containers_count NUMERIC(15, 4) DEFAULT NULL,
    capacity_per_container NUMERIC(15, 4) DEFAULT NULL,
    total_initial_quantity NUMERIC(15, 4) NOT NULL CHECK (total_initial_quantity > 0),
    quantity_sold NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity_sold >= 0),
    remaining_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (remaining_quantity >= 0),
    total_purchase_cost NUMERIC(15, 4) NOT NULL CHECK (total_purchase_cost >= 0),
    cost_currency VARCHAR(10) NOT NULL DEFAULT '$',
    cost_per_unit NUMERIC(15, 4) NOT NULL CHECK (cost_per_unit >= 0),
    total_revenue NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    physical_remaining_quantity NUMERIC(15, 4) DEFAULT NULL,
    variance_quantity NUMERIC(15, 4) DEFAULT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reconciled', 'closed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- High-performance indexes for product_batches
CREATE INDEX IF NOT EXISTS idx_product_batches_variant_id ON product_batches(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_status ON product_batches(status);
CREATE INDEX IF NOT EXISTS idx_product_batches_received_date ON product_batches(received_date DESC);
CREATE INDEX IF NOT EXISTS idx_product_batches_shop_id ON product_batches(shop_id);

-- Enable RLS for product_batches
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read product_batches" ON product_batches;
CREATE POLICY "Allow read product_batches" ON product_batches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write product_batches" ON product_batches;
CREATE POLICY "Allow write product_batches" ON product_batches FOR ALL USING (true);

-- 3. Add actual_quantity_used, batch_id, and selling_option_label to sale_items
ALTER TABLE IF EXISTS sale_items 
ADD COLUMN IF NOT EXISTS actual_quantity_used NUMERIC(15, 4) DEFAULT NULL;

ALTER TABLE IF EXISTS sale_items 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS sale_items 
ADD COLUMN IF NOT EXISTS selling_option_label VARCHAR(100) DEFAULT NULL;

ALTER TABLE IF EXISTS sale_items 
ADD COLUMN IF NOT EXISTS selling_method VARCHAR(20) DEFAULT NULL;

-- Index for sale_items batch attribution
CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id ON sale_items(batch_id);

-- 4. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
