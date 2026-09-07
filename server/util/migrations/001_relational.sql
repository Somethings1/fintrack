CREATE TABLE ledger_settings (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    money_version integer NOT NULL CHECK (money_version = 1)
);

CREATE TABLE financial_accounts (
    id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
    owner text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('account','saving')),
    currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    opening_balance_micros bigint NOT NULL CHECK (opening_balance_micros BETWEEN -1000000000000000000 AND 1000000000000000000),
    balance_micros bigint NOT NULL CHECK (balance_micros BETWEEN -1000000000000000000 AND 1000000000000000000),
    icon text NOT NULL DEFAULT '',
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    goal_micros bigint NOT NULL DEFAULT 0 CHECK (goal_micros BETWEEN 0 AND 1000000000000000000),
    created_date timestamptz,
    goal_date timestamptz,
    last_update timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    UNIQUE (owner,id,currency)
);

CREATE INDEX financial_accounts_sync_idx ON financial_accounts(owner,kind,last_update,id);

CREATE TABLE categories (
    id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
    owner text NOT NULL,
    currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    type text NOT NULL CHECK (type IN ('income','expense')),
    icon text NOT NULL DEFAULT '',
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    budget_micros bigint NOT NULL DEFAULT 0 CHECK (budget_micros BETWEEN 0 AND 1000000000000000000),
    last_update timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    UNIQUE (owner,id,currency),
    UNIQUE (owner,id,currency,type)
);

CREATE INDEX categories_sync_idx ON categories(owner,last_update,id);

CREATE TABLE subscriptions (
    id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
    creator text NOT NULL,
    currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    schedule_version integer NOT NULL DEFAULT 2 CHECK (schedule_version = 2),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    icon text NOT NULL DEFAULT '',
    amount_micros bigint NOT NULL CHECK (amount_micros > 0 AND amount_micros <= 1000000000000000000),
    source_account_id text NOT NULL,
    category_id text NOT NULL,
    start_date timestamptz NOT NULL,
    interval_unit text NOT NULL CHECK (interval_unit IN ('day','week','month','year')),
    max_interval integer NOT NULL DEFAULT 0 CHECK (max_interval BETWEEN 0 AND 100000),
    current_interval integer NOT NULL DEFAULT 0 CHECK (current_interval BETWEEN 0 AND 100000),
    is_active boolean NOT NULL DEFAULT true,
    remind_before integer NOT NULL DEFAULT 0 CHECK (remind_before BETWEEN 0 AND 366),
    next_active timestamptz NOT NULL,
    notify_at timestamptz,
    posting_retry_at timestamptz,
    reminder_retry_at timestamptz,
    last_update timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    FOREIGN KEY (creator,source_account_id,currency) REFERENCES financial_accounts(owner,id,currency) ON DELETE RESTRICT,
    FOREIGN KEY (creator,category_id,currency) REFERENCES categories(owner,id,currency) ON DELETE RESTRICT
);

CREATE INDEX subscriptions_sync_idx ON subscriptions(creator,last_update,id);
CREATE INDEX subscriptions_due_idx ON subscriptions(currency,next_active,id) WHERE schedule_version=2 AND is_active AND NOT is_deleted;
CREATE INDEX subscriptions_notify_idx ON subscriptions(currency,notify_at,id) WHERE schedule_version=2 AND is_active AND NOT is_deleted AND notify_at IS NOT NULL;

CREATE TABLE transactions (
    id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
    creator text NOT NULL,
    currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    amount_micros bigint NOT NULL CHECK (amount_micros > 0 AND amount_micros <= 1000000000000000000),
    date_time timestamptz NOT NULL,
    type text NOT NULL CHECK (type IN ('income','expense','transfer')),
    source_account_id text,
    destination_account_id text,
    category_id text,
    note text NOT NULL DEFAULT '' CHECK (octet_length(note) <= 500),
    request_key text,
    request_hash text,
    subscription_id text REFERENCES subscriptions(id) ON DELETE RESTRICT,
    occurrence_at timestamptz,
    last_update timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    FOREIGN KEY (creator,source_account_id,currency) REFERENCES financial_accounts(owner,id,currency) ON DELETE RESTRICT,
    FOREIGN KEY (creator,destination_account_id,currency) REFERENCES financial_accounts(owner,id,currency) ON DELETE RESTRICT,
    FOREIGN KEY (creator,category_id,currency,type) REFERENCES categories(owner,id,currency,type) ON DELETE RESTRICT,
    CHECK (
        (type='income' AND source_account_id IS NULL AND destination_account_id IS NOT NULL AND category_id IS NOT NULL) OR
        (type='expense' AND source_account_id IS NOT NULL AND destination_account_id IS NULL AND category_id IS NOT NULL) OR
        (type='transfer' AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND source_account_id<>destination_account_id AND category_id IS NULL)
    ),
    CHECK ((subscription_id IS NULL AND occurrence_at IS NULL) OR (subscription_id IS NOT NULL AND occurrence_at IS NOT NULL))
);

CREATE UNIQUE INDEX transactions_request_key_idx ON transactions(creator,request_key) WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX transactions_occurrence_idx ON transactions(subscription_id,occurrence_at) WHERE subscription_id IS NOT NULL;
CREATE INDEX transactions_sync_idx ON transactions(creator,last_update,id);
CREATE INDEX transactions_category_idx ON transactions(creator,category_id) WHERE NOT is_deleted;
CREATE INDEX transactions_source_idx ON transactions(creator,source_account_id) WHERE NOT is_deleted;
CREATE INDEX transactions_destination_idx ON transactions(creator,destination_account_id) WHERE NOT is_deleted;

CREATE TABLE notifications (
    id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{24}$'),
    owner text NOT NULL,
    type text NOT NULL,
    reference_id text NOT NULL CHECK (reference_id ~ '^[0-9a-f]{24}$'),
    title text NOT NULL DEFAULT '',
    message text NOT NULL DEFAULT '',
    read boolean NOT NULL DEFAULT false,
    scheduled_at timestamptz NOT NULL,
    occurrence_key text,
    last_update timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX notifications_occurrence_idx ON notifications(owner,occurrence_key) WHERE occurrence_key IS NOT NULL;
CREATE INDEX notifications_sync_idx ON notifications(owner,last_update,id);
