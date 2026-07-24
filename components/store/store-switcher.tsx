"use client"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Building2 } from "lucide-react"

/**
 * StoreSwitcher - Allows admin_global users to switch between assigned stores
 * 
 * Usage:
 * <StoreSwitcher />
 * 
 * Only displays if user is admin_global with multiple accessible stores
 */
export function StoreSwitcher() {
  const { user, store, allAccessibleStores, switchStore, isLoading } = useAuth()

  // Only show for admin_global users with multiple stores
  if (user?.role !== "admin_global" || !allAccessibleStores || allAccessibleStores.length <= 1) {
    return null
  }

  const handleStoreChange = async (storeId: string) => {
    const selectedStore = allAccessibleStores.find((s) => s.id === storeId)
    if (selectedStore) {
      await switchStore(selectedStore)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={store?.id || ""} onValueChange={handleStoreChange} disabled={isLoading}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Seleccionar local" />
        </SelectTrigger>
        <SelectContent>
          {allAccessibleStores.map((s) => (
            <SelectItem key={s.id} value={s.id || ""}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
