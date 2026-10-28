BEGIN;

ALTER TABLE store_transactions ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE store_transactions ADD COLUMN IF NOT EXISTS balance_after INTEGER;
ALTER TABLE store_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

UPDATE store_transactions SET direction=CASE WHEN points_amount>0 THEN 'debit' ELSE 'credit' END WHERE direction IS NULL;
ALTER TABLE store_transactions ALTER COLUMN direction SET DEFAULT 'debit';
ALTER TABLE store_transactions ALTER COLUMN direction SET NOT NULL;
ALTER TABLE store_transactions DROP CONSTRAINT IF EXISTS store_transactions_direction_check;
ALTER TABLE store_transactions ADD CONSTRAINT store_transactions_direction_check CHECK(direction IN('credit','debit'));
ALTER TABLE store_transactions DROP CONSTRAINT IF EXISTS store_transactions_balance_after_check;
ALTER TABLE store_transactions ADD CONSTRAINT store_transactions_balance_after_check CHECK(balance_after IS NULL OR balance_after>=0);
CREATE UNIQUE INDEX IF NOT EXISTS store_transactions_user_idempotency
  ON store_transactions(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS vip_membership_history(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN('points','provider','admin','expired')),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  store_transaction_id UUID REFERENCES store_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(expires_at>starts_at)
);
CREATE INDEX IF NOT EXISTS vip_membership_history_user_created ON vip_membership_history(user_id,created_at DESC,id DESC);

COMMIT;
