-- Generic Multimodal RAG System Database Schema
-- This script creates a flexible, product-agnostic troubleshooting system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create or enhance the generic rag_documents table
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    icon_name TEXT,
    icon_description TEXT,
    image_embedding VECTOR(1408),
    
    -- Generic categorization fields
    category TEXT DEFAULT 'general',
    subcategory TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Issue classification
    issue_type TEXT DEFAULT 'general', -- 'visual_indicator', 'physical_damage', 'malfunction', 'maintenance'
    severity_level TEXT DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
    urgency_level TEXT DEFAULT 'normal', -- 'immediate', 'urgent', 'normal', 'low'
    
    -- Visual indicator details
    visual_indicators TEXT[] DEFAULT '{}', -- ['red_light', 'error_display', 'warning_symbol']
    indicator_states TEXT[] DEFAULT '{}', -- ['blinking', 'solid', 'off']
    
    -- Troubleshooting metadata
    difficulty_level TEXT DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced', 'expert'
    estimated_time_minutes INTEGER DEFAULT 15,
    tools_required TEXT[] DEFAULT '{}',
    safety_warnings TEXT[] DEFAULT '{}',
    
    -- System fields
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    source TEXT, -- 'manual', 'imported', 'ai_generated'
    
    -- Metadata for extensibility
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add columns to existing table if they don't exist
DO $$ 
BEGIN
    -- Core RAG fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'icon_name') THEN
        ALTER TABLE rag_documents ADD COLUMN icon_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'icon_description') THEN
        ALTER TABLE rag_documents ADD COLUMN icon_description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'image_embedding') THEN
        ALTER TABLE rag_documents ADD COLUMN image_embedding VECTOR(1408);
    END IF;
    
    -- Generic categorization
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'category') THEN
        ALTER TABLE rag_documents ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'subcategory') THEN
        ALTER TABLE rag_documents ADD COLUMN subcategory TEXT;
    END IF;
    
    -- Issue classification
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'issue_type') THEN
        ALTER TABLE rag_documents ADD COLUMN issue_type TEXT DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'severity_level') THEN
        ALTER TABLE rag_documents ADD COLUMN severity_level TEXT DEFAULT 'medium';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'urgency_level') THEN
        ALTER TABLE rag_documents ADD COLUMN urgency_level TEXT DEFAULT 'normal';
    END IF;
    
    -- Visual indicators
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'visual_indicators') THEN
        ALTER TABLE rag_documents ADD COLUMN visual_indicators TEXT[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'indicator_states') THEN
        ALTER TABLE rag_documents ADD COLUMN indicator_states TEXT[] DEFAULT '{}';
    END IF;
    
    -- Troubleshooting metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'difficulty_level') THEN
        ALTER TABLE rag_documents ADD COLUMN difficulty_level TEXT DEFAULT 'intermediate';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'estimated_time_minutes') THEN
        ALTER TABLE rag_documents ADD COLUMN estimated_time_minutes INTEGER DEFAULT 15;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'tools_required') THEN
        ALTER TABLE rag_documents ADD COLUMN tools_required TEXT[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'safety_warnings') THEN
        ALTER TABLE rag_documents ADD COLUMN safety_warnings TEXT[] DEFAULT '{}';
    END IF;
    
    -- System fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'source') THEN
        ALTER TABLE rag_documents ADD COLUMN source TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rag_documents' AND column_name = 'metadata') THEN
        ALTER TABLE rag_documents ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS idx_rag_documents_category ON rag_documents(category);
CREATE INDEX IF NOT EXISTS idx_rag_documents_subcategory ON rag_documents(subcategory);
CREATE INDEX IF NOT EXISTS idx_rag_documents_issue_type ON rag_documents(issue_type);
CREATE INDEX IF NOT EXISTS idx_rag_documents_severity ON rag_documents(severity_level);
CREATE INDEX IF NOT EXISTS idx_rag_documents_urgency ON rag_documents(urgency_level);
CREATE INDEX IF NOT EXISTS idx_rag_documents_difficulty ON rag_documents(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_rag_documents_tags ON rag_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_rag_documents_visual_indicators ON rag_documents USING GIN(visual_indicators);
CREATE INDEX IF NOT EXISTS idx_rag_documents_indicator_states ON rag_documents USING GIN(indicator_states);
CREATE INDEX IF NOT EXISTS idx_rag_documents_tools ON rag_documents USING GIN(tools_required);
CREATE INDEX IF NOT EXISTS idx_rag_documents_metadata ON rag_documents USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_rag_documents_active ON rag_documents(is_active) WHERE is_active = true;

-- Create HNSW index for vector similarity search
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rag_documents_image_embedding_hnsw') THEN
        CREATE INDEX idx_rag_documents_image_embedding_hnsw 
        ON rag_documents USING hnsw (image_embedding vector_cosine_ops);
    END IF;
END $$;

-- Generic similarity search function
CREATE OR REPLACE FUNCTION search_similar_issues (
    query_embedding VECTOR(1408),
    category_filter TEXT DEFAULT NULL,
    issue_type_filter TEXT DEFAULT NULL,
    severity_filter TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.6,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    icon_name TEXT,
    icon_description TEXT,
    category TEXT,
    subcategory TEXT,
    issue_type TEXT,
    severity_level TEXT,
    urgency_level TEXT,
    visual_indicators TEXT[],
    indicator_states TEXT[],
    difficulty_level TEXT,
    estimated_time_minutes INTEGER,
    tools_required TEXT[],
    safety_warnings TEXT[],
    tags TEXT[],
    metadata JSONB,
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
        rd.category,
        rd.subcategory,
        rd.issue_type,
        rd.severity_level,
        rd.urgency_level,
        rd.visual_indicators,
        rd.indicator_states,
        rd.difficulty_level,
        rd.estimated_time_minutes,
        rd.tools_required,
        rd.safety_warnings,
        rd.tags,
        rd.metadata,
        1 - (rd.image_embedding <=> query_embedding) AS similarity
    FROM
        rag_documents rd
    WHERE 
        rd.is_active = true
        AND rd.image_embedding IS NOT NULL
        AND (category_filter IS NULL OR rd.category = category_filter)
        AND (issue_type_filter IS NULL OR rd.issue_type = issue_type_filter)
        AND (severity_filter IS NULL OR rd.severity_level = severity_filter)
        AND 1 - (rd.image_embedding <=> query_embedding) > match_threshold
    ORDER BY
        similarity DESC,
        CASE rd.severity_level 
            WHEN 'critical' THEN 4
            WHEN 'high' THEN 3
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
        END DESC,
        CASE rd.urgency_level
            WHEN 'immediate' THEN 4
            WHEN 'urgent' THEN 3
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 1
            ELSE 0
        END DESC
    LIMIT match_count;
$$;

-- Analysis prompts table for flexible prompt management
CREATE TABLE IF NOT EXISTS analysis_prompts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    prompt_text TEXT NOT NULL,
    description TEXT,
    prompt_type TEXT DEFAULT 'analysis', -- 'analysis', 'response', 'system'
    analysis_focus TEXT DEFAULT 'general', -- 'general', 'visual_indicators', 'physical_damage', 'diagnostic'
    category TEXT, -- NULL means applies to all categories
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority prompts are preferred
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Insert comprehensive analysis prompts
INSERT INTO analysis_prompts (name, prompt_text, description, prompt_type, analysis_focus, priority) VALUES
('general_visual_analysis', 
'Analyze this image systematically and identify:

**Visual Indicators:**
- LED lights (colors, patterns: solid, blinking, off)
- Digital displays (error codes, messages, symbols, numbers)
- Analog gauges or meters (readings, positions)
- Warning symbols or status icons
- Screen displays or interfaces

**Physical Condition:**
- Structural integrity (cracks, breaks, deformation)
- Surface condition (discoloration, burn marks, corrosion)
- Component alignment and positioning
- Visible wear or damage patterns
- Cleanliness and contamination

**Operational State:**
- Power status indicators
- Connection status
- Fluid levels (if visible)
- Moving parts position
- Safety mechanisms state

**Environmental Factors:**
- Installation context
- Surrounding conditions
- Accessibility for maintenance

Describe each observation with specific details about location, appearance, and potential significance for troubleshooting.', 
'Comprehensive visual analysis for any product or device', 'analysis', 'general', 100),

('visual_indicator_focus', 
'Focus specifically on visual indicators in this image:

**LED Status Lights:**
- Exact colors (red, green, blue, yellow, orange, white)
- Patterns (solid, slow blink, fast blink, alternating, off)
- Intensity (bright, dim, flickering)
- Location and grouping

**Digital Displays:**
- Error codes or numbers displayed
- Text messages or symbols
- Display brightness and clarity
- Segment or pixel issues

**Analog Indicators:**
- Gauge needle positions
- Scale readings
- Meter values
- Indicator lamp states

**Status Symbols:**
- Warning icons or symbols
- Operational status indicators
- Safety status displays
- Mode or setting indicators

For each indicator found, specify:
1. Exact location on the device
2. Current state or reading
3. Normal vs. abnormal appearance
4. Relationship to other indicators

Prioritize indicators that suggest problems or require attention.', 
'Detailed analysis of visual status indicators', 'analysis', 'visual_indicators', 90),

('physical_damage_assessment', 
'Assess this image for physical damage and safety concerns:

**Structural Damage:**
- Cracks in housing or components
- Breaks or fractures
- Deformation or warping
- Missing or loose parts

**Surface Damage:**
- Discoloration or staining
- Burn marks or heat damage
- Corrosion or rust
- Scratches or abrasions

**Electrical Concerns:**
- Exposed wiring or connections
- Burn marks around electrical components
- Melted or damaged insulation
- Loose electrical connections

**Fluid-Related Issues:**
- Leaks or spills
- Staining from fluids
- Corrosion from liquid exposure
- Blocked or damaged fluid paths

**Safety Assessment:**
- Immediate safety hazards
- Risk of injury or further damage
- Need for immediate shutdown
- Required safety precautions

Rate each issue by severity:
- CRITICAL: Immediate safety risk or complete failure
- HIGH: Significant malfunction or safety concern
- MEDIUM: Performance impact or potential future problem
- LOW: Cosmetic or minor functional issue

Include specific recommendations for each identified problem.', 
'Physical damage and safety assessment', 'analysis', 'physical_damage', 85),

('diagnostic_troubleshooting', 
'Provide comprehensive diagnostic analysis of this image:

**Problem Identification:**
- Primary issue or malfunction visible
- Secondary or related problems
- Symptoms and their significance

**Root Cause Analysis:**
- Most likely cause based on visual evidence
- Contributing factors
- Failure mode analysis

**Severity and Urgency Assessment:**
- Impact on operation
- Safety implications
- Time sensitivity for repair

**Troubleshooting Approach:**
- Immediate actions required
- Diagnostic steps to confirm cause
- Repair or replacement options
- Prevention strategies

**Resource Requirements:**
- Tools needed for diagnosis/repair
- Skill level required
- Estimated time for resolution
- Parts or materials needed

**Safety Considerations:**
- Hazards present
- Required safety equipment
- Precautions during repair
- When to seek professional help

Structure your response to guide the user through a logical troubleshooting process, starting with the most critical issues and safest approaches.', 
'Comprehensive diagnostic and troubleshooting guidance', 'analysis', 'diagnostic', 95),

('response_generation_system', 
'You are an expert troubleshooting assistant. Based on the image analysis and similar issues found in the knowledge base, provide a helpful response following this structure:

🔍 **Issue Identified**
Brief, clear description of the main problem

⚠️ **Severity Level**
Critical | High | Medium | Low (with brief explanation)

🛠️ **Recommended Actions**
1. Immediate steps (if safety concerns)
2. Diagnostic steps to confirm the issue
3. Repair or resolution steps
4. Verification steps

💡 **Additional Information**
- Tools required
- Estimated time
- Difficulty level
- Safety precautions

📞 **When to Seek Help**
Conditions that require professional assistance

**Guidelines:**
- Use clear, non-technical language
- Prioritize safety above all else
- Provide step-by-step instructions
- Explain the reasoning behind recommendations
- Include preventive measures when relevant
- Be honest about limitations and uncertainties', 
'System prompt for generating user-friendly responses', 'response', 'general', 100)

ON CONFLICT (name) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Categories table for dynamic category management
CREATE TABLE IF NOT EXISTS issue_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    parent_category TEXT REFERENCES issue_categories(name),
    icon_name TEXT,
    color_code TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Insert default categories
INSERT INTO issue_categories (name, display_name, description, icon_name, color_code, sort_order) VALUES
('general', 'General', 'General troubleshooting and maintenance', 'settings', '#6B7280', 0),
('electrical', 'Electrical', 'Electrical systems and components', 'zap', '#EF4444', 10),
('mechanical', 'Mechanical', 'Mechanical parts and assemblies', 'cog', '#3B82F6', 20),
('electronic', 'Electronic', 'Electronic controls and displays', 'cpu', '#8B5CF6', 30),
('safety', 'Safety', 'Safety systems and warnings', 'shield', '#F59E0B', 40),
('maintenance', 'Maintenance', 'Routine maintenance and care', 'wrench', '#10B981', 50),
('performance', 'Performance', 'Performance issues and optimization', 'trending-up', '#06B6D4', 60),
('connectivity', 'Connectivity', 'Network and communication issues', 'wifi', '#84CC16', 70)
ON CONFLICT (name) DO NOTHING;

-- User interaction logging table
CREATE TABLE IF NOT EXISTS interaction_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT,
    user_id TEXT,
    interaction_type TEXT NOT NULL, -- 'image_upload', 'analysis_request', 'response_generated', 'error'
    category TEXT,
    subcategory TEXT,
    
    -- Request details
    image_metadata JSONB,
    analysis_parameters JSONB,
    
    -- Response details
    similar_issues_found INTEGER DEFAULT 0,
    response_generated BOOLEAN DEFAULT false,
    processing_time_ms INTEGER,
    
    -- Error details
    error_type TEXT,
    error_message TEXT,
    error_details JSONB,
    
    -- System info
    user_agent TEXT,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for logging table
CREATE INDEX IF NOT EXISTS idx_interaction_logs_session ON interaction_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_type ON interaction_logs(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_timestamp ON interaction_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_category ON interaction_logs(category);

-- Function to log interactions
CREATE OR REPLACE FUNCTION log_interaction(
    p_session_id TEXT,
    p_user_id TEXT DEFAULT NULL,
    p_interaction_type TEXT DEFAULT 'general',
    p_category TEXT DEFAULT NULL,
    p_subcategory TEXT DEFAULT NULL,
    p_image_metadata JSONB DEFAULT NULL,
    p_analysis_parameters JSONB DEFAULT NULL,
    p_similar_issues_found INTEGER DEFAULT 0,
    p_response_generated BOOLEAN DEFAULT false,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_error_type TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_error_details JSONB DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO interaction_logs (
        session_id, user_id, interaction_type, category, subcategory,
        image_metadata, analysis_parameters, similar_issues_found,
        response_generated, processing_time_ms, error_type, error_message,
        error_details, user_agent, ip_address, metadata
    ) VALUES (
        p_session_id, p_user_id, p_interaction_type, p_category, p_subcategory,
        p_image_metadata, p_analysis_parameters, p_similar_issues_found,
        p_response_generated, p_processing_time_ms, p_error_type, p_error_message,
        p_error_details, p_user_agent, p_ip_address, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rag_documents_updated_at') THEN
        CREATE TRIGGER update_rag_documents_updated_at 
        BEFORE UPDATE ON rag_documents 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_analysis_prompts_updated_at') THEN
        CREATE TRIGGER update_analysis_prompts_updated_at 
        BEFORE UPDATE ON analysis_prompts 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Update existing records with default values
UPDATE rag_documents 
SET 
    category = COALESCE(category, 'general'),
    issue_type = COALESCE(issue_type, 'general'),
    severity_level = COALESCE(severity_level, 'medium'),
    urgency_level = COALESCE(urgency_level, 'normal'),
    difficulty_level = COALESCE(difficulty_level, 'intermediate'),
    estimated_time_minutes = COALESCE(estimated_time_minutes, 15),
    visual_indicators = COALESCE(visual_indicators, '{}'),
    indicator_states = COALESCE(indicator_states, '{}'),
    tools_required = COALESCE(tools_required, '{}'),
    safety_warnings = COALESCE(safety_warnings, '{}'),
    tags = COALESCE(tags, '{}'),
    metadata = COALESCE(metadata, '{}'::jsonb)
WHERE 
    category IS NULL 
    OR issue_type IS NULL 
    OR severity_level IS NULL 
    OR urgency_level IS NULL 
    OR difficulty_level IS NULL 
    OR estimated_time_minutes IS NULL 
    OR visual_indicators IS NULL 
    OR indicator_states IS NULL 
    OR tools_required IS NULL 
    OR safety_warnings IS NULL 
    OR tags IS NULL 
    OR metadata IS NULL;
