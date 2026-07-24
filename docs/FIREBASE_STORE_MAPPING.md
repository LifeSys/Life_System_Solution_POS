# Firebase Store Mapping Guide

## Overview

When a user logs in with Firebase (email/password), the system automatically loads their accessible stores by matching Firebase credentials to store documents.

## How It Works

### 1. Firebase Authentication
```
User enters: pascana@multipizza.com / password
↓
Firebase Auth succeeds
↓
firebaseUser.uid = "ABC123..." 
firebaseUser.email = "pascana@multipizza.com"
```

### 2. Store Discovery
```
Context listener:
  const stores = await getStoresByFirebaseCredentials(
    firebaseUser.uid,
    firebaseUser.email
  )
↓
Searches stores collection for matches on:
  firebaseUid === "ABC123..." OR
  firebaseEmail === "pascana@multipizza.com"
```

### 3. Auto-Load Stores
```
If firebaseAccessibleStores.length === 1:
  ✓ Auto-select that store
  ✓ Show PIN pad with store pre-selected
  
If firebaseAccessibleStores.length > 1:
  ✓ Show store selector
  ✓ User picks store
  ✓ Enter PIN for that store
  
If firebaseAccessibleStores.length === 0:
  ✓ Show empty state
  ✓ "No stores found for your account"
```

## Setup Instructions

### Step 1: Get Firebase UID

Go to Firebase Console → Authentication → Users:
- Find the user (e.g., pascana@multipizza.com)
- Copy their UID

Example: `HjK8nL0pQ9vXyZ2aB3cD4e5F6g7H8i9J`

### Step 2: Update Store Document

In Firestore, find the store document (e.g., "Pascana - San Isidro"):

```
stores/DOC_ID
{
  name: "Pascana - San Isidro"
  code: "PSC001"
  active: true
  createdAt: Timestamp
  firebaseUid: "HjK8nL0pQ9vXyZ2aB3cD4e5F6g7H8i9J"      ← ADD THIS
  firebaseEmail: "pascana@multipizza.com"               ← ADD THIS
}
```

**Option A: By UID (Recommended)**
```javascript
// Firebase Console or script
db.collection('stores').doc('PSC001').update({
  firebaseUid: "HjK8nL0pQ9vXyZ2aB3cD4e5F6g7H8i9J"
})
```

**Option B: By Email**
```javascript
db.collection('stores').doc('PSC001').update({
  firebaseEmail: "pascana@multipizza.com"
})
```

**Option C: Both (Maximum Compatibility)**
```javascript
db.collection('stores').doc('PSC001').update({
  firebaseUid: "HjK8nL0pQ9vXyZ2aB3cD4e5F6g7H8i9J",
  firebaseEmail: "pascana@multipizza.com"
})
```

### Step 3: Test

1. Open the app
2. Navigate to login page
3. Enter: pascana@multipizza.com / password
4. Verify that:
   - Stores load automatically
   - If only 1 store: it's pre-selected
   - Store code appears in selector
   - PIN pad is ready

## Examples

### Single Store Setup

User: huanuco@multipizza.com
Firebase UID: `aBcDeF1234GhIjK5678LmNoPqRsT9uVw`

**Store Document:**
```
stores/HUA001
{
  name: "Huanuco - Centro",
  code: "HUA001",
  active: true,
  firebaseUid: "aBcDeF1234GhIjK5678LmNoPqRsT9uVw",
  firebaseEmail: "huanuco@multipizza.com"
}
```

**Result:**
1. User logs in → Firebase auth succeeds
2. Context: searches for stores with firebaseUid/firebaseEmail
3. Finds 1 store → auto-selects
4. User sees PIN pad with HUA001 already selected
5. User enters PIN → logs in

### Multi-Store Setup (admin_global)

User: global_admin@multipizza.com
Firebase UID: `xYz987vUtSwRqPoNmLkJiHgFeDcBaA123`

**Store Documents:**
```
stores/PSC001
{
  name: "Pascana - San Isidro",
  code: "PSC001",
  firebaseUid: "xYz987vUtSwRqPoNmLkJiHgFeDcBaA123"
}

stores/HUA001
{
  name: "Huanuco - Centro",
  code: "HUA001",
  firebaseUid: "xYz987vUtSwRqPoNmLkJiHgFeDcBaA123"
}

stores/EMP001
{
  name: "Empanadería - Jesús María",
  code: "EMP001",
  firebaseUid: "xYz987vUtSwRqPoNmLkJiHgFeDcBaA123"
}
```

**Result:**
1. User logs in → Firebase auth succeeds
2. Context: searches for stores with firebaseUid
3. Finds 3 stores → shows store selector
4. User selects → shows PIN pad
5. User enters PIN → logs in to that store

## Troubleshooting

### Stores Not Loading

**Check 1: Firebase UID Format**
- Open browser console (F12)
- Log in with email/password
- Type: `firebase.auth().currentUser.uid`
- Copy exact value (with hyphens, exact case)

**Check 2: Store Document Update**
- Open Firestore Console
- Find the store document
- Verify firebaseUid/firebaseEmail matches exactly
- Check for typos or extra spaces

**Check 3: Function Call**
- Open browser console
- Look for errors in auth-context logs
- Verify: `getStoresByFirebaseCredentials` is being called

### Still Not Working?

Add debug logging:
```typescript
// In auth-context.tsx, Firebase effect:
console.log("[v0] Firebase UID:", fbUser.uid)
console.log("[v0] Firebase email:", fbUser.email)
console.log("[v0] Stores found:", stores.length)
stores.forEach(s => console.log("[v0] Store:", s.code, s.firebaseUid, s.firebaseEmail))
```

Then test login and check console output.

## API Reference

### Function: getStoresByFirebaseCredentials

```typescript
export async function getStoresByFirebaseCredentials(
  firebaseUid?: string,
  firebaseEmail?: string
): Promise<Store[]>
```

**Parameters:**
- `firebaseUid` (optional): Firebase user UID
- `firebaseEmail` (optional): Firebase user email

**Returns:** Array of stores matching either credential

**Example:**
```typescript
const stores = await getStoresByFirebaseCredentials(
  "HjK8nL0pQ9vXyZ2aB3cD4e5F6g7H8i9J"
)

// Also works:
const stores = await getStoresByFirebaseCredentials(
  undefined,
  "pascana@multipizza.com"
)

// Both:
const stores = await getStoresByFirebaseCredentials(
  "HjK8nL0pQ9vXyZ2aB3cD4e5F6g7H8i9J",
  "pascana@multipizza.com"
)
```

## Security Notes

1. **No Cross-Store Access**
   - Only stores explicitly mapped to user's Firebase UID/email
   - Cannot access unmapped stores

2. **PIN Validation**
   - After store selection, PIN is still validated per store
   - User must know PIN for that specific store

3. **Automatic Logout on Store Change**
   - Changing stores clears PIN session
   - Requires new PIN entry

4. **No Credential Exposure**
   - firebaseUid/firebaseEmail only used for store lookup
   - Not transmitted to client

## Migration Path

### Phase 1: Add Firebase Mapping
- Add firebaseUid/firebaseEmail to each store
- Test with email/password login
- Verify auto-load works

### Phase 2: Deprecate Store Code Login
- Keep store code for legacy compatibility
- Users prefer Firebase credentials
- Phase out store code gradually

### Phase 3: Full Firebase Auth
- All users login via Firebase
- Store code only for internal lookup
- PIN for operational security

## Related Documentation

- [Multi-Store Guide](./MULTI_STORE_GUIDE.md)
- [Authentication Flow](./IMPLEMENTATION_SUMMARY.md)
- [Store Isolation](./STORE_ISOLATION_VALIDATION.md)
