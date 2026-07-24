"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"

/**
 * SessionRestorer - Simple placeholder for session restoration
 * 
 * This component serves as a marker for session restoration logic.
 * In FASE 1 (simple Firebase Auth), restoration is automatic via
 * Firebase's onAuthStateChanged listener in auth-context.tsx.
 * 
 * No manual restoration needed - Firebase handles persistence automatically.
 */
export function SessionRestorer() {
  const { user } = useAuth()

  // Session restoration is handled automatically by Firebase Auth
  // via onAuthStateChanged listener in auth-context.tsx
  // No manual intervention needed.

  return null
}
