import { type User } from "@/lib/firebase/firestore"
import { 
  hasPermission, 
  canAccessStore,
  type Permission 
} from "@/lib/auth/permissions"

/**
 * Server/API-side permission validation utilities
 * These should be used to validate permissions before performing actions
 */

export class PermissionError extends Error {
  constructor(message: string, public permission?: Permission) {
    super(message)
    this.name = "PermissionError"
  }
}

/**
 * Validate that user has permission for an action
 * Throws PermissionError if not authorized
 * 
 * Usage:
 * validatePermission(user, "manage_users")
 * // throws if user doesn't have permission
 */
export function validatePermission(
  user: User | null,
  permission: Permission
): void {
  if (!user) {
    throw new PermissionError("Usuario no autenticado", permission)
  }

  if (!hasPermission(user, permission)) {
    throw new PermissionError(
      `Permiso denegado: ${permission}. Tu rol (${user.role}) no tiene este permiso.`,
      permission
    )
  }
}

/**
 * Validate that user can access a specific store
 * Throws PermissionError if not authorized
 * 
 * Usage:
 * validateStoreAccess(user, storeId)
 * // throws if user can't access this store
 */
export function validateStoreAccess(
  user: User | null,
  storeId: string
): void {
  if (!user) {
    throw new PermissionError("Usuario no autenticado")
  }

  if (!canAccessStore(user, storeId)) {
    throw new PermissionError(
      `No tienes permiso para acceder al local ${storeId}. Tu rol (${user.role}) está restringido.`
    )
  }
}

/**
 * Validate multiple permissions at once
 * Throws PermissionError if missing any permission
 * 
 * Usage:
 * validateAllPermissions(user, ["manage_users", "view_reports"])
 * // throws if user doesn't have ALL permissions
 */
export function validateAllPermissions(
  user: User | null,
  permissions: Permission[]
): void {
  for (const permission of permissions) {
    validatePermission(user, permission)
  }
}

/**
 * Validate that user has at least one of the specified permissions
 * Throws PermissionError if missing all permissions
 * 
 * Usage:
 * validateAnyPermission(user, ["manage_users", "manage_stores"])
 * // throws if user doesn't have at least ONE permission
 */
export function validateAnyPermission(
  user: User | null,
  permissions: Permission[]
): void {
  if (!user) {
    throw new PermissionError("Usuario no autenticado")
  }

  const hasAny = permissions.some((permission) => hasPermission(user, permission))
  if (!hasAny) {
    throw new PermissionError(
      `Permiso denegado. Tu rol (${user.role}) no tiene ninguno de estos permisos: ${permissions.join(", ")}`
    )
  }
}

/**
 * Validate user can perform admin action on their store
 * This checks both store access and admin permission
 * 
 * Usage:
 * validateAdminAction(user, storeId)
 * // throws if user can't administrate this store
 */
export function validateAdminAction(
  user: User | null,
  storeId: string
): void {
  validateStoreAccess(user, storeId)
  validatePermission(user, "access_admin_panel")
}

/**
 * Validate user can manage users in a store
 * 
 * Usage:
 * validateUserManagement(user, storeId)
 * // throws if user can't manage users in this store
 */
export function validateUserManagement(
  user: User | null,
  storeId: string
): void {
  validateStoreAccess(user, storeId)
  validatePermission(user, "manage_users")
}

/**
 * Validate user can process payment in a store
 * 
 * Usage:
 * validatePaymentAction(user, storeId)
 * // throws if user can't process payments in this store
 */
export function validatePaymentAction(
  user: User | null,
  storeId: string
): void {
  validateStoreAccess(user, storeId)
  validatePermission(user, "process_payments")
}

/**
 * Validate user can create/view orders in a store
 * 
 * Usage:
 * validateOrderAction(user, storeId)
 * // throws if user can't create orders in this store
 */
export function validateOrderAction(
  user: User | null,
  storeId: string
): void {
  validateStoreAccess(user, storeId)
  validatePermission(user, "create_orders")
}

/**
 * Validate user can access kitchen display for a store
 * 
 * Usage:
 * validateKitchenAccess(user, storeId)
 * // throws if user can't view kitchen for this store
 */
export function validateKitchenAccess(
  user: User | null,
  storeId: string
): void {
  validateStoreAccess(user, storeId)
  validatePermission(user, "view_kitchen")
}

/**
 * Validate user can manage kitchen for a store
 * 
 * Usage:
 * validateKitchenManagement(user, storeId)
 * // throws if user can't manage kitchen orders in this store
 */
export function validateKitchenManagement(
  user: User | null,
  storeId: string
): void {
  validateStoreAccess(user, storeId)
  validatePermission(user, "manage_kitchen")
}
