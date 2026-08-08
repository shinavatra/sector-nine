-- PostgreSQL-backed platform news and a future-ready comments foundation.

CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  comments_enabled BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_articles_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT news_articles_summary_length CHECK (char_length(summary) <= 500),
  CONSTRAINT news_articles_content_length CHECK (char_length(content) BETWEEN 1 AND 50000),
  CONSTRAINT news_articles_category_length CHECK (char_length(category) BETWEEN 1 AND 50),
  CONSTRAINT news_articles_publication_date CHECK (
    (is_published AND published_at IS NOT NULL) OR
    (NOT is_published AND published_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_news_articles_public_feed
  ON news_articles(is_pinned DESC, published_at DESC, id DESC)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_news_articles_category_published
  ON news_articles(category, published_at DESC)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_news_articles_search
  ON news_articles USING GIN (
    to_tsvector('simple', title || ' ' || summary || ' ' || content)
  );

CREATE TABLE IF NOT EXISTS news_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES news_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_comments_content_length CHECK (char_length(content) BETWEEN 1 AND 5000)
);

CREATE INDEX IF NOT EXISTS idx_news_comments_article_created
  ON news_comments(article_id, created_at, id)
  WHERE is_deleted = false;

DROP TRIGGER IF EXISTS trg_news_articles_updated_at ON news_articles;
CREATE TRIGGER trg_news_articles_updated_at
  BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_news_comments_updated_at ON news_comments;
CREATE TRIGGER trg_news_comments_updated_at
  BEFORE UPDATE ON news_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
