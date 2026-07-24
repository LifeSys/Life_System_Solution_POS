"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { POSHeader } from "@/components/pos-header"

export default function MeseroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { firebaseUser, user, store, isMesero } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!firebaseUser || !user || !store) {
      router.push("/")
    } else if (!isMesero) {
      router.push("/")
    }
  }, [firebaseUser, user, store, isMesero, router])

  if (!firebaseUser || !user || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-12 w-12 text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <POSHeader title="Mesero" />
      <main className="p-3 sm:p-4">{children}</main>
    </div>
  )
}
