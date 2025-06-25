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


# FlashChat - Connect, Share, Disappear

<p align="center">
  <img src="assets/icon.png" alt="FlashChat Logo" width="120" height="120">
</p>

<p align="center">
  <strong>A Snapchat-inspired social messaging app with AI-powered features</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#user-stories">User Stories</a> •
  <a href="#installation">Installation</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#demo">Demo</a>
</p>

---

## 🌟 About FlashChat

FlashChat is a modern social messaging application that combines the ephemeral nature of Snapchat with cutting-edge AI features. Built with React Native and Firebase, it offers a seamless cross-platform experience for iOS, Android, and Web.

## 🎯 User Stories

### 1. 📸 Capture & Share Moments
**"As a user, I want to send photos and videos that disappear after viewing, so I can share moments privately without worrying about permanent storage."**

- Send photos that auto-delete after 15 seconds
- Share videos from your gallery
- Add filters, borders, and backgrounds to your snaps
- Control who sees your content

### 2. ✨ AI-Powered Features
**"As a user, I want AI to help me create better content and connect with the right people, so I can have more meaningful interactions."**

- Get intelligent caption suggestions based on context
- Receive friend recommendations based on shared interests
- Smart reply suggestions for quick responses
- AI-powered content moderation for safety

### 3. 👥 Connect with Friends
**"As a user, I want to chat with friends individually or in groups, so I can maintain different types of social connections."**

- Real-time messaging with friends
- Create group chats with multiple participants
- Share 24-hour stories visible to all friends
- See when messages are read

### 4. 📍 Discover Nearby
**"As a user, I want to discover trending content and connect with people nearby, so I can expand my social circle based on location."**

- View trending snaps from your area
- Share your location on Snap Map (with privacy controls)
- Discover content based on proximity
- Find events and moments happening around you

### 5. 🛡️ Safe & Moderated
**"As a user, I want to feel safe while using the app, so I can enjoy social interactions without exposure to harmful content."**

- AI-powered content moderation blocks inappropriate content
- Block users who make you uncomfortable
- Report inappropriate behavior
- Privacy settings to control who can contact you

### 6. 💖 Personalized Experience
**"As a user, I want the app to understand my preferences, so I get recommendations that match my interests and communication style."**

- Personalized posting time recommendations
- Friendship insights and communication patterns
- Content suggestions based on your interests
- Adaptive AI that learns your preferences

## 🚀 Features

### Core Features
- **Ephemeral Messaging**: Photos and videos that disappear after viewing
- **Stories**: 24-hour temporary posts
- **Real-time Chat**: Instant messaging with typing indicators
- **Friend System**: Add friends, manage requests, block users
- **AI Assistant**: Smart captions, replies, and insights
- **Content Discovery**: Trending and nearby content
- **Privacy Controls**: Comprehensive privacy settings

### AI-Powered Features
- **Smart Caption Generator**: Context-aware caption suggestions
- **Friend Recommendations**: AI-matched friend suggestions
- **Best Time to Post**: Engagement-based posting recommendations
- **Friendship Insights**: Analytics about your social patterns
- **Content Moderation**: Automatic inappropriate content detection

## 🛠️ Tech Stack

### Frontend
- **React Native**: Cross-platform mobile development
- **Expo SDK 53**: Development framework
- **React Navigation**: App navigation
- **Expo Camera**: Media capture
- **Expo AV**: Video playback

### Backend
- **Firebase Auth**: User authentication
- **Firebase Firestore**: Real-time database
- **Firebase Storage**: Media storage
- **Firebase Cloud Functions**: Server-side logic

### AI Integration
- **OpenAI API**: GPT-powered features
- **Content Moderation API**: Safety features

## 📱 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/flashchat.git
cd flashchat
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key
```

4. **Update Firebase configuration**
Replace the Firebase config in `firebase.js` with your own Firebase project credentials.

5. **Start the development server**
```bash
expo start
```

6. **Run on your device**
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## 🔧 Configuration

### Firebase Setup
1. Create a new Firebase project
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Enable Storage
5. Copy your config to `firebase.js`

### OpenAI Setup
1. Get an API key from OpenAI
2. Add it to your environment variables
3. Update `config.js` with your key

## 📸 Screenshots

<p align="center">
  <img src="screenshots/login.png" alt="Login Screen" width="250">
  <img src="screenshots/camera.png" alt="Camera Screen" width="250">
  <img src="screenshots/chat.png" alt="Chat Screen" width="250">
</p>

## 🎥 Demo

[Watch the 5-minute demo video](#) showcasing:
- Account creation and login
- Sending ephemeral messages
- AI-powered caption suggestions
- Friend recommendations
- Content moderation in action
- Story creation and viewing

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Snapchat's ephemeral messaging concept
- OpenAI for powering our AI features
- The React Native and Expo communities
- All contributors who have helped shape FlashChat

## 📞 Contact

- **Project Link**: [https://github.com/yourusername/flashchat](https://github.com/yourusername/flashchat)
- **Issues**: [GitHub Issues](https://github.com/yourusername/flashchat/issues)
- **Email**: support@flashchat.app

---

<p align="center">
  Made with ❤️ by the FlashChat Team
</p>
