-- ====================================================================
-- MIGRATION: Add 'seller' staff role to profiles table check constraint
-- ====================================================================

DO $$ 
BEGIN
    -- Update role check constraint to include 'seller'
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'reporter', 'seller', 'cashier', 'manager'));
EXCEPTION
    WHEN OTHERS THEN 
        RAISE NOTICE 'Constraint update skipped or not applicable: %', SQLERRM;
END $$;
