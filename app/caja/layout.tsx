"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { POSHeader } from "@/components/pos-header"

export default function CajaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { firebaseUser, user, store, isCajero } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!firebaseUser || !user || !store) {
      router.push("/")
    } else if (!isCajero) {
      router.push("/")
    }
  }, [firebaseUser, user, store, isCajero, router])

  if (!firebaseUser || !user || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-12 w-12 text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <POSHeader title="Caja" />
      <main className="p-3 sm:p-4">{children}</main>
    </div>
  )
}
