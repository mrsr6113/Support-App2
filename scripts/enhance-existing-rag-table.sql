-- Enhance existing rag_documents table for multimodal RAG system
-- This script adds necessary columns without recreating the table or losing existing data

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new columns to existing rag_documents table if they don't exist
DO $$ 
BEGIN
    -- Add icon_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rag_documents' AND column_name = 'icon_name') THEN
        ALTER TABLE rag_documents ADD COLUMN icon_name TEXT;
    END IF;
    
    -- Add icon_description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rag_documents' AND column_name = 'icon_description') THEN
        ALTER TABLE rag_documents ADD COLUMN icon_description TEXT;
    END IF;
    
    -- Add image_embedding column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rag_documents' AND column_name = 'image_embedding') THEN
        ALTER TABLE rag_documents ADD COLUMN image_embedding VECTOR(1408);
    END IF;
    
    -- Add product_type column if it doesn't exist (for categorization)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rag_documents' AND column_name = 'product_type') THEN
        ALTER TABLE rag_documents ADD COLUMN product_type TEXT DEFAULT 'general';
    END IF;
    
    -- Add severity_level column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rag_documents' AND column_name = 'severity_level') THEN
        ALTER TABLE rag_documents ADD COLUMN severity_level TEXT DEFAULT 'medium';
    END IF;
    
    -- Add visual_indicators column for storing indicator types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rag_documents' AND column_name = 'visual_indicators') THEN
        ALTER TABLE rag_documents ADD COLUMN visual_indicators TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Create indexes for the new columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_rag_documents_icon_name ON rag_documents(icon_name);
CREATE INDEX IF NOT EXISTS idx_rag_documents_product_type ON rag_documents(product_type);
CREATE INDEX IF NOT EXISTS idx_rag_documents_severity ON rag_documents(severity_level);
CREATE INDEX IF NOT EXISTS idx_rag_documents_visual_indicators ON rag_documents USING GIN(visual_indicators);

-- Create HNSW index for image embeddings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_documents_image_embedding_hnsw') THEN
        CREATE INDEX idx_rag_documents_image_embedding_hnsw 
        ON rag_documents USING hnsw (image_embedding vector_cosine_ops);
    END IF;
END $$;

-- Create or replace the similarity search function
CREATE OR REPLACE FUNCTION match_visual_issues (
  query_embedding VECTOR(1408),
  product_type_filter TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  icon_name TEXT,
  icon_description TEXT,
  product_type TEXT,
  severity_level TEXT,
  visual_indicators TEXT[],
  tags TEXT[],
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    rd.id,
    rd.title,
    rd.content,
    rd.icon_name,
    rd.icon_description,
    rd.product_type,
    rd.severity_level,
    rd.visual_indicators,
    rd.tags,
    1 - (rd.image_embedding <=> query_embedding) AS similarity
  FROM
    rag_documents rd
  WHERE 
    rd.is_active = true
    AND rd.image_embedding IS NOT NULL
    AND (product_type_filter IS NULL OR rd.product_type = product_type_filter)
    AND 1 - (rd.image_embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
$$;

-- Create table for multimodal analysis prompts if it doesn't exist
CREATE TABLE IF NOT EXISTS multimodal_analysis_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt_text TEXT NOT NULL,
  description TEXT,
  analysis_type TEXT DEFAULT 'general', -- 'general', 'indicator', 'damage', 'diagnostic'
  product_type TEXT, -- NULL means applies to all product types
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default analysis prompts
INSERT INTO multimodal_analysis_prompts (name, prompt_text, description, analysis_type) VALUES
('general_visual_analysis', 
'Analyze this image of a product or device. Focus on identifying:
1. Visual indicators (LED lights, displays, screens, gauges, warning symbols)
2. Physical condition (damage, wear, misalignment, corrosion)
3. Error messages, status displays, or diagnostic information
4. Component positioning and connections
5. Any abnormal visual signs or conditions

Describe what you observe in detail, noting:
- Colors and patterns of any lights or indicators
- Text or symbols visible on displays
- Physical state of components
- Any signs of malfunction or unusual conditions

Be specific about locations, colors, and states of visual elements.', 
'General visual analysis for product troubleshooting', 'general'),

('indicator_light_analysis', 
'Examine this image specifically for visual indicators such as:
- LED lights (note exact colors, blinking patterns, solid/off states)
- LCD/LED displays (error codes, messages, symbols, numbers)
- Warning lights or status indicators
- Gauge readings or meter positions
- Icon displays or symbol indicators

For each indicator found, describe:
- Exact location on the device
- Current state (specific color, blinking pattern, message text)
- Intensity or brightness if relevant
- Any accompanying text or symbols

Focus on providing precise details about each visual indicator present.', 
'Detailed analysis of visual indicators and status lights', 'indicator'),

('damage_assessment_analysis', 
'Assess this image for physical damage, wear, or safety concerns:
- Cracks, breaks, deformation, or structural damage
- Discoloration, burn marks, or heat damage
- Loose, missing, or misaligned components
- Corrosion, rust, or chemical damage
- Fluid leaks, stains, or contamination
- Wear patterns or deterioration
- Electrical damage or exposed wiring

For each issue identified:
- Describe the location and extent
- Assess potential safety implications
- Rate the severity of the damage
- Note any immediate safety concerns

Prioritize safety-critical issues in your assessment.', 
'Physical damage and safety assessment', 'damage'),

('diagnostic_troubleshooting', 
'Analyze this image to provide diagnostic troubleshooting insights:
1. Identify the specific problem or malfunction shown
2. Determine the likely cause based on visual evidence
3. Assess the urgency and severity of the issue
4. Consider safety implications
5. Suggest immediate actions if safety is a concern

Structure your analysis as:
🔍 **Problem Identified**: Brief description
⚠️ **Severity Level**: Critical/High/Medium/Low
🛠️ **Likely Cause**: Root cause analysis
⚡ **Immediate Actions**: Urgent steps if needed
📋 **Next Steps**: Recommended troubleshooting approach

Focus on actionable insights based on what is visible in the image.', 
'Diagnostic analysis for troubleshooting guidance', 'diagnostic')

ON CONFLICT (name) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_multimodal_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for multimodal_analysis_prompts if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_multimodal_analysis_prompts_updated_at') THEN
        CREATE TRIGGER update_multimodal_analysis_prompts_updated_at 
        BEFORE UPDATE ON multimodal_analysis_prompts 
        FOR EACH ROW EXECUTE FUNCTION update_multimodal_updated_at_column();
    END IF;
END $$;

-- Update existing records to have default values for new columns where NULL
UPDATE rag_documents 
SET 
    product_type = COALESCE(product_type, 'general'),
    severity_level = COALESCE(severity_level, 'medium'),
    visual_indicators = COALESCE(visual_indicators, '{}')
WHERE 
    product_type IS NULL 
    OR severity_level IS NULL 
    OR visual_indicators IS NULL;
