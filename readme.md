# FlashChat - Snapchat Clone

A real-time messaging app built with React Native, Expo, and Firebase, featuring ephemeral messages, stories, and AI-powered features.

## Features

- 📸 **Camera & Media**: Take photos, select images/videos from gallery
- 💬 **Real-time Chat**: Direct messaging with friends
- 👻 **Disappearing Snaps**: Photos and videos that disappear after viewing
- 📖 **Stories**: Share moments that last 24 hours
- 🗺️ **Snap Map**: Share your location with friends
- 🤖 **AI Features**: Smart replies, caption suggestions, and friendship insights
- 🎨 **Media Editing**: Apply borders and backgrounds to snaps

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Expo Go app on your phone (for testing)
- Firebase account
- OpenAI API key (for AI features)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/flashchat.git
cd flashchat
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable the following services:
   - **Authentication** (Email/Password)
   - **Firestore Database**
   - **Storage**
4. Create a web app in your Firebase project
5. Copy your Firebase configuration

### 4. Create Configuration Files

#### OpenAI API Key Configuration

Create a file named `config.js` in the `services` directory:

```javascript
// services/config.js
export const OPENAI_API_KEY = 'your-openai-api-key-here';
```

**Important**: 
- Never commit this file to GitHub
- Add `services/config.js` to your `.gitignore` file
- Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

#### Firebase Configuration

The Firebase configuration is already in the project (`firebase.js`), but you should replace it with your own:

```javascript
// firebase.js
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-auth-domain",
    projectId: "your-project-id",
    storageBucket: "your-storage-bucket",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id",
    measurementId: "your-measurement-id"
};
```

### 5. Create .gitignore

Make sure your `.gitignore` includes:

```
node_modules/
.expo/
dist/
npm-debug.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/

# Config files with sensitive data
services/config.js
firebase-config.js

# macOS
.DS_Store

# Temporary files
*.log
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

### 6. Firebase Security Rules

Set up your Firestore security rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null;
    }
    
    // Authenticated users can create friend requests
    match /friendRequests/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Chat access for participants only
    match /chats/{chatId} {
      allow read, write: if request.auth != null 
        && request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read, write: if request.auth != null 
          && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      }
    }
    
    // Snaps access
    match /snaps/{snapId} {
      allow read: if request.auth != null && 
        (request.auth.uid == resource.data.recipientId || 
         request.auth.uid == resource.data.userId ||
         resource.data.type == 'story');
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.recipientId;
      allow delete: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == resource.data.recipientId);
    }
  }
}
```

Storage rules:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /snaps/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 7. Run the App

```bash
# Start the Expo development server
npx expo start

# Or clear cache if having issues
npx expo start -c
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## Project Structure

```
flashchat/
├── screens/              # All app screens
│   ├── CameraScreen.js  # Camera and media capture
│   ├── ChatListScreen.js # List of conversations
│   ├── ChatScreen.js    # Individual chat interface
│   ├── SnapsScreen.js   # View received snaps
│   ├── StoriesScreen.js # Browse stories
│   ├── MapScreen.js     # Location sharing
│   ├── ProfileScreen.js # User profile
│   └── ...auth screens
├── components/          # Reusable components
│   ├── AIAssistant.js  # AI-powered features
│   └── SnapRenderer.js # Media display component
├── services/           # External services
│   ├── OpenAIService.js # AI integration
│   └── config.js       # API keys (create this)
├── constants/          # App constants
│   └── Colors.js       # Color theme
├── firebase.js         # Firebase configuration
├── App.js             # Main app entry point
└── package.json       # Dependencies
```

## Features Guide

### Adding Friends
1. Go to Profile → Add Friends
2. Search by username
3. Send friend request
4. Accept incoming requests

### Sending Snaps
1. Take a photo or select media
2. Apply borders/backgrounds
3. Select friends or post to story
4. Send!

### AI Features
1. **Smart Replies**: Get suggested replies when viewing snaps
2. **Caption Suggestions**: AI-generated captions based on context
3. **Friendship Insights**: Personalized insights based on chat patterns
4. **Story Ideas**: Get creative suggestions for stories

### Setting Preferences
1. Go to Profile → My Preferences
2. Set your communication style
3. Add interests
4. Save to get personalized AI recommendations

## Troubleshooting

### Camera not working
- Make sure you've granted camera permissions
- For web: Allow camera access in browser
- For Expo Go: Check app permissions in phone settings

### Firebase errors
- Verify your Firebase configuration is correct
- Check that all Firebase services are enabled
- Ensure security rules are properly set

### AI features not working
- Verify `config.js` exists with valid OpenAI API key
- Check console for API errors
- Ensure you have API credits on OpenAI

### Build errors
```bash
# Clear all caches
rm -rf node_modules
rm -rf .expo
npm cache clean --force
npm install
npx expo start -c
```

## Deployment

### For Development Testing
The app runs directly through Expo Go for testing.

### For Production
1. Create a Firebase Functions deployment for auto-cleanup:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

2. Build for production:
   ```bash
   # For iOS
   eas build --platform ios

   # For Android  
   eas build --platform android
   ```

## Environment Variables (Alternative Setup)

Instead of `config.js`, you can use environment variables:

1. Create `.env` file:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

2. Install expo-env:
   ```bash
   npx expo install expo-env
   ```

3. Update imports to use `process.env.OPENAI_API_KEY`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Notes

- **Never commit API keys** to version control
- Use environment variables for sensitive data
- Enable Firebase App Check for production
- Implement rate limiting for API calls
- Regular security audits of Firebase rules

## License

This project is for educational purposes. Please respect Snapchat's intellectual property and use this only for learning.

## Acknowledgments

- Built with [Expo](https://expo.dev/)
- Powered by [Firebase](https://firebase.google.com/)
- AI features by [OpenAI](https://openai.com/)
- Inspired by Snapchat's innovative features