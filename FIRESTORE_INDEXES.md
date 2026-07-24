# Firestore Indexes Documentation

## Required Composite Index

### Collection: `safe_box_movements`

**Purpose:** Support querying safe box movements by store with ordering by date.

**Required Fields:**
- `storeId` (Ascending)
- `createdAt` (Descending)

**Query Pattern:**
```
where('storeId', '==', storeId)
orderBy('createdAt', 'desc')
limit(30)
```

**Status:** This index will be automatically suggested by Firebase when the query is first executed. The application handles missing indexes gracefully by returning empty results and logging the error.

**Setup Instructions:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database > Indexes
4. Create a new composite index with the fields above
5. Or follow the link provided in the Firebase error message when the query first runs

**Note:** The application will continue to function without this index, but queries will fail. Once the index is created, queries will resolve instantly.
