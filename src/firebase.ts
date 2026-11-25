/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCb8tgF8KI0RAsiBqfcgTizZ2LvK9Tk6Lo",
  authDomain: "clever-catcher-p09p9.firebaseapp.com",
  projectId: "clever-catcher-p09p9",
  storageBucket: "clever-catcher-p09p9.firebasestorage.app",
  messagingSenderId: "1025480877123",
  appId: "1:1025480877123:web:6df50482a8ea45608da0f6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
// Use the specific firestore database ID provided in the config
export const db = getFirestore(app, "ai-studio-44d0513f-99c8-48ed-9d0a-3058edb4b6b9");
