
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Article information
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(550) NOT NULL,
    summary TEXT,
    content TEXT,

    -- Media
    featured_image TEXT,

    -- Source attribution
    source_id UUID REFERENCES news_sources(id)
        ON DELETE SET NULL,

    original_url TEXT,

    -- Users responsible for the article
    author_id UUID REFERENCES users(id)
        ON DELETE SET NULL,

    editor_id UUID REFERENCES users(id)
        ON DELETE SET NULL,

    -- Editorial classification
    article_type VARCHAR(30) NOT NULL DEFAULT 'news',

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    -- Publishing information
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_news_articles_slug UNIQUE (slug),

    CONSTRAINT chk_news_article_type
        CHECK (
            article_type IN (
                'news',
                'opinion',
                'analysis',
                'press_release'
            )
        ),

    CONSTRAINT chk_news_article_status
        CHECK (
            status IN (
                'draft',
                'pending_review',
                'published',
                'rejected',
                'archived'
            )
        ),

    CONSTRAINT chk_published_article_date
        CHECK (
            status <> 'published'
            OR published_at IS NOT NULL
        )
);

-- Frequently queried fields
CREATE INDEX idx_news_articles_status
    ON news_articles(status);

CREATE INDEX idx_news_articles_published_at
    ON news_articles(published_at DESC);

CREATE INDEX idx_news_articles_source
    ON news_articles(source_id);

CREATE INDEX idx_news_articles_author
    ON news_articles(author_id);

CREATE INDEX idx_news_articles_editor
    ON news_articles(editor_id);

CREATE INDEX idx_news_articles_type
    ON news_articles(article_type);

-- Combined index for the public news feed
CREATE INDEX idx_news_articles_public_feed
    ON news_articles(published_at DESC)
    WHERE status = 'published';
