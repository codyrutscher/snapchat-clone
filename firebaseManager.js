import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyCg7ktI0wtqhfnC3PauIJNYURoaqT0kY0Q",
    authDomain: "snapchat-clone-5ee63.firebaseapp.com",
    projectId: "snapchat-clone-5ee63",
    storageBucket: "snapchat-clone-5ee63.firebasestorage.app",
    messagingSenderId: "826725808597",
    appId: "1:826725808597:web:fe58dacd796df267c2e55c",
    measurementId: "G-1NF1W95RF5"
};

class FirebaseManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.db = null;
        this.storage = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            this.app = initializeApp(firebaseConfig);
            
            // Add a small delay to ensure proper initialization
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            this.storage = getStorage(this.app);
            
            this.initialized = true;
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    }

    getAuth() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.auth;
    }

    getDb() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.db;
    }

    getStorage() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.storage;
    }
}

const firebaseManager = new FirebaseManager();

export default firebaseManager;