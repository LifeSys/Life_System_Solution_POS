# Order Editing Quick Reference Guide

## Quick Start - Three Main Functions

### 1. Update Item Quantity
```typescript
import { updateOrderItemQuantity } from "@/lib/firebase/firestore"

await updateOrderItemQuantity(
  orderId,           // string - Order ID
  itemId,            // string - Item ID
  newQuantity,       // number - New quantity (must be > 0)
  userId,            // string - Current user ID
  userName,          // string - Current user name
  "reason"           // optional - Why the change was made
)
```

**When to use:** Customer wants to change qty from 5 to 3 gaseosas  
**Result:** Inventory delta applied, total recalculated, audit logged

---

### 2. Remove Item from Order
```typescript
import { removeOrderItem } from "@/lib/firebase/firestore"

await removeOrderItem(
  orderId,           // string - Order ID
  itemId,            // string - Item ID to remove
  userId,            // string - Current user ID
  userName,          // string - Current user name
  "reason"           // optional - Why item was removed
)
```

**When to use:** Customer wants to cancel the gaseosa order  
**Result:** Item marked cancelled, full inventory restored, total recalculated

---

### 3. Batch Edit Order Items
```typescript
import { editOrderItemsWithAudit } from "@/lib/firebase/firestore"

const updatedItems = [
  { ...existingItem1, quantity: 3 },    // Quantity reduced
  { ...existingItem2, cancelled: true }, // Item removed
  { ...newItem3 }                        // New item added
]

const result = await editOrderItemsWithAudit(
  orderId,           // string - Order ID
  updatedItems,      // OrderItem[] - Modified items array
  userId,            // string - Current user ID
  userName,          // string - Current user name
  "reason"           // optional - Change reason
)

// Result contains: success, changes with totals and deltas
console.log(result)
// {
//   success: true,
//   changes: {
//     previousTotal: 500,
//     newTotal: 400,
//     itemsModified: 2,
//     itemsRestored: 1,
//     itemsDeducted: 1
//   }
// }
```

**When to use:** Customer modifies multiple items at once  
**Result:** All changes applied atomically, inventory delta calculated, full audit trail

---

## Error Handling

All functions throw errors with Spanish messages:

```typescript
try {
  await updateOrderItemQuantity(orderId, itemId, 0, userId, userName)
} catch (error) {
  // "La cantidad debe ser mayor a 0"
  console.error(error.message)
}

try {
  await removeOrderItem(orderId, deliveredItemId, userId, userName)
} catch (error) {
  // "No se puede remover item entregado"
  console.error(error.message)
}

try {
  await editOrderItemsWithAudit(paidOrderId, items, userId, userName)
} catch (error) {
  // "No se puede editar un pedido pagado"
  console.error(error.message)
}
```

### Common Error Messages
- "Pedido no encontrado" - Order doesn't exist
- "No se puede editar un pedido pagado" - Order already paid
- "Item no encontrado" - Item doesn't exist in order
- "No se puede remover item entregado" - Item already delivered
- "La cantidad debe ser mayor a 0" - Invalid quantity

---

## Key Features

### ✅ Automatic Inventory Management
- Reduces quantity? → Restores (qty_old - qty_new) units
- Increases quantity? → Deducts (qty_new - qty_old) units
- Removes item? → Restores full quantity
- Adds item? → Deducts full quantity

### ✅ Guaranteed Consistency
- Uses Firebase transactions (all-or-nothing)
- Inventory and order always in sync
- No negative stock allowed

### ✅ Complete Audit Trail
- Every change recorded with before/after values
- User who made change, when, and why
- For compliance and dispute resolution

### ✅ Safe Operations
- Blocks edits on paid orders
- Blocks removal/modification of delivered items
- Clear error messages

---

## Real-World Examples

### Example 1: Customer reduces drink quantity
```typescript
// Customer had 5 gaseosas, now wants 3
await updateOrderItemQuantity(
  "order-123",
  "item-gaseosa-456",
  3,
  "user-789",
  "Mesero Juan",
  "customer_request_less_drink"
)

// What happens:
// 1. Validates order is not paid
// 2. Calculates delta: 3 - 5 = -2
// 3. Restores 2 units to inventory
// 4. Updates item quantity to 3
// 5. Recalculates total: old - (2 * price)
// 6. Creates audit log: quantity_changed, before: 5, after: 3
// 7. All done atomically in one transaction
```

### Example 2: Customer adds pizza after order
```typescript
const newItem = {
  id: undefined, // Will be auto-generated
  storeId: "store-1",
  orderId: "order-123",
  productId: "pizza-001",
  variantId: "personal",
  productName: "Pizza Margherita",
  variantName: "Personal",
  quantity: 1,
  price: 25,
  status: "pending",
  cancelled: false,
  createdAt: new Date(),
  createdBy: "user-789",
  createdByName: "Mesero Juan"
}

const result = await editOrderItemsWithAudit(
  "order-123",
  [...currentItems, newItem],
  "user-789",
  "Mesero Juan",
  "customer_added_pizza"
)

console.log(result.changes)
// {
//   previousTotal: 40,
//   newTotal: 65,
//   itemsModified: 1,
//   itemsDeducted: 1
// }
```

### Example 3: Remove item before served
```typescript
await removeOrderItem(
  "order-123",
  "item-soup-111",
  "user-789",
  "Mesero Juan",
  "customer_changed_mind"
)

// What happens:
// 1. Validates order not paid and item not delivered
// 2. Marks item as cancelled
// 3. Restores full inventory
// 4. Recalculates total without item
// 5. Creates audit: item_removed, quantity restored: 2
```

---

## Console Output

When you call these functions, you'll see professional logging:

```
[Order:edit:start] { orderId: 'order-123', itemsCount: 3 }
[Order:edit:validate] Fetching order and items...
[Order:edit:validate] Checking payment status...
[Order:edit:diff] Computing item differences...
[Order:edit:diff] Item removed or cancelled { itemId: 'item-1', productName: 'Gaseosa', quantity: 2 }
[Order:edit:diff] Item quantity reduced { itemId: 'item-2', productName: 'Pizza', before: 5, after: 3, delta: 2 }
[Order:edit:validate] Checking for delivered items...
[Order:edit:inventory] Applying inventory changes...
[Inventory:deduct:start] { storeId: 'store-1', itemsCount: 0 }
[Order:edit:total] { previousTotal: 150, newTotal: 100, difference: -50 }
[Order:edit:audit] { action: 'order_edited', orderId: 'order-123', changes: {...} }
[Order:edit:success] { orderId: 'order-123', previousTotal: 150, newTotal: 100, itemsRestored: 1, itemsDeducted: 0 }
```

This helps debug and understand what's happening at each step.

---

## Integration Points

### Used in Components:
- Order editing modal/drawer
- Item quantity controls
- Remove item buttons
- Batch edit operations

### Triggers Updates:
- `subscribeToOrders()` - Notifies of order changes
- `subscribeToStoreInventory()` - Notifies of inventory changes
- UI components re-render automatically via onSnapshot()

### Stores Audit:
- OrderAuditLog collection
- Queryable by orderId, userId, timestamp
- Full history available for compliance

---

## Type Definitions

```typescript
// Main input type
interface OrderItem {
  id?: string
  storeId: string
  orderId: string
  productId: string
  variantId?: string
  productName: string
  variantName?: string
  quantity: number
  price: number
  status: "pending" | "sent_to_kitchen" | "preparing" | "ready" | "delivered"
  cancelled: boolean
  cancelReason?: string
  createdAt: Timestamp
  createdBy: string
  createdByName: string
}

// Audit log output
interface OrderAuditLog {
  id?: string
  storeId: string
  orderId: string
  itemId?: string
  action: "order_edited" | "item_quantity_changed" | "item_removed" | ...
  userId: string
  userName: string
  changes: Record<string, { before: any; after: any }>
  timestamp: Timestamp
  notes?: string
}
```

---

## Best Practices

1. **Always provide userId and userName** - For audit trail
2. **Always include changeReason** - Explains why modification was made
3. **Check paymentStatus first** - Before attempting edits (functions do this)
4. **Use dedicated functions** - removeOrderItem() for single removal, updateOrderItemQuantity() for qty
5. **Use batch function** - editOrderItemsWithAudit() for multiple changes at once
6. **Handle errors gracefully** - Display error message to user
7. **Let subscriptions update UI** - Don't manually refetch data

---

## Testing

Comprehensive test file available at:  
`/vercel/share/v0-project/lib/firebase/__tests__/order-editing.test.ts`

Contains test scenarios for all 10 acceptance criteria.

---

## More Information

Full documentation: `ORDER_EDITING_IMPLEMENTATION.md`  
Implementation location: `lib/firebase/firestore.ts` lines 1140-1600
