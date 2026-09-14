-- ====================================================================
-- MIGRATION: Email recipients & role-based alert support
-- ====================================================================

-- 1. Ensure email column exists on profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email VARCHAR(255);
    END IF;
END $$;

-- 2. Ensure sent_email_alerts table exists with proper indexes
CREATE TABLE IF NOT EXISTS sent_email_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT,
    status VARCHAR(50) DEFAULT 'sent',
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast 24-hour deduplication queries
CREATE INDEX IF NOT EXISTS idx_sent_email_alerts_dedup 
ON sent_email_alerts(entity_id, alert_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sent_email_alerts_recipient 
ON sent_email_alerts(shop_id, recipient_email, created_at DESC);

-- Enable RLS
ALTER TABLE sent_email_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read shop alerts" ON sent_email_alerts;
CREATE POLICY "Users can read shop alerts"
ON sent_email_alerts
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service can insert shop alerts" ON sent_email_alerts;
CREATE POLICY "Service can insert shop alerts"
ON sent_email_alerts
FOR INSERT
WITH CHECK (true);
