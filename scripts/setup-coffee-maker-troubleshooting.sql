-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the table for coffee maker RAG documents with image embeddings
CREATE TABLE IF NOT EXISTS coffee_maker_rag_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  icon_name TEXT NOT NULL,
  icon_description TEXT,
  content TEXT NOT NULL, -- Troubleshooting solution text
  image_embedding VECTOR(1408), -- For Google's multimodal embedding model
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster similarity searches on image_embedding
-- Using HNSW index, which is generally good for high-dimensional vectors
-- Ensure you have sufficient maintenance_work_mem for index creation
CREATE INDEX IF NOT EXISTS idx_coffee_maker_image_embedding
ON coffee_maker_rag_documents
USING hnsw (image_embedding vector_cosine_ops);
-- Alternatively, for IVFFlat:
-- CREATE INDEX ON coffee_maker_rag_documents USING ivfflat (image_embedding vector_cosine_ops)
-- WITH (lists = 100); -- Adjust 'lists' based on your dataset size

-- Create a function for similarity search
CREATE OR REPLACE FUNCTION match_coffee_maker_icons (
  query_embedding VECTOR(1408),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  icon_name TEXT,
  icon_description TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    cmrd.id,
    cmrd.icon_name,
    cmrd.icon_description,
    cmrd.content,
    1 - (cmrd.image_embedding <=> query_embedding) AS similarity
  FROM
    coffee_maker_rag_documents cmrd
  WHERE 1 - (cmrd.image_embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
$$;

-- Insert some sample data (replace with actual icon embeddings and content)
-- Note: Generating actual 1408-dim embeddings requires calling the Google API.
-- These are placeholder zeros.
INSERT INTO coffee_maker_rag_documents (icon_name, icon_description, content, image_embedding) VALUES
('water_tank_empty_light', 'Red blinking water drop icon', 'The water tank is empty or not properly attached. Please fill the water tank with fresh water and ensure it is correctly and firmly attached to the coffee maker.', array_fill(0, ARRAY[1408])::vector),
('descale_light', 'Orange blinking icon with "CALC" or steam symbol', 'The coffee maker needs descaling. Please follow the descaling procedure described in your user manual using a suitable descaling solution.', array_fill(0, ARRAY[1408])::vector),
('beans_empty_light', 'Red blinking coffee bean icon', 'The coffee bean hopper is empty. Please refill the hopper with fresh coffee beans.', array_fill(0, ARRAY[1408])::vector),
('grounds_container_full_light', 'Red solid icon of a container or trash bin', 'The coffee grounds container is full or not inserted correctly. Please empty the grounds container and re-insert it properly.', array_fill(0, ARRAY[1408])::vector)
ON CONFLICT (icon_name) DO NOTHING;

-- Function to update updated_at timestamp (if not already present from other scripts)
CREATE OR REPLACE FUNCTION update_coffee_maker_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coffee_maker_rag_documents_updated_at
BEFORE UPDATE ON coffee_maker_rag_documents
FOR EACH ROW EXECUTE FUNCTION update_coffee_maker_updated_at_column();
