import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: "AIzaSyCg7ktI0wtqhfnC3PauIJNYURoaqT0kY0Q",
    authDomain: "snapchat-clone-5ee63.firebaseapp.com",
    projectId: "snapchat-clone-5ee63",
    storageBucket: "snapchat-clone-5ee63.firebasestorage.app",
    messagingSenderId: "826725808597",
    appId: "1:826725808597:web:fe58dacd796df267c2e55c",
    measurementId: "G-1NF1W95RF5"
};

// Initialize Firebase app only once
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

// Initialize Auth with platform-specific persistence
let auth;
if (Platform.OS === 'web') {
    // For web, use browser persistence
    auth = initializeAuth(app, {
        persistence: browserLocalPersistence
    });
} else {
    // For mobile (iOS/Android), use AsyncStorage
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
}

// Initialize other services
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };