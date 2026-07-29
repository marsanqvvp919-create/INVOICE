import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAULDMlYSMamo__Px5zJDgR-7KVig1jo7E",
  authDomain: "gen-lang-client-0380911225.firebaseapp.com",
  projectId: "gen-lang-client-0380911225",
  storageBucket: "gen-lang-client-0380911225.firebasestorage.app",
  messagingSenderId: "511368166774",
  appId: "1:511368166774:web:0a01c3e3c0465771ac0e57"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom databaseId if configured
const db = initializeFirestore(app, {}, "ai-studio-8e29c8d6-3916-46d7-97f3-727e186cd1e1");

export { app, db };
export default db;
