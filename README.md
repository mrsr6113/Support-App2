# AI Vision Chat

Voice-enabled AI vision chat application with screen sharing and camera support.

## Features

- 🎤 **Voice Input**: Natural language voice commands and conversation
- 🖥️ **Screen Sharing**: Capture and analyze screen content
- 📷 **Camera Support**: Real-time camera feed analysis
- 💬 **Real-time Chat**: Interactive conversation with AI
- 🔊 **Text-to-Speech**: Audio responses from AI
- 🌐 **Multi-language**: Support for multiple languages
- ☁️ **Supabase Integration**: Dynamic configuration and data storage
- 🧠 **RAG Support**: Retrieval-Augmented Generation with custom documents
- 📝 **Chat History**: Persistent conversation history

## Setup

### 1. Environment Variables

Create a `.env.local` file in the root directory:
\`\`\`env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_TTS_API_KEY=your_google_tts_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

### 2. API Keys

- **Gemini API**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Google TTS API**: Get from [Google Cloud Console](https://console.cloud.google.com/)
- **Supabase**: Create a project at [Supabase](https://supabase.com/)

### 3. Database Setup

**Important**: You must set up the Supabase database tables before using the application.

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `scripts/create-supabase-tables.sql`
4. Run the script to create all necessary tables and sample data

This will create:
- `rag_documents` - For storing RAG knowledge base documents
- `system_prompts` - For managing AI system prompts
- `visual_analysis_prompts` - For configuring image analysis prompts
- `chat_sessions` - For storing conversation history

### 4. Installation

\`\`\`bash
npm install
npm run dev
\`\`\`

## Usage

### Voice Commands
- "画面共有" - Start screen sharing
- "カメラ" - Start camera
- "停止" - Stop capture
- "音声モード終了" - Exit voice mode

### Features
- **Screen Sharing**: Default mode, no automatic fallback to camera
- **Voice Mode**: Continuous voice interaction
- **Real-time Analysis**: Periodic image analysis with customizable prompts
- **Chat Integration**: Voice and text chat with current image context
- **RAG Integration**: Upload and manage knowledge base documents
- **System Prompts**: Configure AI behavior with custom prompts
- **Chat History**: Persistent conversation history across sessions

## Database Management

### RAG Documents
- Add custom knowledge base documents
- Organize by categories and tags
- Import from text/CSV files
- Search and retrieve relevant information

### System Prompts
- Create custom AI behavior profiles
- Set default prompts for different use cases
- Technical support, general assistant, etc.

### Visual Analysis Prompts
- Configure image analysis behavior
- Object detection, text recognition, scene analysis
- Custom prompts for specific use cases

## Security

- All API keys are stored server-side only
- No sensitive environment variables exposed to client
- Secure API routes handle all external service calls
- Row Level Security (RLS) enabled on all Supabase tables

## Browser Support

- Chrome/Edge: Full support (recommended)
- Firefox: Limited screen sharing support
- Safari: Limited features

## Troubleshooting

1. **Database Error**: Make sure you've run the database setup script in Supabase
2. **API Configuration Error**: Check that environment variables are set correctly
3. **Screen Sharing Failed**: Manually select camera mode if screen sharing is denied
4. **Voice Recognition**: Ensure microphone permissions are granted

## Development

The application gracefully handles missing database tables and will show appropriate warnings if the setup script hasn't been run yet.
