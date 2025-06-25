-- 日本語の全文検索に対応したインデックスを作成
CREATE INDEX IF NOT EXISTS rag_documents_fts_idx 
ON rag_documents 
USING GIN (to_tsvector('japanese', title || ' ' || content || ' ' || array_to_string(tags, ' ')));

-- ハイブリッド検索用の新しい関数を作成
CREATE OR REPLACE FUNCTION search_hybrid_documents(
    query_embedding vector(1408),
    query_text text,
    match_threshold float,
    match_count int,
    vector_weight float DEFAULT 0.5, -- ベクトル検索の重み
    text_weight float DEFAULT 0.5 -- テキスト検索の重み
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    category text,
    tags text[],
    icon_name text,
    icon_description text,
    combined_score double precision
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        -- 画像のベクトルで類似度が高いものを検索
        SELECT
            rd.id,
            (1 - (rd.image_embedding <=> query_embedding)) * vector_weight AS score
        FROM rag_documents rd
        WHERE rd.image_embedding IS NOT NULL 
          AND rd.is_active = true
          AND (1 - (rd.image_embedding <=> query_embedding)) > match_threshold
        ORDER BY score DESC
        LIMIT match_count * 2
    ),
    full_text_search AS (
        -- 抽出したキーワードでtitle, content, tagsを全文検索
        SELECT
            rd.id,
            ts_rank(
                to_tsvector('japanese', rd.title || ' ' || rd.content || ' ' || array_to_string(rd.tags, ' ')),
                websearch_to_tsquery('japanese', query_text)
            ) * text_weight AS score
        FROM rag_documents rd
        WHERE rd.is_active = true 
          AND query_text != ''
          AND websearch_to_tsquery('japanese', query_text) @@ to_tsvector('japanese', rd.title || ' ' || rd.content || ' ' || array_to_string(rd.tags, ' '))
        ORDER BY score DESC
        LIMIT match_count * 2
    ),
    combined_results AS (
        -- 両方の検索結果を統合し、IDごとにスコアを合算
        SELECT id, SUM(score) as total_score
        FROM (
            SELECT id, score FROM vector_search
            UNION ALL
            SELECT id, score FROM full_text_search
        ) AS all_searches
        GROUP BY id
    )
    -- 最終的なドキュメント情報と結合して返す
    SELECT
        rd.id,
        rd.title,
        rd.content,
        rd.category,
        rd.tags,
        rd.icon_name,
        rd.icon_description,
        cr.total_score as combined_score
    FROM rag_documents rd
    JOIN combined_results cr ON rd.id = cr.id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 既存の検索関数も改善（フォールバック用）
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(1408),
    match_threshold float,
    match_count int,
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    category text,
    tags text[],
    icon_name text,
    icon_description text,
    similarity double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rd.id,
        rd.title,
        rd.content,
        rd.category,
        rd.tags,
        rd.icon_name,
        rd.icon_description,
        (1 - (rd.image_embedding <=> query_embedding)) as similarity
    FROM rag_documents rd
    WHERE rd.image_embedding IS NOT NULL
      AND rd.is_active = true
      AND (1 - (rd.image_embedding <=> query_embedding)) > match_threshold
      AND (filter_category IS NULL OR rd.category = filter_category)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
