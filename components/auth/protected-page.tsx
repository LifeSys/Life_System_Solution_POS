"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"

interface ProtectedPageProps {
  children: React.ReactNode
  requiredRole?: "admin" | "mesero" | "cocina" | "cajero" | "super_admin"
}

/**
 * ProtectedPage - Wraps pages that require authentication
 * 
 * Usage:
 * <ProtectedPage requiredRole="admin">
 *   <AdminPage />
 * </ProtectedPage>
 */
export function ProtectedPage({ children, requiredRole }: ProtectedPageProps) {
  const router = useRouter()
  const { user, store } = useAuth()

  useEffect(() => {
    // Not logged in - redirect to login
    if (!user || !store) {
      router.push("/")
      return
    }

    // Check role if required
    if (requiredRole && user) {
      const hasRequiredRole = 
        user.role === requiredRole ||
        user.role === "admin" ||
        user.role === "super_admin"

      if (!hasRequiredRole) {
        router.push("/")
      }
    }
  }, [user, store, requiredRole, router])

  // Show loading while checking auth
  if (!user || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
