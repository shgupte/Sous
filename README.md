# Sous 

> **Your AI-powered cooking companion with voice-guided assistance**

Sous is a modern recipe management app that combines traditional recipe storage with cutting-edge AI voice assistance. Built with React Native and Expo, it provides a seamless cooking experience across mobile and web platforms.

## Features

###  Core Functionality
- **Recipe Management**: Add, view, edit, and delete your personal recipe collection
- **URL Recipe Parsing**: Automatically extract recipes from cooking websites and YouTube videos
- **Voice-Guided Cooking**: Real-time voice assistance during cooking with AI-powered responses
- **Cross-Platform**: Native mobile apps (iOS/Android) and web support
- **User Authentication**: Secure user accounts with Supabase integration

###  Voice Interface
- **Real-time Audio Streaming**: Continuous voice communication with AI assistant
- **Smart Recipe Context**: AI understands your current recipe and cooking progress
- **Multi-format Audio Support**: Handles both WAV and raw PCM audio formats
- **Cross-platform Audio**: Optimized for both mobile and web audio APIs
- **Live Audio Processing**: Real-time transcription and response generation

### User Experience
- **Modern UI/UX**: Clean, intuitive interface with dark/light theme support
- **Responsive Design**: Optimized for all screen sizes and orientations
- **Haptic Feedback**: Enhanced mobile interactions with tactile responses
- **Offline Capability**: Core functionality works without internet connection
- **Progressive Web App**: Installable web version with native app-like experience

##  Architecture

### Frontend (React Native + Expo)
```
sous/
├── app/                    # Screen components and navigation
│   ├── (tabs)/            # Tab-based navigation screens
│   ├── auth/              # Authentication screens
│   └── cooking.tsx        # Voice-guided cooking interface
├── components/            # Reusable UI components
│   ├── VoiceInterface.tsx # Core voice interaction component
│   ├── RecipeCard.tsx     # Recipe display component
│   └── AddRecipeModal.tsx # Recipe creation modal
├── hooks/                 # Custom React hooks
│   ├── useAuth.ts         # Authentication state management
│   └── useRecipes.ts      # Recipe data management
└── constants/             # App configuration and theming
```

### Backend (Python + FastAPI)
```
server/
├── src/
│   ├── main.py           # FastAPI application and endpoints
│   ├── pipeline.py       # AI processing pipeline
│   ├── ytparse.py        # YouTube transcript extraction
│   └── webparse.py       # Web recipe parsing
├── audio_data/           # Sample audio files for testing
└── requirements.txt      # Python dependencies
```

### Key Technologies
- **Frontend**: React Native, Expo, TypeScript, Supabase
- **Backend**: Python, FastAPI, WebSockets, ChromaDB
- **AI/ML**: Groq API, Deepgram SDK, YouTube Transcript API
- **Database**: Supabase (PostgreSQL), ChromaDB (vector storage)
- **Audio**: Expo AV, Web Audio API, Live Audio Stream

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- Expo CLI (`npm install -g @expo/cli`)
- Supabase account

### 1. Clone and Install
```bash
git clone <repository-url>
cd sous
npm install
```

### 2. Backend Setup
```bash
cd server
npm run setup  # Creates virtual environment and installs dependencies
```

### 3. Environment Configuration
Create `.env` file in the root directory:
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services (for backend)
GROQ_API_KEY=your_groq_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
```

### 5. Start Development Servers

**Backend Server:**
```bash
cd server
npm run dev  # Starts FastAPI server on http://localhost:8000
```

**Frontend App:**
```bash
npm start    # Starts Expo development server
```

### 6. Run on Your Platform
```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Web Browser
npm run web
```

## Usage Guide

### Getting Started
1. **Sign Up/Login**: Create an account or sign in with existing credentials
2. **Add Recipes**: Use the "+" button to manually add recipes or paste URLs to auto-parse
3. **Browse Recipes**: View your recipe collection in the Recipes tab
4. **Start Cooking**: Tap "Start Cooking" on any recipe to enter voice assistant mode

### Voice Assistant Features
- **Connect**: Tap "Connect" to establish connection with the AI server
- **Record**: Hold the microphone button to ask cooking questions
- **Listen**: Receive real-time audio responses with cooking guidance
- **Context-Aware**: The AI understands your current recipe and cooking progress

### Recipe Management
- **Manual Entry**: Add recipes with custom names and descriptions
- **URL Parsing**: Paste cooking website URLs to automatically extract recipes
- **YouTube Integration**: Extract recipes from cooking video transcripts
- **Organize**: View, edit, and delete recipes from your personal collection

##  Development

### Project Structure
The project uses a monorepo structure with workspaces:
- **Main App**: React Native/Expo frontend
- **Server**: Python FastAPI backend
- **Shared**: Common utilities and types

### Key Development Commands
```bash
# Frontend
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser
npm run lint       # Run ESLint

# Backend
cd server
npm run dev        # Start development server with hot reload
npm run start      # Start production server
npm run lint       # Run Python linting with Ruff
```

### Adding New Features
1. **New Screens**: Add to `app/` directory following Expo Router conventions
2. **Components**: Create reusable components in `components/` directory
3. **Hooks**: Add custom logic in `hooks/` directory
4. **API Endpoints**: Extend `server/src/main.py` with new FastAPI routes
5. **Database Changes**: Update Supabase schema and RLS policies

### Code Style
- **Frontend**: TypeScript with ESLint configuration
- **Backend**: Python with Ruff linting
- **Commits**: Follow conventional commit format
- **Testing**: Write tests for new features

##  Testing

### Frontend Testing
```bash
# Run linting
npm run lint

# Test on multiple platforms
npm run ios
npm run android
npm run web
```

### Backend Testing
```bash
cd server
# Run linting
npm run lint

# Test API endpoints
curl http://localhost:8000/health
curl http://localhost:8000/
```

### Voice Interface Testing
1. Start the backend server
2. Open the app and navigate to a recipe
3. Tap "Start Cooking" to access voice interface
4. Test connection, recording, and audio playback

##  Deployment

### Frontend Deployment
```bash
# Build for production
expo build:android
expo build:ios
expo build:web

# Deploy to Expo
expo publish
```

### Backend Deployment
```bash
cd server
# Deploy to your preferred platform (Heroku, Railway, etc.)
npm run start
```

### Environment Variables
Ensure all required environment variables are set in production:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY`

---

**Happy Cooking! 🍳✨**

Built with ❤️ using React Native, Expo, and Python
