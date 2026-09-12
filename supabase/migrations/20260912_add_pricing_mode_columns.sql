-- ====================================================================
-- MIGRATION: Add Pricing Mode & SOS Price to Product Variants
-- Safe & Non-Destructive: Preserves all existing products, variants, and stock
-- ====================================================================

-- 1. Add pricing_mode column if not exists (Default: 'fixed')
ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) NOT NULL DEFAULT 'fixed';

-- 2. Add sos_price column if not exists
ALTER TABLE IF EXISTS product_variants 
ADD COLUMN IF NOT EXISTS sos_price NUMERIC(15, 2) DEFAULT NULL;

-- 3. Add check constraints if they do not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_pricing_mode_check'
    ) THEN
        ALTER TABLE product_variants ADD CONSTRAINT product_variants_pricing_mode_check CHECK (pricing_mode IN ('fixed', 'denomination'));
    END IF;
END $$;

-- 4. Ensure all existing records default to 'fixed'
UPDATE product_variants SET pricing_mode = 'fixed' WHERE pricing_mode IS NULL;

-- 5. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
