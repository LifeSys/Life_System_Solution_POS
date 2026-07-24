"use client"

import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Building2, MapPin } from "lucide-react"

/**
 * StoreInfo - Displays current store and access level information
 * 
 * Shows:
 * - Current store name and code
 * - Number of accessible stores (for admin_global)
 * - User role
 */
export function StoreInfo() {
  const { user, store, allAccessibleStores } = useAuth()

  if (!user || !store) {
    return null
  }

  const isMultiStore = user.role === "admin_global" && allAccessibleStores.length > 1
  const roleLabel =
    user.role === "admin_global"
      ? "Administrador Global"
      : user.role === "super_admin"
        ? "Super Administrador"
        : user.role === "admin"
          ? "Administrador"
          : user.role.charAt(0).toUpperCase() + user.role.slice(1)

  return (
    <div className="flex items-center gap-3">
      <Card className="px-3 py-2 bg-muted/50 border-border/50">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <div className="text-sm">
            <p className="font-medium text-foreground">{store.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Código: {store.code}
            </p>
          </div>
        </div>
      </Card>

      {isMultiStore && (
        <Badge variant="secondary" className="whitespace-nowrap">
          {allAccessibleStores.length} locales
        </Badge>
      )}

      <Badge variant="outline" className="whitespace-nowrap">
        {roleLabel}
      </Badge>
    </div>
  )
}
