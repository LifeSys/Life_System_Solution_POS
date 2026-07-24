import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyDZVwR59Tfg6UNrH13PHftuodIx2Zyyd28",
  authDomain: "multipizza-core.firebaseapp.com",
  projectId: "multipizza-core",
  storageBucket: "multipizza-core.firebasestorage.app",
  messagingSenderId: "475852672554",
  appId: "1:475852672554:web:16ef2e753ed4c6a844bd53"
}

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

