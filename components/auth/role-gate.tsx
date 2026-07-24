import { ReactNode } from "react"
import { usePermissions } from "@/hooks/use-permissions"
import { type Permission } from "@/lib/auth/permissions"

interface RoleGateProps {
  /** Show content only if user has this permission */
  permission?: Permission
  /** Show content only if user has one of these roles */
  roles?: Array<"super_admin" | "admin_global" | "admin" | "cajero" | "mesero" | "cocina">
  /** Fallback UI when user doesn't have permission */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * RoleGate - Control component visibility based on permissions
 * 
 * Usage with permission:
 * <RoleGate permission="access_admin_panel">
 *   <AdminPanel />
 * </RoleGate>
 * 
 * Usage with roles:
 * <RoleGate roles={["admin", "super_admin"]}>
 *   <UserManagement />
 * </RoleGate>
 */
export function RoleGate({ permission, roles, fallback = null, children }: RoleGateProps) {
  const { has, user } = usePermissions()
  
  // Check permission if specified
  if (permission !== undefined) {
    const hasPermission = has(permission)
    return hasPermission ? <>{children}</> : <>{fallback}</>
  }
  
  // Check role if specified
  if (roles !== undefined && user) {
    const hasRole = roles.includes(user.role as any)
    return hasRole ? <>{children}</> : <>{fallback}</>
  }
  
  // No restrictions - show children
  return <>{children}</>
}

interface AdminPanelGateProps {
  /** Fallback UI when user can't access admin panel */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * AdminPanelGate - Convenience wrapper for admin panel access
 * 
 * Usage:
 * <AdminPanelGate>
 *   <AdminDashboard />
 * </AdminPanelGate>
 */
export function AdminPanelGate({ fallback = null, children }: AdminPanelGateProps) {
  const { can } = usePermissions()
  
  return can.accessAdminPanel() ? <>{children}</> : <>{fallback}</>
}

interface KitchenViewGateProps {
  /** Fallback UI when user can't view kitchen */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * KitchenViewGate - Convenience wrapper for kitchen view access
 * 
 * Usage:
 * <KitchenViewGate>
 *   <KitchenDashboard />
 * </KitchenViewGate>
 */
export function KitchenViewGate({ fallback = null, children }: KitchenViewGateProps) {
  const { can } = usePermissions()
  
  return can.viewKitchen() ? <>{children}</> : <>{fallback}</>
}

interface PaymentGateProps {
  /** Fallback UI when user can't process payments */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * PaymentGate - Convenience wrapper for payment processing access
 * 
 * Usage:
 * <PaymentGate>
 *   <CheckoutButton />
 * </PaymentGate>
 */
export function PaymentGate({ fallback = null, children }: PaymentGateProps) {
  const { can } = usePermissions()
  
  return can.processPayments() ? <>{children}</> : <>{fallback}</>
}
