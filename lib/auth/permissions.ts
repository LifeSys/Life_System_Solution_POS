import { type User } from "@/lib/firebase/firestore"

/**
 * Role-based permission system for MultiPizza POS
 * 
 * Roles:
 * - super_admin: Full access to all stores and admin functions
 * - admin_global: Access to multiple assigned stores' admin functions
 * - admin: Single store admin (manage users, reports, settings)
 * - cajero: Cash register/payments (create orders, process payments)
 * - mesero: Floor staff (take orders, view menu)
 * - cocina: Kitchen (view orders, mark as prepared)
 */

export type UserRole = "super_admin" | "admin_global" | "admin" | "cajero" | "mesero" | "cocina"

export type Permission = 
  | "view_dashboard"
  | "manage_users"
  | "manage_stores"
  | "view_reports"
  | "process_payments"
  | "create_orders"
  | "view_menu"
  | "manage_menu"
  | "view_kitchen"
  | "manage_kitchen"
  | "access_admin_panel"

/**
 * Define which permissions each role has
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    "view_dashboard",
    "manage_users",
    "manage_stores",
    "view_reports",
    "process_payments",
    "create_orders",
    "view_menu",
    "manage_menu",
    "view_kitchen",
    "manage_kitchen",
    "access_admin_panel",
  ],
  admin_global: [
    "view_dashboard",
    "manage_users",
    "view_reports",
    "process_payments",
    "create_orders",
    "view_menu",
    "manage_menu",
    "view_kitchen",
    "manage_kitchen",
    "access_admin_panel",
  ],
  admin: [
    "view_dashboard",
    "manage_users",
    "view_reports",
    "process_payments",
    "create_orders",
    "view_menu",
    "manage_menu",
    "view_kitchen",
    "manage_kitchen",
    "access_admin_panel",
  ],
  cajero: [
    "view_dashboard",
    "process_payments",
    "create_orders",
    "view_menu",
    "view_kitchen",
  ],
  mesero: [
    "create_orders",
    "view_menu",
  ],
  cocina: [
    "view_menu",
    "view_kitchen",
    "manage_kitchen",
  ],
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false
  
  const userPermissions = ROLE_PERMISSIONS[user.role] || []
  return userPermissions.includes(permission)
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false
  
  const userPermissions = ROLE_PERMISSIONS[user.role] || []
  return permissions.some((p) => userPermissions.includes(p))
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  if (!user) return false
  
  const userPermissions = ROLE_PERMISSIONS[user.role] || []
  return permissions.every((p) => userPermissions.includes(p))
}

/**
 * Check if user can access a specific store
 * - super_admin: can access all stores
 * - admin_global: can access assigned stores (managed separately)
 * - others: can only access their assigned store
 */
export function canAccessStore(user: User | null, storeId: string): boolean {
  if (!user) return false
  
  // Super admin can access all stores
  if (user.role === "super_admin") return true
  
  // admin_global will need to check assigned stores list (managed separately)
  if (user.role === "admin_global") return true
  
  // All other roles can only access their assigned store
  return user.storeId === storeId
}

/**
 * Check if user can access admin panel
 */
export function canAccessAdminPanel(user: User | null): boolean {
  return hasPermission(user, "access_admin_panel")
}

/**
 * Check if user can manage other users
 */
export function canManageUsers(user: User | null): boolean {
  return hasPermission(user, "manage_users")
}

/**
 * Check if user can manage stores (only super_admin)
 */
export function canManageStores(user: User | null): boolean {
  return hasPermission(user, "manage_stores")
}

/**
 * Check if user can process payments
 */
export function canProcessPayments(user: User | null): boolean {
  return hasPermission(user, "process_payments")
}

/**
 * Check if user can create orders
 */
export function canCreateOrders(user: User | null): boolean {
  return hasPermission(user, "create_orders")
}

/**
 * Check if user can view kitchen orders
 */
export function canViewKitchen(user: User | null): boolean {
  return hasPermission(user, "view_kitchen")
}

/**
 * Check if user can manage kitchen (mark orders ready, etc)
 */
export function canManageKitchen(user: User | null): boolean {
  return hasPermission(user, "manage_kitchen")
}

/**
 * Get description of user's role
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    super_admin: "Super Administrador - Acceso total a todos los locales",
    admin_global: "Administrador Global - Gestión de múltiples locales",
    admin: "Administrador - Gestión del local",
    cajero: "Cajero - Procesamiento de pagos",
    mesero: "Mesero - Toma de pedidos",
    cocina: "Cocina - Preparación de pedidos",
  }
  return descriptions[role] || "Usuario"
}

/**
 * Get all available roles (for UI dropdowns)
 */
export function getAvailableRoles(): UserRole[] {
  return ["super_admin", "admin_global", "admin", "cajero", "mesero", "cocina"]
}
