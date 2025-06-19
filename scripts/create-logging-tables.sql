-- Create logging table for intelligent analysis
CREATE TABLE IF NOT EXISTS intelligent_analysis_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    analysis_data JSONB,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_intelligent_analysis_logs_session_id ON intelligent_analysis_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_analysis_logs_timestamp ON intelligent_analysis_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_intelligent_analysis_logs_event_type ON intelligent_analysis_logs(event_type);

-- Create function for similarity search (if not exists)
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(1408),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5,
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
    similarity float
)
LANGUAGE plpgsql
AS $$
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
        1 - (rd.image_embedding <=> query_embedding) as similarity
    FROM rag_documents rd
    WHERE rd.is_active = true
        AND rd.image_embedding IS NOT NULL
        AND (filter_category IS NULL OR rd.category = filter_category)
        AND 1 - (rd.image_embedding <=> query_embedding) > match_threshold
    ORDER BY rd.image_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
