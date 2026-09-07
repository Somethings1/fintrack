-- Financial writes belong to the authenticated Go API, not Supabase REST.
-- SQL-created tables do not automatically get RLS. Older Supabase projects can
-- have default browser-role grants, so revoke them explicitly as well.
DO $$
DECLARE
    table_name text;
    browser_role text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['financial_accounts','categories','subscriptions','transactions','notifications','ledger_settings','schema_migrations'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
        FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
                EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', table_name, browser_role);
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Deny cross-tenant recurring references at the database layer too.
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tenant_key UNIQUE (creator,id,currency);
ALTER TABLE transactions ADD CONSTRAINT transactions_subscription_tenant_fk
    FOREIGN KEY (creator,subscription_id,currency) REFERENCES subscriptions(creator,id,currency) ON DELETE RESTRICT;
ALTER TABLE subscriptions ADD COLUMN category_type text NOT NULL DEFAULT 'expense' CHECK (category_type = 'expense');
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_expense_category_fk
    FOREIGN KEY (creator,category_id,currency,category_type) REFERENCES categories(owner,id,currency,type) ON DELETE RESTRICT;
