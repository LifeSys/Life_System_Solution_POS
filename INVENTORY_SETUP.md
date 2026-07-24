# Inventory System - Setup & Verification Guide

## Architecture: ONE Document Per Variant

Each product variant gets its own inventory document with:
- **ID Format**: `${storeId}_${productId}_${variantId}`
- **Fields**: storeId, productId, variantId, productName, variantName, currentStock
- **No name parsing, no queries, no normalization**

## Setup Instructions

### Step 1: Ensure Products Have Variant IDs

Each variant in a product MUST have an `id` field:

```typescript
// Product with variants
{
  id: "prod_inca_cola",
  name: "Inca Cola",
  category: "GASEOSAS",
  variants: [
    { id: "var_500ml", name: "500ml", price: 5 },
    { id: "var_1l", name: "1 Litro", price: 8 },
  ]
}
```

### Step 2: Run Migration (One-Time)

When upgrading to this system, rebuild inventory from products:

```typescript
import { rebuildInventoryFromProducts } from "@/lib/firebase/firestore"

// Call once per store
await rebuildInventoryFromProducts("store_123")
```

This will:
1. Delete all old inventory items for the store
2. Create fresh documents based on current products
3. Log: `[Inventory:created] store_123_prod_inca_cola_var_500ml for "Inca Cola" - "500ml"`

### Step 3: Set Stock Levels

Go to `/inventario` page and manually set stock for each variant.

Inventory documents after migration:
```
store_123_prod_inca_cola_var_500ml → currentStock: 20
store_123_prod_inca_cola_var_1l → currentStock: 10
```

## Verification: End-to-End Test

### Scenario: Inca Cola Purchase

**Setup**:
- Inca Cola 500ml: 20 units
- Inca Cola 1L: 10 units

**Action**: Order 2x Inca Cola 500ml

**Console Logs (Expected)**:

```
[Inventory:lookup] Product: "Inca Cola", Variant: "500ml", Query ID: "store_123_prod_inca_cola_var_500ml", Found: true
[Inventory:deduct] Inca Cola x2: 20 → 18
```

**Result**:
- Inca Cola 500ml: 18 ✓
- Inca Cola 1L: 10 ✓ (unchanged)

### Scenario: Multiple Variants Same Product

**Setup**:
- Pepsi 500ml: 15 units
- Pepsi 2L: 8 units
- Fanta 500ml: 12 units

**Action 1**: Order 3x Pepsi 500ml
- Result: Pepsi 500ml → 12, Pepsi 2L → 8, Fanta 500ml → 12 ✓

**Action 2**: Order 1x Pepsi 2L
- Result: Pepsi 500ml → 12, Pepsi 2L → 7, Fanta 500ml → 12 ✓

## Troubleshooting

### Inventory Not Deducting

Check console for these logs:

```
[Inventory:lookup] ... Query ID: "store_123_prod_X_var_Y", Found: false
```

**Solution**: 
- Ensure product has variants with IDs
- Run `rebuildInventoryFromProducts(storeId)` again
- Verify document IDs match exactly: `${storeId}_${productId}_${variantId}`

### Old Inventory Items Still Exist

These are legacy documents from before migration:
- They won't be used by the system
- Can be manually deleted from Firestore console
- Or run `rebuildInventoryFromProducts()` again (will delete them)

## Implementation Checklist

- [ ] All products have `id` field
- [ ] All variants have `id` field
- [ ] Run `rebuildInventoryFromProducts(storeId)`
- [ ] Verify inventory documents in Firestore:
  - [ ] Count matches: (# products) × (avg variants per product)
  - [ ] IDs follow format: `storeId_productId_variantId`
  - [ ] All have `currentStock` field
- [ ] Test full flow:
  - [ ] Create order with multiple variants
  - [ ] Check console logs for `[Inventory:*]` messages
  - [ ] Verify stock decreased correctly in Firestore
