BEGIN;

CREATE TABLE IF NOT EXISTS store_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('vip', 'frame', 'cosmetic', 'theme')),
  item_name TEXT NOT NULL,
  points_amount INTEGER NOT NULL DEFAULT 0 CHECK (points_amount >= 0),
  euro_amount_cents INTEGER CHECK (euro_amount_cents IS NULL OR euro_amount_cents >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('points', 'provider', 'admin')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_transactions_user_created
  ON store_transactions(user_id, created_at DESC, id DESC);

COMMIT;
