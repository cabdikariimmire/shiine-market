-- ====================================================================
-- MIGRATION: Add Fractional Units & Minimum Sellable Qty to Product Variants
-- Safe & Non-Destructive: Preserves all existing products, variants, and stock
-- ====================================================================

-- 1. Add unit_division column if not exists (Default: 1.0000)
ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS unit_division NUMERIC(15, 4) NOT NULL DEFAULT 1.0000;

-- 2. Add min_sellable_qty column if not exists (Default: 1.0000)
ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS min_sellable_qty NUMERIC(15, 4) NOT NULL DEFAULT 1.0000;

-- 3. Add check constraints if they do not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_unit_division_check'
    ) THEN
        ALTER TABLE product_variants ADD CONSTRAINT product_variants_unit_division_check CHECK (unit_division > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_min_sellable_qty_check'
    ) THEN
        ALTER TABLE product_variants ADD CONSTRAINT product_variants_min_sellable_qty_check CHECK (min_sellable_qty > 0);
    END IF;
END $$;

-- 4. Update any existing NULL records to default 1.0000
UPDATE product_variants SET unit_division = 1.0000 WHERE unit_division IS NULL;
UPDATE product_variants SET min_sellable_qty = 1.0000 WHERE min_sellable_qty IS NULL;

-- 5. Reload PostgREST Schema Cache so frontend immediately recognizes the columns
NOTIFY pgrst, 'reload schema';
