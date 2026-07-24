"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { POSHeader } from "@/components/pos-header"

export default function ComprobantesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { firebaseUser, user, store, isCajero, isAdmin, isSuperAdmin } = useAuth()
  const router = useRouter()

  const tieneAcceso = isCajero || isAdmin || isSuperAdmin

  useEffect(() => {
    if (!firebaseUser || !user || !store) {
      router.push("/")
    } else if (!tieneAcceso) {
      router.push("/")
    }
  }, [firebaseUser, user, store, tieneAcceso, router])

  if (!firebaseUser || !user || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-12 w-12 text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <POSHeader title="Comprobantes" />
      <main className="p-3 sm:p-4">{children}</main>
    </div>
  )
}
