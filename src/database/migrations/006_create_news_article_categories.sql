
CREATE TABLE news_article_categories (
    article_id UUID NOT NULL,
    category_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_news_article_categories
        PRIMARY KEY (article_id, category_id),

    CONSTRAINT fk_article_category_article
        FOREIGN KEY (article_id)
        REFERENCES news_articles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_article_category_category
        FOREIGN KEY (category_id)
        REFERENCES news_categories(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_news_article_categories_category
    ON news_article_categories(category_id);
