CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'blocked')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic = TRUE)
);

CREATE TABLE IF NOT EXISTS accounts (
  account_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  currency CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  balance_minor BIGINT NOT NULL CHECK (balance_minor >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'frozen', 'closed')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic = TRUE)
);

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'posted', 'failed', 'reversed')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic = TRUE)
);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(transaction_id),
  account_id TEXT NOT NULL REFERENCES accounts(account_id),
  status TEXT NOT NULL CHECK (status IN ('issued', 'voided')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic = TRUE)
);

CREATE TABLE IF NOT EXISTS tickets (
  ticket_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic = TRUE)
);

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_accounts_customer_id ON accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_receipts_account_id ON receipts(account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id);
