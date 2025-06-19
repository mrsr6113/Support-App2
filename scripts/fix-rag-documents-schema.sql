-- Fix RAG documents table schema and add missing functions

-- Ensure the image_embedding column exists with correct type
DO $$ 
BEGIN
    -- Check if image_embedding column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rag_documents' 
        AND column_name = 'image_embedding'
    ) THEN
        ALTER TABLE rag_documents ADD COLUMN image_embedding vector(1408);
        RAISE NOTICE 'Added image_embedding column';
    END IF;
END $$;

-- Create or replace the search_similar_issues function
CREATE OR REPLACE FUNCTION search_similar_issues(
    query_embedding vector(1408),
    category_filter text DEFAULT NULL,
    issue_type_filter text DEFAULT NULL,
    severity_filter text DEFAULT NULL,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    icon_name text,
    icon_description text,
    category text,
    tags text[],
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rd.id,
        rd.title,
        rd.content,
        rd.icon_name,
        rd.icon_description,
        rd.category,
        rd.tags,
        (1 - (rd.image_embedding <=> query_embedding)) as similarity
    FROM rag_documents rd
    WHERE 
        rd.is_active = true
        AND rd.image_embedding IS NOT NULL
        AND (category_filter IS NULL OR rd.category = category_filter)
        AND (1 - (rd.image_embedding <=> query_embedding)) >= match_threshold
    ORDER BY rd.image_embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Create statistics function
CREATE OR REPLACE FUNCTION get_rag_statistics()
RETURNS TABLE (
    total_documents bigint,
    documents_with_embeddings bigint,
    documents_without_embeddings bigint,
    categories_count bigint,
    avg_content_length numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_documents,
        COUNT(image_embedding) as documents_with_embeddings,
        COUNT(*) - COUNT(image_embedding) as documents_without_embeddings,
        COUNT(DISTINCT category) as categories_count,
        AVG(LENGTH(content)) as avg_content_length
    FROM rag_documents
    WHERE is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Create function to update embeddings for existing documents
CREATE OR REPLACE FUNCTION update_missing_embeddings()
RETURNS TABLE (
    document_id uuid,
    title text,
    needs_embedding boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rd.id as document_id,
        rd.title,
        (rd.image_embedding IS NULL) as needs_embedding
    FROM rag_documents rd
    WHERE rd.is_active = true
    ORDER BY rd.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding ON rag_documents USING ivfflat (image_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_documents_category ON rag_documents(category);
CREATE INDEX IF NOT EXISTS idx_rag_documents_active ON rag_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_documents(created_at);

-- Update existing NULL embeddings with a placeholder (optional)
-- This helps identify which documents need re-processing
UPDATE rag_documents 
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"needs_embedding": true}'::jsonb
WHERE image_embedding IS NULL AND is_active = true;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_similar_issues TO service_role;
GRANT EXECUTE ON FUNCTION get_rag_statistics TO service_role;
GRANT EXECUTE ON FUNCTION update_missing_embeddings TO service_role;
