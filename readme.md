# DevChat - Developer Social Media Platform

DevChat is a developer-focused social media application that combines the ephemeral messaging features of Snapchat with code sharing capabilities. Built with React Native and Firebase, it enables developers to share code snippets, connect with other developers, and communicate through snaps and stories.

## Features

- 📸 **Snaps & Stories**: Share ephemeral photos and videos with friends
- 💻 **Code Snippets**: Create, edit, and share code snippets in multiple programming languages
- 🤖 **AI Integration**: Generate code snippets and captions using OpenAI
- 🔍 **Discover Feed**: Find and import code snippets from the community
- 💬 **Real-time Chat**: Send messages and code snippets to friends
- 🎯 **Developer Matching**: Connect with developers based on shared interests and technologies
- 💳 **Subscription System**: Free tier with limits, Pro tier for unlimited access

## Tech Stack

- **Frontend**: React Native, Expo
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **AI**: OpenAI API
- **Media**: Cloudinary for image/video storage
- **Payments**: PayPal for subscriptions

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Firebase account
- OpenAI API key
- Cloudinary account

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/devchat.git
cd devchat
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Environment

Create a `firebase.js` file in the root directory with your Firebase configuration:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 4. Set Up API Keys

Update `services/config.js` with your OpenAI API key:

```javascript
export const OPENAI_API_KEY = 'your-openai-api-key';
```

Update `services/cloudinaryConfig.js` with your Cloudinary credentials:

```javascript
export const CLOUDINARY_CLOUD_NAME = 'your-cloud-name';
export const CLOUDINARY_UPLOAD_PRESET = 'your-upload-preset';
```

### 5. Firebase Setup

1. Create a new Firebase project
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Set up the following collections:
   - `users`
   - `snaps`
   - `chats`
   - `messages`
   - `sharedSnippets`
   - `codeSharing`
   - `discoverFeed`

### 6. Run the Application

```bash
expo start
# or
npm start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on your phone

## User Stories

### 1. Code Snippet Management
**As a developer**, I want to create and manage code snippets in multiple programming languages, so that I can organize and share my code effectively.

**Acceptance Criteria:**
- Create new code snippets with syntax highlighting
- Support for 12+ programming languages
- Edit and save snippets locally
- Delete unwanted snippets
- AI-powered code generation

### 2. Social Code Sharing
**As a developer**, I want to share my code snippets with the community and discover snippets from other developers, so that I can learn from others and showcase my work.

**Acceptance Criteria:**
- Share snippets to personal story (24-hour visibility)
- Share snippets to Discover feed (permanent)
- Browse and import snippets from other developers
- Filter Discover feed by programming language
- Track views and shares on snippets

### 3. Developer Networking
**As a developer**, I want to connect with other developers who share similar interests and technologies, so that I can build a relevant professional network.

**Acceptance Criteria:**
- Smart friend suggestions based on:
  - Programming languages used
  - Shared code patterns
  - Activity overlap
- Send and accept friend requests
- View friendship insights powered by AI
- Block/unblock users

### 4. Ephemeral Communication
**As a developer**, I want to send disappearing photos, videos, and code snippets to my friends, so that I can share moments and code casually.

**Acceptance Criteria:**
- Send snaps with photos/videos
- Add AI-generated captions
- Set custom expiration times
- Send code snippets via chat
- Real-time message delivery

### 5. Subscription Management
**As a developer**, I want to upgrade to a Pro subscription to access unlimited features, so that I can use the app without restrictions.

**Acceptance Criteria:**
- Free tier: 20 snaps, stories, and code snippets per month
- Pro tier: Unlimited access to all features
- PayPal integration for payments
- Real-time usage tracking
- Monthly limit reset

### 6. Personalized AI Features
**As a developer**, I want AI-powered features that understand my coding style and social patterns, so that I get personalized suggestions and insights.

**Acceptance Criteria:**
- AI-generated code based on personal coding patterns
- Smart caption suggestions for snaps
- Friendship insights and compatibility scores
- Code recommendation based on friend activity
- Context-aware AI responses

## Project Structure

```
devchat/
├── components/          # Reusable React components
│   ├── AIAssistant.js  # AI features component
│   ├── Camera.js       # Camera functionality
│   ├── Chat.js         # Chat interface
│   └── ...
├── screens/            # Screen components
│   ├── LoginScreen.js
│   ├── HomeScreen.js
│   ├── CodeSnippetScreen.js
│   └── ...
├── services/           # Business logic and API services
│   ├── OpenAIService.js
│   ├── CodeSnippetService.js
│   ├── SubscriptionService.js
│   └── ...
├── constants/          # App constants and theme
│   └── Colors.js
├── navigation/         # Navigation configuration
│   └── AppNavigator.js
└── firebase.js         # Firebase configuration
```

## Key Features Implementation

### Code Snippet System
- Local storage with AsyncStorage
- Syntax highlighting for multiple languages
- Share to story or discover feed
- Import snippets from other users

### AI Integration
- OpenAI GPT-3.5 for code generation
- Context-aware responses using RAG
- Personalized suggestions based on user patterns

### Subscription System
- Free tier with monthly limits
- Pro tier with unlimited access
- Automatic monthly reset
- Real-time usage tracking

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@devchat.app or join our Discord server.

## Acknowledgments

- React Native and Expo teams
- Firebase for backend infrastructure
- OpenAI for AI capabilities
- All contributors and testers