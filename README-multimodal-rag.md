# Multimodal RAG Troubleshooting System

A comprehensive AI-powered system for troubleshooting physical product issues using image analysis, vector similarity search, and contextualized AI responses.

## Features

### 🔍 **Multimodal Analysis**
- **Image Recognition**: Analyzes product components, indicators, and damage
- **Visual Indicator Detection**: Identifies lights, displays, error codes, and status indicators
- **Damage Assessment**: Evaluates physical condition and safety concerns
- **Multiple Analysis Types**: General, detailed indicators, and damage-focused analysis

### 🗄️ **Vector Database Integration**
- **Supabase + pgvector**: High-performance vector similarity search
- **1408-dimension Embeddings**: Compatible with Google's multimodal embedding models
- **Smart Matching**: Finds similar issues based on visual similarity
- **Product Categorization**: Organized by product types for better accuracy

### 🤖 **AI-Powered Responses**
- **Contextualized Solutions**: Combines image analysis with database knowledge
- **Structured Responses**: Issue identification, severity, steps, prevention, and support
- **Chat History**: Maintains conversation context for follow-up questions
- **Dynamic Prompts**: Database-stored prompts for consistent and updatable responses

### 📱 **Mobile-Optimized UI**
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Enhanced Mobile Upload**: 3x larger upload area on mobile when active
- **Touch-Friendly**: Large buttons and intuitive gestures
- **Progressive Enhancement**: Graceful degradation for different screen sizes

## System Architecture

### Database Schema

\`\`\`sql
-- Main RAG documents table with vector embeddings
rag_documents (
  id UUID PRIMARY KEY,
  product_category TEXT,
  icon_name TEXT,
  icon_description TEXT,
  content TEXT, -- Troubleshooting solutions
  image_embedding VECTOR(1408), -- Google multimodal embeddings
  tags TEXT[],
  severity_level TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN
)

-- Product categories for organization
product_categories (
  id UUID PRIMARY KEY,
  category_name TEXT UNIQUE,
  display_name TEXT,
  description TEXT,
  icon_name TEXT,
  system_prompt_id UUID,
  is_active BOOLEAN
)

-- Dynamic prompts for AI responses
multimodal_prompts (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE,
  prompt TEXT,
  description TEXT,
  product_category TEXT,
  prompt_type TEXT, -- 'analysis', 'response', 'system'
  is_active BOOLEAN
)
\`\`\`

### API Endpoints

#### `/api/multimodal-troubleshoot`
- **Purpose**: Main troubleshooting endpoint
- **Input**: Image (base64), product category, analysis type, chat history
- **Process**: 
  1. Image analysis with Gemini Vision
  2. Vector embedding generation
  3. Similarity search in Supabase
  4. Contextualized response generation
- **Output**: AI response, matched issues, analysis results

#### `/api/product-categories`
- **Purpose**: Retrieve available product categories
- **Output**: List of active product categories with metadata

#### `/api/multimodal-prompts`
- **Purpose**: Manage AI prompts stored in database
- **Output**: Available prompts for different analysis types

### Vector Similarity Search

\`\`\`sql
-- Custom function for similarity search with filtering
match_product_issues(
  query_embedding VECTOR(1408),
  product_category_filter TEXT,
  match_threshold FLOAT,
  match_count INT
)
\`\`\`

## Setup Instructions

### 1. Database Setup

Run the setup script in your Supabase SQL Editor:

\`\`\`bash
# Execute the SQL script
scripts/setup-multimodal-rag-system.sql
\`\`\`

This creates:
- Vector-enabled tables with pgvector extension
- Similarity search functions
- Sample data for multiple product categories
- Indexes for optimal performance

### 2. Environment Variables

Configure in Vercel or your deployment platform:

\`\`\`env
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

### 3. Vector Embeddings

**Important**: The sample data includes placeholder embeddings. For production:

1. **Collect Reference Images**: Gather clear images of each product indicator/issue
2. **Generate Embeddings**: Use Google's multimodal embedding API
3. **Populate Database**: Update the `image_embedding` column with real vectors

Example embedding generation:
\`\`\`typescript
// Pseudo-code for embedding generation
const embedding = await googleMultimodalEmbedding.embed(imageBuffer)
await supabase
  .from('rag_documents')
  .update({ image_embedding: embedding })
  .eq('id', documentId)
\`\`\`

## Usage Guide

### For End Users

1. **Start Session**: Click "Start Troubleshooting"
2. **Select Category**: Choose your product type (optional)
3. **Choose Analysis**: Select analysis type (general, detailed, damage)
4. **Upload Image**: Take or upload a photo of the issue
5. **Get Solution**: Receive AI-powered troubleshooting steps

### For Administrators

1. **Add Product Categories**: Define new product types in `product_categories`
2. **Create RAG Documents**: Add troubleshooting knowledge with embeddings
3. **Manage Prompts**: Update AI prompts in `multimodal_prompts` table
4. **Monitor Performance**: Track similarity scores and user feedback

## Supported Product Categories

- **Coffee Makers**: Espresso machines, drip coffee makers, pod machines
- **Printers**: Inkjet, laser, multifunction printers
- **Network Equipment**: Routers, modems, access points
- **Home Appliances**: Refrigerators, washing machines, dishwashers
- **Consumer Electronics**: TVs, audio equipment, gaming consoles
- **Automotive**: Dashboard indicators, engine components
- **HVAC Systems**: Thermostats, air conditioning, heating
- **General Products**: Miscellaneous devices and equipment

## Mobile Enhancements

### Responsive Design Features

- **Adaptive Upload Area**: Automatically enlarges by 3x on mobile after starting
- **Touch Optimization**: Large touch targets and gesture-friendly interface
- **Progressive Enhancement**: Works on all screen sizes
- **Mobile-First**: Designed primarily for mobile troubleshooting scenarios

### Mobile-Specific Behaviors

\`\`\`typescript
// Mobile detection and UI scaling
const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
  navigator.userAgent.toLowerCase()
)

// Dynamic upload area sizing
const uploadAreaClasses = isMobile && isStarted 
  ? "scale-150 transform origin-top min-h-[300px]" 
  : "min-h-[150px]"
\`\`\`

## Performance Optimization

### Vector Search Optimization

- **HNSW Index**: Optimized for high-dimensional vector similarity
- **Filtered Search**: Product category filtering reduces search space
- **Configurable Thresholds**: Adjustable similarity thresholds
- **Batch Processing**: Efficient handling of multiple queries

### Caching Strategy

- **Prompt Caching**: Database prompts cached for performance
- **Category Caching**: Product categories cached on client
- **Embedding Caching**: Consider caching frequent embeddings

## Security Considerations

- **Environment Variables**: All sensitive keys stored securely
- **Input Validation**: Image size and type validation
- **Rate Limiting**: Consider implementing for production
- **Access Control**: Supabase RLS for data protection

## Troubleshooting

### Common Issues

1. **Vector Dimension Mismatch**: Ensure embeddings are exactly 1408 dimensions
2. **Similarity Threshold**: Adjust threshold if no matches found
3. **Mobile Upload**: Check file size limits on mobile devices
4. **API Limits**: Monitor Google API usage and quotas

### Debug Information

The system provides detailed debug information:
- Similarity scores for matched issues
- Analysis confidence levels
- Processing time metrics
- Error details and suggestions

## Future Enhancements

- **Real-time Analysis**: Live camera feed analysis
- **Multi-language Support**: Internationalization for global use
- **Feedback Loop**: User feedback to improve matching accuracy
- **Advanced Analytics**: Usage patterns and success metrics
- **Integration APIs**: Third-party system integration
- **Offline Mode**: Local processing for sensitive environments
