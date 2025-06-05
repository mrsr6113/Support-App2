# AI Vision Chat

Voice-enabled AI vision chat application with screen sharing and camera support.

## Features

- 🎤 **Voice Input**: Natural language voice commands and conversation
- 🖥️ **Screen Sharing**: Capture and analyze screen content
- 📷 **Camera Support**: Real-time camera feed analysis
- 💬 **Real-time Chat**: Interactive conversation with AI
- 🔊 **Text-to-Speech**: Audio responses from AI
- 🌐 **Multi-language**: Support for multiple languages

## Setup

1. **Environment Variables**
   
   Create a `.env.local` file in the root directory:
   \`\`\`env
   GEMINI_API_KEY=your_gemini_api_key_here
   GOOGLE_TTS_API_KEY=your_google_tts_api_key_here
   \`\`\`

2. **API Keys**
   
   - **Gemini API**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **Google TTS API**: Get from [Google Cloud Console](https://console.cloud.google.com/)

3. **Installation**
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

## Security

- All API keys are stored server-side only
- No sensitive environment variables exposed to client
- Secure API routes handle all external service calls

## Browser Support

- Chrome/Edge: Full support (recommended)
- Firefox: Limited screen sharing support
- Safari: Limited features

## Troubleshooting

1. **API Configuration Error**: Check that environment variables are set correctly
2. **Screen Sharing Failed**: Manually select camera mode if screen sharing is denied
3. **Voice Recognition**: Ensure microphone permissions are granted
