CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('technical','account','billing','gameplay','report')),
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created
  ON support_tickets(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority
  ON support_tickets(status,priority,created_at);
