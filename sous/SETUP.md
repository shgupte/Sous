# Sous Recipe App Setup Guide

## Overview
Sous is a recipe management app with voice-guided cooking assistance. It allows users to save recipes, view them, and get voice assistance while cooking.

## Features
- User authentication with Supabase
- Recipe management (add, view, delete)
- Voice-guided cooking assistance
- Dark/light theme support
- Responsive design

## Prerequisites
- Node.js and npm installed
- Expo CLI installed
- Supabase account and project

## Supabase Setup

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key

### 2. Database Tables
Create the following tables in your Supabase database:

#### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Recipes Table
```sql
CREATE TABLE recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Row Level Security (RLS)
Enable RLS and create policies:

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Recipes policies
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipes" ON recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (auth.uid() = user_id);
```

### 4. Environment Variables
Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your preferred platform:
```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## App Structure

### Authentication Flow
- Users must sign up/login to access the app
- Authentication state is managed globally
- Automatic redirects based on auth state

### Main Screens
- **Home**: Welcome screen with quick actions and recent recipes
- **Recipes**: List of user's recipes with add/delete functionality
- **Profile**: User profile and sign out option

### Recipe Management
- Add new recipes with name and description
- View full recipe details
- Delete recipes with confirmation
- Start cooking mode with voice assistance

### Voice Interface
- Integrated with existing VoiceInterface component
- Provides cooking assistance and guidance
- Accessible from recipe detail and cooking screens

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Add Recipes**: Use the "+" button to add new recipes
3. **View Recipes**: Browse your recipe collection
4. **Start Cooking**: Tap "Start Cooking" to enter voice assistant mode
5. **Voice Assistance**: Ask questions about cooking steps, substitutions, etc.

## Development

### Key Files
- `constants/Supabase.ts`: Supabase client configuration
- `hooks/useAuth.ts`: Authentication hook
- `hooks/useRecipes.ts`: Recipe management hook
- `components/`: Reusable UI components
- `app/`: Screen components and navigation

### Adding Features
- New screens: Add to `app/` directory
- New components: Add to `components/` directory
- New hooks: Add to `hooks/` directory
- Database changes: Update Supabase schema and policies

## Troubleshooting

### Common Issues
1. **Authentication errors**: Check Supabase URL and key
2. **Database errors**: Verify RLS policies are set up correctly
3. **Voice interface issues**: Check microphone permissions

### Debug Mode
Enable debug logging by setting environment variables or checking console output.

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License
This project is licensed under the MIT License.
