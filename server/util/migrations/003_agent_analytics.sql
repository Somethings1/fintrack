-- Tenant/currency/date access path for the assistant's fixed spending query.
-- Applied by the existing migration runner; no new data or privileges.
CREATE INDEX transactions_agent_period_idx
ON transactions(creator,currency,date_time,category_id)
WHERE NOT is_deleted AND type IN ('income','expense');
