-- ====================================================================
-- MIGRATION: 20260913_resend_and_signatures.sql
-- Resend Email Alerts, Deduplication Log & Shop/Profile Signatures
-- Idempotent & Non-Destructive
-- ====================================================================

-- 1. Add signature_url column to shops if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shops' AND column_name = 'signature_url'
    ) THEN
        ALTER TABLE shops ADD COLUMN signature_url TEXT;
    END IF;
END $$;

-- 2. Add signature_url column to profiles if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'signature_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN signature_url TEXT;
    END IF;
END $$;

-- 3. Create sent_email_alerts table for alert logging & spam prevention
CREATE TABLE IF NOT EXISTS sent_email_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'out_of_stock', 'debt_reminder', 'test'
    recipient_email VARCHAR(255) NOT NULL,
    entity_id VARCHAR(255), -- variant_id, debt_id, or test_id
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for rapid deduplication checks (alert_type + entity_id in recent window)
CREATE INDEX IF NOT EXISTS idx_sent_email_alerts_dedup 
ON sent_email_alerts(alert_type, entity_id, created_at DESC);

-- Enable RLS on sent_email_alerts
ALTER TABLE sent_email_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read sent_email_alerts" ON sent_email_alerts;
CREATE POLICY "Allow read sent_email_alerts" ON sent_email_alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write sent_email_alerts" ON sent_email_alerts;
CREATE POLICY "Allow write sent_email_alerts" ON sent_email_alerts FOR ALL USING (true);
