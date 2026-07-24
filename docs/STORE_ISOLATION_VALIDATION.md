# Store Isolation Validation Guide

## Overview

This document explains how store isolation is enforced in the LifeSystemSolution POS system and how to validate that users cannot access unauthorized stores.

## Architecture

### Store Isolation Model

```
Single-Store User:
┌─────────────────────────────┐
│ User (storeId = "ABC")      │
├─────────────────────────────┤
│ Can access: Store ABC only  │
│ Cannot see: Other stores    │
│ PIN login: store code + pin │
└─────────────────────────────┘

Admin Global (Multi-Store):
┌──────────────────────────────────────────┐
│ User (assignedStores = ["ABC","DEF"])    │
├──────────────────────────────────────────┤
│ Can access: Stores ABC & DEF             │
│ Cannot see: Other stores                 │
│ PIN login: store code + pin (per store)  │
│ Can switch between stores                │
└──────────────────────────────────────────┘
```

## Store Isolation Layers

### Layer 1: Firebase Authentication
- Email/password login (Firebase Auth)
- Persistent across browser refreshes
- No store restrictions at this level

### Layer 2: PIN Validation
**In `contexts/auth-context.tsx` - login() function:**

```typescript
// Get user by PIN and store
const foundUser = await getUserByPinAndStore(pin, foundStore.id!)

// CRITICAL: Validate user has access to this store
const hasAccess = 
  (foundUser.role === "admin_global" && foundUser.assignedStores?.includes(foundStore.id!)) ||
  (foundUser.storeId === foundStore.id!)

if (!hasAccess) {
  setError("Acceso denegado: usuario no está autorizado para esta tienda")
  return false
}
```

**What this does:**
- For admin_global users: checks if storeId is in assignedStores array
- For normal users: checks if storeId matches user's single storeId
- Rejects login if user is not authorized for the selected store
- Logs detailed info about denied access attempts

### Layer 3: Store Selector Filtering
**In `app/page.tsx` - Store dropdown:**

```typescript
// After PIN login, filter stores based on user's access
useEffect(() => {
  if (user && loginMode === "normal") {
    const userStores = await getStoresByUser(user)
    setStores(userStores)
  }
}, [user, loginMode])
```

**What this does:**
- Calls `getStoresByUser()` from firestore
- Returns only stores user is authorized to access
- Dropdown only shows permitted stores

### Layer 4: Data Isolation
**In Firestore queries:**

```typescript
// Automatically respects user's store boundaries
const data = await queryDocumentsByUserStores("orders", userId)

// Only returns orders from stores in user.assignedStores or user.storeId
```

## Test Scenarios

### Test 1: Normal User Single Store Access

**Setup:**
- User: `pascana@lifesystemsolution.com` (Pine store)
- PIN: `1234`
- Role: `mesero`
- storeId: `pine_store_id`
- assignedStores: `undefined` (not used)

**Expected Behavior:**
✓ Can log in with pine store code + PIN
✓ Selector shows ONLY Pine store
✓ Cannot see "Empanadería Jesús María"
✓ Cross-store PIN login is rejected

**Test Steps:**
1. Open login page
2. Select "Usuario" tab
3. Enter "Pine" store code
4. Enter PIN "1234"
5. Verify: Pine store is selected and other stores hidden

**Validation:**
```
PIN login: ACCEPT ✓
Store selector: Shows 1 store (Pine)
Access denied: Other stores NOT in list
```

### Test 2: Admin Global Multi-Store Access

**Setup:**
- User: `admin@lifesystemsolution.com` (Multi-store admin)
- PIN: `5678`
- Role: `admin_global`
- storeId: `undefined` (not used)
- assignedStores: `["pine_store_id", "empanaderia_store_id"]`

**Expected Behavior:**
✓ Can log in with any assigned store code + PIN
✓ Selector shows ONLY assigned stores
✓ Can switch between Pine and Empanadería
✓ Cannot access other stores

**Test Steps:**
1. Log in with Pine code + PIN
2. Verify: Can see both Pine and Empanadería
3. Switch to Empanadería
4. Try to access with invalid store code
5. Verify: Access denied

**Validation:**
```
PIN login (Pine): ACCEPT ✓
PIN login (Empanadería): ACCEPT ✓
PIN login (Other): REJECT ✓
Store selector: Shows 2 stores
Switch store: Works ✓
```

### Test 3: Cross-Store PIN Attack Prevention

**Setup:**
- Try to use one store's user PIN on a different store
- User: `pascana@lifesystemsolution.com` (Pine store)
- PIN: `1234`
- Try store code: "EMPANADERIA"

**Expected Behavior:**
✗ Login rejected with "Acceso denegado" message

**Test Steps:**
1. Select "Usuario" tab
2. Enter "EMPANADERIA" store code (wrong store)
3. Enter PIN "1234" (correct PIN for Pine store)
4. Verify: Access denied

**Validation:**
```
Auth error: "Acceso denegado: usuario no está autorizado para esta tienda"
PIN login: REJECTED ✓
Audit log shows attempted cross-store access
```

### Test 4: Non-Existent Store Prevention

**Setup:**
- Try to access a store user has no access to
- User: `pascana@lifesystemsolution.com` (Pine store)
- Try store code: "NONEXISTENT" or "FAKE"

**Expected Behavior:**
✗ Login rejected with store not found or access denied

**Test Steps:**
1. Select "Usuario" tab
2. Enter invalid store code
3. Click login
4. Verify: Error message shown

**Validation:**
```
Error: "Código de tienda inválido" OR "Acceso denegado"
PIN login: REJECTED ✓
```

## Validation Checklist

- [ ] Normal user can log in to their assigned store
- [ ] Normal user CANNOT see other stores in selector
- [ ] Normal user CANNOT log in to other stores (cross-store attack blocked)
- [ ] Admin global can log in to any assigned store
- [ ] Admin global can see all assigned stores in selector
- [ ] Admin global CANNOT log in to unassigned stores
- [ ] Unassigned stores never appear in store selector
- [ ] Browser console shows denied access logs with details
- [ ] Multiple failed login attempts logged correctly
- [ ] Store switch works for admin_global
- [ ] Single-store user cannot switch stores

## Security Validation Points

### Authentication Layer
```typescript
// Pin is unique within a store context
// Users can only authenticate if:
// 1. Pin is correct
// 2. User is assigned to the selected store
```

### Authorization Layer
```typescript
// After successful PIN login:
// 1. Check if user.role === "admin_global"
//    → Verify storeId in user.assignedStores
// 2. Else check if user.storeId === selectedStoreId
```

### Data Layer
```typescript
// When fetching user's data:
// 1. Query respects currentStoreId
// 2. Users cannot query across stores
// 3. Store selector only shows permitted stores
```

## Debugging Cross-Store Issues

### If user sees unauthorized stores:

**Check 1:** User schema in Firestore
```typescript
// Should have ONE of:
// storeId: "store_id"        // single-store user
// assignedStores: [...]      // admin_global user
```

**Check 2:** Browser console
```javascript
// Look for logs:
console.error("[v0] Access denied - User ... not assigned to store")
```

**Check 3:** Auth context
```typescript
// Verify getStoresByUser is called after PIN login
// Check if stores array is populated correctly
```

### If PIN login doesn't validate:

**Check 1:** getUserByPinAndStore query
```typescript
// Must find user with correct pin AND storeId
const foundUser = await getUserByPinAndStore(pin, foundStore.id!)
```

**Check 2:** Access validation logic
```typescript
// Both conditions must pass:
// 1. User found with correct PIN in selected store
// 2. User authorized for that store (via storeId or assignedStores)
```

## Console Debugging

Enable debug logs:
```typescript
// In auth-context.tsx - login() function
console.log("[v0] Attempting PIN login", { storeCode, pin: "****" })
console.log("[v0] Store found:", foundStore)
console.log("[v0] User found:", foundUser)
console.log("[v0] Access check", { 
  role: foundUser.role,
  storeId: foundUser.storeId,
  assignedStores: foundUser.assignedStores,
  selectedStore: foundStore.id
})
console.log("[v0] Access granted/denied:", hasAccess)
```

## Rollout Verification

Before deploying multi-store system:

1. Create test users with different store assignments
2. Test all 4 scenarios above
3. Verify store selector filtering
4. Verify PIN login validation
5. Check browser console for expected logs
6. Verify data isolation (users can only see their data)
7. Test store switching for admin_global
8. Verify non-admin_global cannot switch stores

## Success Criteria

✓ Users see ONLY their authorized stores
✓ Users cannot access unauthorized stores via PIN
✓ Cross-store PIN attacks are prevented
✓ Store selector accurately reflects permissions
✓ Data is isolated per store
✓ Multi-store users can switch stores seamlessly
✓ All unauthorized access attempts are logged
