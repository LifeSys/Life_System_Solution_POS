# Firestore Indexes Setup

## Required Composite Index

The Caja module requires a composite index for the `safe_box_movements` collection to query movements efficiently.

### Index Configuration

**Collection**: `safe_box_movements`
**Fields**:
- `storeId` (Ascending)
- `createdAt` (Descending)

### How to Create

#### Option 1: Via Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (lifesystemsolution-core)
3. Navigate to **Firestore Database** > **Indexes** > **Composite indexes**
4. Click **Create Index**
5. Fill in:
   - **Collection ID**: `safe_box_movements`
   - **Field 1**: `storeId` - Ascending
   - **Field 2**: `createdAt` - Descending
6. Click **Create**

The index should be **READY** within a few minutes.

#### Option 2: Via Firebase CLI

```bash
# Deploy indexes from firestore.indexes.json
firebase deploy --only firestore:indexes
```

### Why This Index?

The `subscribeToSafeBoxMovements` function queries:
```javascript
const q = query(
  collection(db, "safe_box_movements"),
  where("storeId", "==", storeId),
  orderBy("createdAt", "desc"),
  limit(30)
)
```

Firestore requires a composite index for queries with:
- Equality filter (`where`) on one field
- Ordering (`orderBy`) on a different field

### Status

- If you see an error in the browser console mentioning a missing index
- Click the provided Firebase Console link to auto-create the index
- Or manually create it following Option 1 above

Once the index is created, the error will disappear and safe box movements will query efficiently.
