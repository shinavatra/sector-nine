-- Runtime Store products. Badges remain in their existing achievement catalog
-- and are intentionally not represented in this purchasable catalog.

CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  product_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_points INTEGER,
  price_eur_cents INTEGER,
  billing_period TEXT,
  vip_only BOOLEAN NOT NULL DEFAULT false,
  featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_products_type_check CHECK (product_type IN ('vip','cosmetic')),
  CONSTRAINT store_products_name_length CHECK (char_length(name) BETWEEN 1 AND 160),
  CONSTRAINT store_products_points_nonnegative CHECK (price_points IS NULL OR price_points >= 0),
  CONSTRAINT store_products_eur_nonnegative CHECK (price_eur_cents IS NULL OR price_eur_cents >= 0),
  CONSTRAINT store_products_has_price CHECK (price_points IS NOT NULL OR price_eur_cents IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_store_products_public
  ON store_products(featured DESC, created_at DESC)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_store_products_updated_at ON store_products;
CREATE TRIGGER trg_store_products_updated_at
  BEFORE UPDATE ON store_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO store_products(
  id,product_type,name,description,price_points,price_eur_cents,
  billing_period,featured,is_active,metadata
) VALUES (
  'vip-monthly',
  'vip',
  'VIP Subscription',
  'Monthly premium platform access',
  5000,
  500,
  'month',
  true,
  true,
  '{
    "benefits": [
      "Tournament access",
      "Priority matchmaking",
      "1000 bonus points",
      "+50 XP per win",
      "Premium support"
    ]
  }'::jsonb
)
ON CONFLICT(id) DO NOTHING;

