-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the main RAG documents table for multimodal troubleshooting
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_category TEXT NOT NULL, -- e.g., 'coffee_maker', 'printer', 'router', etc.
  icon_name TEXT NOT NULL,
  icon_description TEXT,
  content TEXT NOT NULL, -- Troubleshooting steps or solutions
  image_embedding VECTOR(1408), -- For Google's multimodal embedding model
  tags TEXT[] DEFAULT '{}', -- Additional tags for categorization
  severity_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_rag_documents_product_category ON rag_documents(product_category);
CREATE INDEX IF NOT EXISTS idx_rag_documents_active ON rag_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_rag_documents_severity ON rag_documents(severity_level);
CREATE INDEX IF NOT EXISTS idx_rag_documents_tags ON rag_documents USING GIN(tags);

-- Create an index for faster similarity searches on image_embedding
-- Using HNSW index for high-dimensional vectors
CREATE INDEX IF NOT EXISTS idx_rag_documents_image_embedding
ON rag_documents
USING hnsw (image_embedding vector_cosine_ops);

-- Create a function for similarity search with product filtering
CREATE OR REPLACE FUNCTION match_product_issues (
  query_embedding VECTOR(1408),
  product_category_filter TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  product_category TEXT,
  icon_name TEXT,
  icon_description TEXT,
  content TEXT,
  tags TEXT[],
  severity_level TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    rd.id,
    rd.product_category,
    rd.icon_name,
    rd.icon_description,
    rd.content,
    rd.tags,
    rd.severity_level,
    1 - (rd.image_embedding <=> query_embedding) AS similarity
  FROM
    rag_documents rd
  WHERE 
    rd.is_active = true
    AND (product_category_filter IS NULL OR rd.product_category = product_category_filter)
    AND 1 - (rd.image_embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
$$;

-- Create table for product categories and their configurations
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT DEFAULT 'package',
  system_prompt_id UUID REFERENCES system_prompts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for troubleshooting prompts specific to multimodal analysis
CREATE TABLE IF NOT EXISTS multimodal_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  description TEXT,
  product_category TEXT, -- NULL means applies to all categories
  prompt_type TEXT DEFAULT 'analysis', -- 'analysis', 'response', 'system'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default product categories
INSERT INTO product_categories (category_name, display_name, description, icon_name) VALUES
('coffee_maker', 'Coffee Makers', 'Espresso machines, drip coffee makers, and pod machines', 'coffee'),
('printer', 'Printers', 'Inkjet, laser, and multifunction printers', 'printer'),
('router', 'Network Equipment', 'Routers, modems, and network devices', 'wifi'),
('appliance', 'Home Appliances', 'Refrigerators, washing machines, and other appliances', 'home'),
('electronics', 'Consumer Electronics', 'TVs, audio equipment, and general electronics', 'monitor'),
('automotive', 'Automotive', 'Car dashboard indicators and automotive components', 'car'),
('hvac', 'HVAC Systems', 'Heating, ventilation, and air conditioning systems', 'thermometer'),
('general', 'General Products', 'Miscellaneous products and devices', 'package')
ON CONFLICT (category_name) DO NOTHING;

-- Insert default multimodal prompts
INSERT INTO multimodal_prompts (name, prompt, description, prompt_type) VALUES
('general_image_analysis', 
'Analyze this image of a product component or device. Focus on:
1. Visual indicators (lights, displays, screens, gauges)
2. Physical condition (damage, wear, misalignment)
3. Error messages or status displays
4. Component positioning and connections
5. Any abnormal visual signs

Describe what you observe in detail, noting colors, patterns, text, and any indicators of malfunction or status.', 
'General image analysis for product troubleshooting', 'analysis'),

('detailed_indicator_analysis', 
'Examine this image for specific visual indicators such as:
- LED lights (color, blinking pattern, solid/off)
- LCD/LED displays (error codes, messages, symbols)
- Physical gauges or meters
- Warning symbols or icons
- Status indicators

For each indicator found, describe:
- Location on the device
- Current state (color, pattern, message)
- What this typically indicates', 
'Detailed analysis of visual indicators and displays', 'analysis'),

('damage_assessment', 
'Assess this image for physical damage or wear:
- Cracks, breaks, or deformation
- Discoloration or burn marks
- Loose or missing components
- Corrosion or rust
- Misaligned parts
- Fluid leaks or stains

Rate the severity and describe the potential impact on functionality.', 
'Physical damage and wear assessment', 'analysis'),

('troubleshooting_response', 
'Based on the image analysis and retrieved troubleshooting information, provide a clear, step-by-step solution. Structure your response as:

🔍 **Issue Identified**: Brief description of the problem
⚠️ **Severity**: Low/Medium/High/Critical
🛠️ **Solution Steps**: Numbered, actionable steps
💡 **Prevention Tips**: How to avoid this issue in the future
📞 **When to Seek Help**: When to contact support or a professional

Use simple language and include safety warnings where appropriate.', 
'Generate structured troubleshooting responses', 'response')
ON CONFLICT (name) DO NOTHING;

-- Insert sample troubleshooting data for various product categories
INSERT INTO rag_documents (product_category, icon_name, icon_description, content, tags, severity_level, image_embedding) VALUES

-- Coffee Maker Issues
('coffee_maker', 'water_tank_empty', 'Red blinking water drop icon on coffee maker display', 
'The water tank is empty or not properly seated. Steps to resolve:
1. Remove the water tank completely
2. Fill with fresh, cold water to the MAX line
3. Ensure the tank is properly aligned and seated
4. Press firmly until you hear a click
5. The red light should turn off within 10 seconds', 
ARRAY['water', 'tank', 'indicator', 'red_light'], 'medium', array_fill(0, ARRAY[1408])::vector),

('coffee_maker', 'descale_required', 'Orange blinking CALC or descale symbol', 
'The coffee maker requires descaling due to mineral buildup. Steps:
1. Purchase appropriate descaling solution
2. Fill water tank with descaling solution as per instructions
3. Start descaling cycle (usually hold CALC button for 3 seconds)
4. Follow the automatic descaling process
5. Rinse thoroughly with fresh water (2-3 cycles)
6. The orange light will turn off when complete', 
ARRAY['descale', 'maintenance', 'calc', 'orange_light'], 'high', array_fill(0, ARRAY[1408])::vector),

-- Printer Issues
('printer', 'paper_jam_indicator', 'Red paper jam warning light or display message', 
'Paper jam detected in the printer. Resolution steps:
1. Turn off the printer and unplug it
2. Open all access doors (front, back, top)
3. Gently remove any visible paper, pulling in direction of paper path
4. Check for small torn pieces
5. Close all doors and restart printer
6. Run a test print to verify resolution', 
ARRAY['paper_jam', 'red_light', 'error'], 'medium', array_fill(0, ARRAY[1408])::vector),

('printer', 'low_ink_warning', 'Yellow or orange ink level warning', 
'Ink cartridge is running low or empty. Steps to resolve:
1. Check which cartridge is low (color indicated on display)
2. Purchase compatible replacement cartridge
3. Open printer cover
4. Remove old cartridge by pressing release tab
5. Install new cartridge until it clicks
6. Close cover and run alignment if prompted', 
ARRAY['ink', 'cartridge', 'yellow_light', 'replacement'], 'low', array_fill(0, ARRAY[1408])::vector),

-- Router/Network Issues
('router', 'internet_connection_lost', 'Red internet/globe icon or no connectivity lights', 
'Internet connection is down. Troubleshooting steps:
1. Check all cable connections (power, ethernet)
2. Unplug router for 30 seconds, then plug back in
3. Wait 2-3 minutes for full startup
4. Check if ISP is experiencing outages
5. Contact ISP if problem persists after restart
6. Consider factory reset if other devices also affected', 
ARRAY['internet', 'connection', 'red_light', 'network'], 'high', array_fill(0, ARRAY[1408])::vector),

-- General Electronics
('electronics', 'overheating_warning', 'Red temperature warning or excessive heat', 
'Device is overheating and may shut down for protection. Steps:
1. Immediately turn off the device
2. Unplug from power source
3. Move to well-ventilated area
4. Check for blocked vents or fans
5. Clean dust from vents using compressed air
6. Wait 30 minutes before restarting
7. Monitor temperature during use', 
ARRAY['overheating', 'temperature', 'ventilation', 'safety'], 'critical', array_fill(0, ARRAY[1408])::vector),

-- Automotive
('automotive', 'check_engine_light', 'Yellow or amber check engine light on dashboard', 
'Check engine light indicates a potential engine or emissions issue. Steps:
1. Check if gas cap is loose and tighten if needed
2. Note any unusual sounds, smells, or performance issues
3. Check fluid levels (oil, coolant, brake fluid)
4. Use OBD-II scanner to read error codes if available
5. Schedule appointment with mechanic for diagnosis
6. Avoid heavy acceleration until diagnosed', 
ARRAY['check_engine', 'dashboard', 'yellow_light', 'diagnostic'], 'high', array_fill(0, ARRAY[1408])::vector)

ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_multimodal_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_rag_documents_updated_at
BEFORE UPDATE ON rag_documents
FOR EACH ROW EXECUTE FUNCTION update_multimodal_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON product_categories
FOR EACH ROW EXECUTE FUNCTION update_multimodal_updated_at_column();

CREATE TRIGGER update_multimodal_prompts_updated_at
BEFORE UPDATE ON multimodal_prompts
FOR EACH ROW EXECUTE FUNCTION update_multimodal_updated_at_column();
