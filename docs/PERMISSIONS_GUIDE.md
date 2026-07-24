# Guía de Uso: Sistema de Permisos y Control de Roles

## Quick Start

### 1. Usar el hook `usePermissions` en componentes

```tsx
import { usePermissions } from "@/hooks/use-permissions"

export function AdminPanel() {
  const { can, role, user } = usePermissions()

  if (!can.accessAdminPanel()) {
    return <div>No tienes permiso para acceder</div>
  }

  return (
    <div>
      <h1>Panel de Administración</h1>
      <p>Bienvenido, {user?.name}</p>
      
      {can.manageUsers() && <UserManagement />}
      {can.processPayments() && <PaymentDashboard />}
      {can.viewKitchen() && <KitchenDisplay />}
    </div>
  )
}
```

### 2. Usar `RoleGate` para controlar visibilidad

```tsx
import { RoleGate, AdminPanelGate, PaymentGate } from "@/components/auth/role-gate"

export function Dashboard() {
  return (
    <div>
      {/* Mostrar admin panel solo para admins */}
      <AdminPanelGate>
        <AdminSection />
      </AdminPanelGate>

      {/* Mostrar pagos solo para cajeros */}
      <PaymentGate>
        <CheckoutButton />
      </PaymentGate>

      {/* Mostrar cocina solo para kitchen staff */}
      <RoleGate roles={["cocina", "admin", "super_admin"]}>
        <KitchenDisplay />
      </RoleGate>

      {/* Mostrar por permiso específico */}
      <RoleGate permission="manage_users">
        <UserManagementPanel />
      </RoleGate>
    </div>
  )
}
```

## Ejemplos Prácticos

### Ejemplo 1: Panel de Administración con Control de Rol

```tsx
import { usePermissions } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"

export function AdminDashboard() {
  const { can, role } = usePermissions()

  return (
    <div className="space-y-4">
      <h1>Dashboard de Administración</h1>

      {/* Solo super admin puede gestionar stores */}
      {can.has("manage_stores") && (
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Locales</CardTitle>
          </CardHeader>
          <CardContent>
            <ManageStoresPanel />
          </CardContent>
        </Card>
      )}

      {/* Solo admins pueden gestionar usuarios */}
      {can.manageUsers() && (
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <ManageUsersPanel />
          </CardContent>
        </Card>
      )}

      {/* Solo admins pueden ver reportes */}
      {can.has("view_reports") && (
        <Card>
          <CardHeader>
            <CardTitle>Reportes</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportsPanel />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### Ejemplo 2: Restricción de Acceso a Store

```tsx
import { usePermissions } from "@/hooks/use-permissions"
import { useAuth } from "@/contexts/auth-context"

export function StoreAdminPanel({ storeId }: { storeId: string }) {
  const { canAccessStore, can } = usePermissions()
  const { user } = useAuth()

  // Verificar acceso al store específico
  if (!canAccessStore(storeId)) {
    return <div>No tienes permiso para administrar este local</div>
  }

  // Verificar permisos generales
  if (!can.accessAdminPanel()) {
    return <div>No tienes acceso al panel de administración</div>
  }

  return (
    <div>
      <h1>Administración del Local</h1>
      <StoreSettings storeId={storeId} />
    </div>
  )
}
```

### Ejemplo 3: Interfaz de Caja con Control de Roles

```tsx
import { usePermissions } from "@/hooks/use-permissions"
import { PaymentGate } from "@/components/auth/role-gate"

export function CashierInterface() {
  const { can, role } = usePermissions()

  return (
    <div>
      <h1>Terminal de Punto de Venta</h1>

      {/* Todos pueden crear órdenes */}
      {can.createOrders() && (
        <OrderCreationPanel />
      )}

      {/* Solo cajeros pueden procesar pagos */}
      <PaymentGate>
        <PaymentProcessor />
      </PaymentGate>

      {/* Solo admin puede ver reportes */}
      {can.has("view_reports") && (
        <SalesReport />
      )}
    </div>
  )
}
```

### Ejemplo 4: Display de Cocina con Control de Acceso

```tsx
import { usePermissions } from "@/hooks/use-permissions"
import { KitchenViewGate } from "@/components/auth/role-gate"

export function KitchenDisplay() {
  const { can } = usePermissions()

  return (
    <div>
      <KitchenViewGate
        fallback={
          <div className="text-center text-red-600 p-4">
            No tienes permiso para ver la cocina
          </div>
        }
      >
        <div>
          <h1>Display de Cocina</h1>
          <OrderQueue />

          {/* Solo pueden marcar como listos si tienen permiso */}
          {can.manageKitchen() && (
            <Button onClick={markOrderReady}>
              Marcar como Listo
            </Button>
          )}
        </div>
      </KitchenViewGate>
    </div>
  )
}
```

## API Reference

### Hook: `usePermissions()`

```tsx
const {
  // Verificar permisos
  has(permission),           // boolean - Verificar permiso específico
  can: {
    accessAdminPanel(),      // boolean
    manageUsers(),          // boolean
    processPayments(),      // boolean
    createOrders(),         // boolean
    viewKitchen(),          // boolean
    manageKitchen(),        // boolean
    accessStore(storeId),   // boolean
  },
  // Legacy (backward compatible)
  role: {
    isSuperAdmin,           // boolean
    isAdmin,                // boolean
    isCajero,               // boolean
    isMesero,               // boolean
    isCocina,               // boolean
  },
  // Datos de usuario
  user,                      // User | null
  store,                     // Store | null
} = usePermissions()
```

### Componentes: Role Gates

#### `<RoleGate>`
- `permission?: Permission` - Verificar permiso específico
- `roles?: string[]` - Verificar uno de varios roles
- `fallback?: ReactNode` - Mostrar si no tiene permiso (default: null)
- `children: ReactNode` - Contenido a mostrar si tiene permiso

#### `<AdminPanelGate>`
- `fallback?: ReactNode` - Mostrar si no tiene acceso (default: null)
- `children: ReactNode` - Admin panel content

#### `<KitchenViewGate>`
- `fallback?: ReactNode` - Mostrar si no tiene acceso (default: null)
- `children: ReactNode` - Kitchen display content

#### `<PaymentGate>`
- `fallback?: ReactNode` - Mostrar si no tiene acceso (default: null)
- `children: ReactNode` - Payment UI content

## Roles y Permisos

### Roles Disponibles
- **super_admin**: Acceso total a todos los locales y funciones
- **admin_global**: Acceso a múltiples locales asignados + funciones admin
- **admin**: Administrador de un local
- **cajero**: Procesamiento de pagos y órdenes
- **mesero**: Toma de órdenes
- **cocina**: Gestión de preparación de pedidos

### Permisos
- `view_dashboard` - Ver dashboard
- `manage_users` - Gestionar usuarios
- `manage_stores` - Gestionar locales (solo super_admin)
- `view_reports` - Ver reportes
- `process_payments` - Procesar pagos
- `create_orders` - Crear órdenes
- `view_menu` - Ver menú
- `manage_menu` - Editar menú
- `view_kitchen` - Ver orders en cocina
- `manage_kitchen` - Marcar órdenes como listas
- `access_admin_panel` - Acceder a panel admin

## Backward Compatibility

El nuevo sistema es totalmente compatible con el código existente:

```tsx
// ✅ Esto sigue funcionando (legacy)
const { isAdmin, isSuperAdmin } = useAuth()

if (isAdmin) {
  return <AdminPanel />
}

// ✅ Pero ahora puedes usar el nuevo sistema también
const { can } = usePermissions()

if (can.accessAdminPanel()) {
  return <AdminPanel />
}
```

## Migración

Para migrar componentes existentes al nuevo sistema:

1. Reemplaza `const { isAdmin } = useAuth()` por `const { can } = usePermissions()`
2. Usa `can.accessAdminPanel()` en lugar de `isAdmin`
3. Para visibilidad condicional, usa `<RoleGate>` en lugar de `{isAdmin && <Component />}`
4. Los checks legacy siguen funcionando, no hay urgencia en migrar

## Tips

✅ **DO**: Usa `usePermissions` para checks simples
✅ **DO**: Usa `<RoleGate>` para control de visibilidad en JSX
✅ **DO**: Centraliza lógica de permisos en hooks reutilizables

❌ **DON'T**: Hardcodea roles en componentes (usa permisos en su lugar)
❌ **DON'T**: Confíes solo en UI para seguridad (valida en backend también)
❌ **DON'T**: Olvides validar permisos en acciones críticas (pagos, reportes)
