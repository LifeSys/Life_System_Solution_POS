import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChiIbNEwdaaCbGmk4suA9y88OELEWiAOc",
  authDomain: "lifesystemsolution.firebaseapp.com",
  projectId: "lifesystemsolution",
  storageBucket: "lifesystemsolution.firebasestorage.app",
  messagingSenderId: "584706598607",
  appId: "1:584706598607:web:3d705120271495a807f9ba",
};

// Initialize Firebase only if it hasn't been initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const db = getFirestore(app)
export const auth = getAuth(app)

// Set Firebase Auth persistence to browserLocalPersistence
// This ensures auth state persists across page refreshes and browser restarts
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Failed to set Firebase Auth persistence:", error)
})

export default app

