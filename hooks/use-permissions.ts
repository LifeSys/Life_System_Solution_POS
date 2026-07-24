import { useAuth } from "@/contexts/auth-context"
import { type Permission } from "@/lib/auth/permissions"

/**
 * Hook to easily check permissions in components
 * 
 * Usage:
 * const { can } = usePermissions()
 * 
 * if (can.accessAdminPanel()) {
 *   return <AdminPanel />
 * }
 */
export function usePermissions() {
  const auth = useAuth()
  
  return {
    // Individual permission checks
    has: (permission: Permission) => auth.hasPermission(permission),
    
    // Specific permission shortcuts
    can: {
      accessAdminPanel: () => auth.canAccessAdminPanel(),
      manageUsers: () => auth.canManageUsers(),
      processPayments: () => auth.canProcessPayments(),
      createOrders: () => auth.canCreateOrders(),
      viewKitchen: () => auth.canViewKitchen(),
      manageKitchen: () => auth.canManageKitchen(),
      accessStore: (storeId: string) => auth.canAccessStore(storeId),
    },
    
    // Legacy role checks (still supported for backward compatibility)
    role: {
      isSuperAdmin: auth.isSuperAdmin,
      isAdmin: auth.isAdmin,
      isCajero: auth.isCajero,
      isMesero: auth.isMesero,
      isCocina: auth.isCocina,
    },
    
    // User info
    user: auth.user,
    store: auth.store,
  }
}
