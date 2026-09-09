-- Operational usage counters only: no prompts, answers, arguments, financial
-- amounts, record IDs, proposal payloads, provider errors or credentials.
CREATE TABLE agent_usage (
    run_id uuid PRIMARY KEY,
    owner text NOT NULL,
    mode text NOT NULL CHECK (mode IN ('chat','draft')),
    model text NOT NULL CHECK (length(model) <= 100),
    outcome text NOT NULL,
    provider_calls bigint NOT NULL CHECK (provider_calls > 0),
    unknown_usage_calls bigint NOT NULL CHECK (unknown_usage_calls >= 0),
    unpriced_calls bigint NOT NULL CHECK (unpriced_calls >= 0),
    prompt_tokens bigint NOT NULL CHECK (prompt_tokens >= 0),
    cached_tokens bigint NOT NULL CHECK (cached_tokens >= 0),
    output_tokens bigint NOT NULL CHECK (output_tokens >= 0),
    thinking_tokens bigint NOT NULL CHECK (thinking_tokens >= 0),
    total_tokens bigint NOT NULL CHECK (total_tokens >= 0),
    estimated_cost_nano_usd bigint NOT NULL CHECK (estimated_cost_nano_usd >= 0),
    input_price_micro_usd bigint NOT NULL,
    cached_price_micro_usd bigint NOT NULL,
    output_price_micro_usd bigint NOT NULL,
    duration_ms bigint NOT NULL CHECK (duration_ms >= 0),
    recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_usage_owner_time_idx ON agent_usage(owner,recorded_at);
CREATE INDEX agent_usage_retention_idx ON agent_usage(recorded_at);
ALTER TABLE agent_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agent_usage FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
        REVOKE ALL ON agent_usage FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
        REVOKE ALL ON agent_usage FROM authenticated;
    END IF;
END $$;
