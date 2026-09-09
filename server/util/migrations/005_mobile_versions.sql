-- Strong per-record revisions also advance for writes from older web clients
-- and recurring workers. They must not repeat after same-clock-tick updates.
CREATE FUNCTION fintrack_advance_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_update := GREATEST(clock_timestamp(), OLD.last_update + interval '1 microsecond');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION fintrack_advance_revision() FROM PUBLIC;
CREATE TRIGGER financial_accounts_revision BEFORE UPDATE ON financial_accounts
FOR EACH ROW EXECUTE FUNCTION fintrack_advance_revision();
CREATE TRIGGER categories_revision BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION fintrack_advance_revision();
CREATE TRIGGER transactions_revision BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION fintrack_advance_revision();
CREATE TRIGGER subscriptions_revision BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION fintrack_advance_revision();
