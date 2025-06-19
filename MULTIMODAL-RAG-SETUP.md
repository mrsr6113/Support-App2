# Multimodal RAG System Setup Guide

This guide explains how to set up and use the multimodal RAG troubleshooting system that works with your existing data structure.

## Overview

The system enhances your existing `rag_documents` table to support:
- **Image embeddings** (1408-dimension vectors)
- **Visual indicator analysis**
- **Product type categorization**
- **Severity level assessment**
- **Mobile-optimized interface**

## Database Setup

### Step 1: Enhance Existing Table

Run the enhancement script to add necessary columns to your existing `rag_documents` table:

\`\`\`sql
-- This script safely adds columns without losing existing data
scripts/enhance-existing-rag-table.sql
\`\`\`

This script will:
- ✅ Add missing columns only if they don't exist
- ✅ Preserve all existing data
- ✅ Create necessary indexes for performance
- ✅ Set up similarity search functions
- ✅ Create prompt management table

### Step 2: Verify Table Structure

After running the script, your `rag_documents` table should have:

\`\`\`sql
-- Core existing columns (preserved)
id UUID
title TEXT
content TEXT
category TEXT
tags TEXT[]
created_at TIMESTAMP
updated_at TIMESTAMP
is_active BOOLEAN

-- New multimodal columns (added)
icon_name TEXT                    -- Visual indicator name
icon_description TEXT             -- Detailed indicator description
image_embedding VECTOR(1408)      -- Google multimodal embeddings
product_type TEXT                 -- Product categorization
severity_level TEXT               -- Issue severity (low/medium/high/critical)
visual_indicators TEXT[]          -- Array of visual indicator types
\`\`\`

## Environment Variables

Configure these in your Vercel dashboard or `.env.local`:

\`\`\`env
# Required for multimodal RAG system
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

## API Endpoints

The system provides these new endpoints:

### `/api/multimodal-rag/analyze`
- **Purpose**: Main analysis endpoint
- **Input**: Image (base64), product type, analysis type
- **Process**: 
  1. Generate image embedding using Google's multimodal API
  2. Perform vector similarity search in your existing data
  3. Generate contextualized response with Gemini
- **Output**: AI response + matched similar issues

### `/api/multimodal-rag/prompts`
- **Purpose**: Retrieve analysis prompts from database
- **Output**: Available prompts for different analysis types

### `/api/multimodal-rag/product-types`
- **Purpose**: Get product types from existing data
- **Output**: Distinct product types found in your `rag_documents`

## Usage

### 1. Access the Interface
Navigate to `/multimodal-rag` to use the system.

### 2. Mobile Enhancement
On mobile devices, the image upload area automatically enlarges by 3x after pressing "Start" for better usability.

### 3. Analysis Types
Choose from:
- **General Analysis**: Overall visual assessment
- **Indicator Analysis**: Focus on lights, displays, status indicators
- **Damage Assessment**: Physical damage and safety evaluation
- **Diagnostic Analysis**: Comprehensive troubleshooting

### 4. Product Types
The system automatically detects product types from your existing data and allows filtering for better accuracy.

## Data Population

### Adding Image Embeddings

To populate the `image_embedding` column with actual vectors:

\`\`\`typescript
// Example: Generate embeddings for existing documents
const generateEmbeddings = async () => {
  const documents = await supabase
    .from('rag_documents')
    .select('*')
    .is('image_embedding', null)
  
  for (const doc of documents) {
    // Generate embedding from reference image
    const embedding = await generateImageEmbedding(referenceImage)
    
    // Update document with embedding
    await supabase
      .from('rag_documents')
      .update({ image_embedding: embedding })
      .eq('id', doc.id)
  }
}
\`\`\`

### Updating Product Types

Categorize your existing documents:

\`\`\`sql
-- Example: Update product types based on existing categories or content
UPDATE rag_documents 
SET product_type = 'coffee_maker' 
WHERE category ILIKE '%coffee%' OR content ILIKE '%coffee%';

UPDATE rag_documents 
SET product_type = 'printer' 
WHERE category ILIKE '%print%' OR content ILIKE '%ink%';
\`\`\`

## System Features

### 🔍 **Image Analysis**
- Analyzes visual indicators (lights, displays, damage)
- Multiple analysis types for different use cases
- Integrates with Google's Gemini Vision API

### 🗄️ **Vector Search**
- Uses pgvector for high-performance similarity search
- 1408-dimension embeddings compatible with Google's multimodal models
- Configurable similarity thresholds

### 🤖 **Contextualized Responses**
- Combines image analysis with database knowledge
- Dynamic prompts stored in database
- Maintains chat history for context

### 📱 **Mobile Optimization**
- Responsive design for all devices
- 3x enlarged upload area on mobile when active
- Touch-friendly interface

## Performance Optimization

### Vector Index
The system creates an HNSW index for fast similarity search:

\`\`\`sql
CREATE INDEX idx_rag_documents_image_embedding_hnsw 
ON rag_documents USING hnsw (image_embedding vector_cosine_ops);
\`\`\`

### Query Optimization
- Product type filtering reduces search space
- Configurable similarity thresholds
- Efficient batch processing

## Troubleshooting

### Common Issues

1. **No Similar Issues Found**
   - Check if `image_embedding` column is populated
   - Lower the similarity threshold in the search function
   - Verify image quality and content

2. **Embedding Dimension Mismatch**
   - Ensure embeddings are exactly 1408 dimensions
   - Check Google API response format

3. **Mobile Upload Issues**
   - Verify file size limits (10MB max)
   - Check supported formats (JPG, PNG, WebP)

### Debug Information

The system provides detailed debug info:
- Similarity scores for matched issues
- Analysis confidence levels
- Processing time metrics
- Error details and suggestions

## Security Considerations

- All API keys stored as environment variables
- Input validation for image uploads
- Supabase RLS policies for data protection
- File size and type restrictions

## Future Enhancements

- **Batch Processing**: Analyze multiple images at once
- **Real-time Analysis**: Live camera feed analysis
- **Feedback Loop**: User feedback to improve matching
- **Advanced Analytics**: Usage patterns and success metrics
- **Multi-language Support**: International troubleshooting
