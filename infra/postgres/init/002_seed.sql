INSERT INTO customers (
  customer_id, display_name, status, version, created_at, updated_at, synthetic
) VALUES (
  'CUST-1001', 'Synthetic Customer 1001', 'active', 1,
  '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z', TRUE
)
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO accounts (
  account_id, customer_id, currency, balance_minor, status, version,
  created_at, updated_at, synthetic
) VALUES (
  'ACC-1001', 'CUST-1001', 'USD', 125000, 'active', 1,
  '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z', TRUE
)
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO transactions (
  transaction_id, account_id, type, amount_minor, currency, status, version,
  created_at, updated_at, synthetic
) VALUES
  ('TX-1001', 'ACC-1001', 'credit', 1000, 'USD', 'posted', 1, '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z', TRUE),
  ('TX-1002', 'ACC-1001', 'debit', 2000, 'USD', 'posted', 1, '2026-08-22T00:01:00Z', '2026-08-22T00:01:00Z', TRUE),
  ('TX-1003', 'ACC-1001', 'credit', 3000, 'USD', 'posted', 1, '2026-08-22T00:02:00Z', '2026-08-22T00:02:00Z', TRUE),
  ('TX-1004', 'ACC-1001', 'debit', 4000, 'USD', 'posted', 1, '2026-08-22T00:03:00Z', '2026-08-22T00:03:00Z', TRUE),
  ('TX-1005', 'ACC-1001', 'credit', 5000, 'USD', 'posted', 1, '2026-08-22T00:04:00Z', '2026-08-22T00:04:00Z', TRUE),
  ('TX-1006', 'ACC-1001', 'debit', 6000, 'USD', 'posted', 1, '2026-08-22T00:05:00Z', '2026-08-22T00:05:00Z', TRUE),
  ('TX-1007', 'ACC-1001', 'credit', 7000, 'USD', 'posted', 1, '2026-08-22T00:06:00Z', '2026-08-22T00:06:00Z', TRUE),
  ('TX-1008', 'ACC-1001', 'debit', 8000, 'USD', 'posted', 1, '2026-08-22T00:07:00Z', '2026-08-22T00:07:00Z', TRUE),
  ('TX-1009', 'ACC-1001', 'credit', 9000, 'USD', 'posted', 1, '2026-08-22T00:08:00Z', '2026-08-22T00:08:00Z', TRUE),
  ('TX-1010', 'ACC-1001', 'debit', 10000, 'USD', 'posted', 1, '2026-08-22T00:09:00Z', '2026-08-22T00:09:00Z', TRUE),
  ('TX-1011', 'ACC-1001', 'credit', 11000, 'USD', 'posted', 1, '2026-08-22T00:10:00Z', '2026-08-22T00:10:00Z', TRUE),
  ('TX-1012', 'ACC-1001', 'debit', 12000, 'USD', 'posted', 1, '2026-08-22T00:11:00Z', '2026-08-22T00:11:00Z', TRUE)
ON CONFLICT (transaction_id) DO NOTHING;

INSERT INTO receipts (
  receipt_id, transaction_id, account_id, status, version,
  created_at, updated_at, synthetic
) VALUES
  ('REC-1001', 'TX-1001', 'ACC-1001', 'issued', 1, '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z', TRUE),
  ('REC-1002', 'TX-1002', 'ACC-1001', 'issued', 1, '2026-08-22T00:01:00Z', '2026-08-22T00:01:00Z', TRUE)
ON CONFLICT (receipt_id) DO NOTHING;

INSERT INTO tickets (
  ticket_id, customer_id, status, category, version,
  created_at, updated_at, synthetic
) VALUES (
  'TKT-1001', 'CUST-1001', 'open', 'account_support', 1,
  '2026-08-22T00:00:00Z', '2026-08-22T00:00:00Z', TRUE
)
ON CONFLICT (ticket_id) DO NOTHING;
