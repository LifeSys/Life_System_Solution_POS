# Authentication Architecture (Simplified)

## Overview

The authentication system is intentionally simple:
1. **Firebase Auth** (email/password) - Device-level authentication
2. **PIN Entry** (role-based) - Store-level authentication  
3. **localStorage Persistence** - Skip PIN on refresh (same user/device)

No lock screen, no session timeout, no complex validation.

## Flow

### Initial Login
```
1. User enters email/password
   → Firebase authenticates and persists
   
2. User sees store selection
   → Auto-selected if only 1 store accessible via Firebase
   
3. User enters PIN
   → System loads user/store based on PIN + store code
   → Validates access (store assignment)
   
4. localStorage stores PIN flag:
   {
     userId: "user1",
     storeId: "store1",
     firebaseUid: "firebase_uid",
     timestamp: Date.now()
   }
   
5. Redirect to dashboard (based on role)
```

### Refresh or Reopen Tab
```
1. Firebase Auth restored (browserLocalPersistence)
   → firebaseUser loaded automatically
   
2. localStorage restored
   → PIN flag still valid
   
3. Check: firebaseUser && user && store
   → All exist from previous session
   
4. No PIN entry needed
   → Redirect to dashboard directly
```

### Logout
```
1. User clicks logout
   → signOut(auth) clears Firebase
   → localStorage cleared
   → All state cleared
   
2. Redirect to / (login page)
```

### Firebase Expiry (after 24h)
```
1. onAuthStateChanged fires with null
   → firebaseUser = null
   → All state cleared
   → localStorage cleared
   
2. User redirected to / (login page)
   → Shows Firebase login again
```

## State Management

### In AuthContext
```typescript
// Firebase level
firebaseUser: FirebaseUser | null          // Firebase UID + email
isFirebaseAuthenticated: boolean            // Firebase auth state

// PIN level  
user: User | null                           // User doc from Firestore
store: Store | null                         // Store doc from Firestore
currentStoreId: string | null               // Selected store ID

// UI
isLoading: boolean
error: string | null
needsStoreSelection: boolean
```

### In localStorage
```typescript
// Stores: pos_operative_unlock
{
  userId: string
  storeId: string
  firebaseUid: string
  timestamp: number
}
```

## Route Guards

All route layouts follow same pattern:

```typescript
const { firebaseUser, user, store, isAdmin } = useAuth()

useEffect(() => {
  if (!firebaseUser || !user || !store) {
    router.push("/")                    // Missing any layer = back to login
  } else if (!isAdmin) {
    router.push("/")                    // Missing permission = back to login
  }
}, [firebaseUser, user, store, isAdmin, router])

if (!firebaseUser || !user || !store) {
  return <Spinner />                    // Loading state while checking
}

// Render protected page
return <Dashboard />
```

Three simple checks:
1. **firebaseUser** - Firebase auth exists (device authenticated)
2. **user & store** - PIN login exists (role/store authenticated)
3. **permission check** - User has required role for page

## Security

- **Firebase email/password** - Device authentication (managed by Firebase)
- **PIN + Store** - Role-based access (validated against Firestore)
- **localStorage** - Only used to skip PIN re-entry, validated against Firebase UID
- **No session tokens** - Relies on Firebase SDK persistence
- **No timeout** - Firebase handles expiry (typically 24h)

## Behaviors

### ✓ Works
- Login with email/password
- Enter PIN, select role, see dashboard
- Refresh page → stays on dashboard (no PIN)
- Close tab, reopen → restored (no PIN)
- Logout → back to login
- Firebase expires → back to login
- Switch roles → need new PIN
- Multi-user device → each user logs in separately

### ✗ Removed (Intentionally)
- Lock screen (no automatic lock on inactivity)
- Manual lock button
- Session timeout
- PIN expiration
- "Bloquear POS" feature
- /unlock page

## Implementation Details

### LoginPage (/)
1. Tabs for "Operario" (normal) and "Admin" login modes
2. Firebase login tab (email/password)
3. PIN entry (after Firebase auth)
4. Role-based dashboard redirect

### Redirects
- If not firebaseUser → show Firebase login
- If firebaseUser but no user/store → show PIN entry
- If user && store && valid permission → show dashboard
- If invalid permission → back to home (/)

### localStorage Usage
- Cleared on logout
- Cleared if Firebase user changes
- Used ONLY to skip PIN on same user/device
- Not a security mechanism

## Testing Checklist

- [ ] Login with email/password works
- [ ] PIN entry after Firebase login works
- [ ] Dashboard loads with correct role
- [ ] Refresh stays on dashboard (no PIN)
- [ ] Logout clears everything
- [ ] Close/reopen tab works
- [ ] Switch users requires new login
- [ ] Invalid PIN shows error
- [ ] Build succeeds
- [ ] All 11 routes prerender

## Code Files

- **contexts/auth-context.tsx** - Main auth logic and state
- **app/page.tsx** - Login page with Firebase + PIN tabs
- **app/[role]/layout.tsx** - Route guards (6 files)
