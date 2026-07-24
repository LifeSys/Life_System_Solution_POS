# Multi-Store Access Control Guide

## Overview

The multi-store system allows administrators to manage multiple locations (stores) from a single user account without creating duplicate credentials. This guide explains how the system works and how to use it.

## Architecture

### Key Concepts

**Single User Account with Multiple Stores**
- One user can have access to multiple stores via the `assignedStores` array
- No need for separate logins per store
- Seamless store switching within the same session

**admin_global Role**
- New role designed for administrators managing multiple stores
- Can access all stores assigned via `assignedStores` array
- Can switch between stores without logging out

**Store Boundary**
- All data operations respect the current selected store
- Users can only access data from their assigned stores
- Prevents cross-store data leaks

### User Schema

```typescript
interface User {
  id?: string
  name: string
  pin: string
  role: "super_admin" | "admin_global" | "admin" | "cajero" | "mesero" | "cocina"
  storeId?: string // Primary store (for single-store users)
  assignedStores?: string[] // Multi-store access (for admin_global)
  active: boolean
}
```

## Using the Multi-Store System

### For Users (Login & Store Switching)

**Initial Login**
```
1. Enter email & password (Firebase Auth)
2. Enter PIN
3. If admin_global: see list of all assigned stores
4. Select store to continue
```

**Switching Stores**
Use the `StoreSwitcher` component in your dashboard/admin panel:

```tsx
import { StoreSwitcher } from "@/components/store/store-switcher"

export function AdminHeader() {
  return (
    <div className="flex justify-between items-center">
      <h1>Admin Panel</h1>
      <StoreSwitcher /> {/* Shows dropdown only for admin_global */}
    </div>
  )
}
```

### Displaying Store Information

Use the `StoreInfo` component to show current store and access level:

```tsx
import { StoreInfo } from "@/components/store/store-info"

export function UserProfile() {
  return (
    <div>
      <StoreInfo /> {/* Shows current store, code, role, access level */}
    </div>
  )
}
```

### For Developers

**Getting User's Accessible Stores**

```typescript
import { getUserAccessibleStores } from "@/lib/firebase/firestore"

// Get all Store objects user can access
const stores = await getUserAccessibleStores(userId)
console.log(stores) // [{ id, name, code, active, ... }]
```

**Getting Store IDs User Can Access**

```typescript
import { getStoresAccessibleByUser } from "@/lib/firebase/firestore"

// Get array of store IDs
const storeIds = await getStoresAccessibleByUser(userId)
console.log(storeIds) // ["store1", "store2", "store3"]
```

**Checking if User Can Access a Specific Store**

```typescript
import { canUserAccessStore } from "@/lib/firebase/firestore"

const hasAccess = await canUserAccessStore(userId, storeId)
if (!hasAccess) {
  throw new Error("Access denied to this store")
}
```

**Querying Data Respecting User's Stores**

Query any collection with automatic store boundary enforcement:

```typescript
import { queryDocumentsByUserStores } from "@/lib/firebase/firestore"

// Get all orders from user's accessible stores
const orders = await queryDocumentsByUserStores<Order>("orders", userId, [
  where("status", "==", "pending")
])

// Only returns orders from stores in user.assignedStores
```

### Using the Auth Context

**Get User Info**
```typescript
const { user, store, allAccessibleStores } = useAuth()

// user.assignedStores: ["store1", "store2", "store3"]
// store: { id: "store1", name: "La Tía", code: "LT001", ... }
// allAccessibleStores: [{ id: "store1", ... }, { id: "store2", ... }, ...]
```

**Switch Stores Programmatically**
```typescript
const { switchStore, allAccessibleStores } = useAuth()

const newStore = allAccessibleStores[1]
await switchStore(newStore)

// UI updates automatically, current store changes
```

**Check Permissions**
```typescript
const { canAccessStore, canManageUsers } = useAuth()

// Verify store access
if (canAccessStore(storeId)) {
  // Allow operation
}

// Check if can manage users
if (canManageUsers()) {
  // Show user management UI
}
```

## Data Isolation Patterns

### Pattern 1: Fetch Data from Current Store

```typescript
import { collection, query, where, getDocs } from "firebase/firestore"

export async function getCurrentStoreOrders(storeId: string) {
  const q = query(
    collection(db, "orders"),
    where("storeId", "==", storeId) // Explicit store boundary
  )
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

**Usage:**
```typescript
const { currentStoreId } = useAuth()
const orders = await getCurrentStoreOrders(currentStoreId!)
```

### Pattern 2: Automatic Store Boundary (Recommended)

```typescript
import { queryDocumentsByUserStores } from "@/lib/firebase/firestore"

export async function getUserOrders(userId: string) {
  // Automatically respects user's assigned stores
  return await queryDocumentsByUserStores<Order>("orders", userId, [
    where("paymentStatus", "==", "paid")
  ])
}
```

**Usage:**
```typescript
const { user } = useAuth()
const orders = await getUserOrders(user!.id!)
```

## API Validation Example

Server-side validation to ensure users only access their stores:

```typescript
// app/api/orders/route.ts
import { validateStoreAccess } from "@/lib/auth/permission-validators"

export async function GET(req: Request) {
  const { user, storeId } = req // From middleware

  // Throws PermissionError if user can't access this store
  await validateStoreAccess(user, storeId)

  // Safe to fetch data - user has access
  return getOrdersForStore(storeId)
}
```

## Migration Guide

### Existing Single-Store Users

No changes needed. Single-store users continue to work:

```typescript
interface User {
  // Existing field still used
  storeId: string
  
  // assignedStores optional - not set for single-store
  // User can only access their storeId
}
```

### Converting to Multi-Store

To convert a single-store admin to `admin_global`:

```typescript
// In Firestore Console or via API:
{
  id: "user123",
  name: "Alice",
  pin: "1234",
  role: "admin_global", // Changed from "admin"
  assignedStores: ["store1", "store2", "store3"], // Added
  // storeId can be removed or kept for backward compatibility
  active: true
}
```

## Best Practices

### ✅ DO

- Always validate store access in APIs/server actions
- Use `queryDocumentsByUserStores` for automatic store isolation
- Check `canAccessStore()` before operations
- Display `StoreInfo` in admin panels
- Use `StoreSwitcher` for multi-store admins

### ❌ DON'T

- Don't query without store boundaries: `getDocs(collection(db, "orders"))`
- Don't assume user has access: verify with `canUserAccessStore()`
- Don't create duplicate users per store
- Don't skip server-side permission validation
- Don't hard-code store IDs in queries

## Troubleshooting

### "User has no accessible stores"
```
✓ Check that user.assignedStores is populated
✓ Verify stores exist in Firestore
✓ Ensure user role is admin_global
```

### "Access denied to this store"
```
✓ Verify storeId is in user.assignedStores
✓ Check user.role is admin or admin_global
✓ Ensure store is active (active: true)
```

### Store switching not working
```
✓ Check user role is admin_global
✓ Verify allAccessibleStores is populated
✓ Ensure switchStore() is awaited
✓ Check browser console for errors
```

## Rollout Checklist

- [ ] Create `admin_global` test user with multiple stores
- [ ] Test initial login with store selection
- [ ] Test store switching via StoreSwitcher
- [ ] Test data isolation (can't see other store's data)
- [ ] Test API validation (cross-store requests blocked)
- [ ] Test logout clears allAccessibleStores
- [ ] Test single-store users still work
- [ ] Test permissions with different store combinations
- [ ] Add StoreSwitcher to relevant admin panels
- [ ] Add StoreInfo to user profile/header
- [ ] Update admin onboarding docs
