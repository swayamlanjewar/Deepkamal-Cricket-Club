import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// Using Vite's import.meta.env, with placeholders that the user can replace.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Check if variables are valid (not empty, not template placeholders starting with 'your-' or containing '...')
const isConfigValid = 
  firebaseConfig.apiKey && 
  !firebaseConfig.apiKey.includes("...") && 
  !firebaseConfig.apiKey.startsWith("your-") &&
  firebaseConfig.projectId;

let app = null;
let db = null;
let auth = null;
let storage = null;

if (isConfigValid) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    
    const isDevelopment = import.meta.env.DEV;
    const isLocalhost = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || 
       window.location.hostname === "127.0.0.1" || 
       window.location.hostname.startsWith("192.168."));

    if (isDevelopment && isLocalhost) {
      connectFirestoreEmulator(db, "localhost", 8080);
      connectAuthEmulator(auth, "http://localhost:9099");
      connectStorageEmulator(storage, "localhost", 9199);
      console.log("Connected to Firebase Local Emulator Suite!");
    } else {
      console.log("Firebase initialized successfully using configured environment variables!");
    }
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }
} else {
  console.warn(
    "Firebase configuration keys are missing or invalid. Falling back to local mock database (localStorage) for seamless preview. " +
    "To use real Firebase, add your variables to a .env file (e.g. VITE_FIREBASE_API_KEY) or modify src/lib/firebase.js."
  );
}

export { db, auth, storage, isConfigValid };
