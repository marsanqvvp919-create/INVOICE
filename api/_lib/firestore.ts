// サーバー側（Vercel Functions）から画面と同じ Firestore を使う（設定は src/lib/firebase.ts と同じ）
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const app = getApps().length === 0
  ? initializeApp({
      apiKey: 'AIzaSyAULDMlYSMamo__Px5zJDgR-7KVig1jo7E',
      authDomain: 'gen-lang-client-0380911225.firebaseapp.com',
      projectId: 'gen-lang-client-0380911225',
      storageBucket: 'gen-lang-client-0380911225.firebasestorage.app',
      messagingSenderId: '511368166774',
      appId: '1:511368166774:web:0a01c3e3c0465771ac0e57',
    })
  : getApp();

export const db = initializeFirestore(app, {}, 'ai-studio-8e29c8d6-3916-46d7-97f3-727e186cd1e1');
