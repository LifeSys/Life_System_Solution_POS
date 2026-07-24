# Professional Cash Movements System

## Overview

Complete cash movement tracking system for restaurant/pizzeria operations. Handles all financial movements beyond just sales: deposits, withdrawals, tips, provider payments, adjustments, etc.

## Types & Categories

### ENTRADA (Income)
- **fondo_sencillo**: Initial change fund for opening shift
- **dinero_dueno**: Owner deposits from personal funds
- **reposicion**: Cash repositioning during shift (refill change)
- **propina_tienda**: Store tips/shared tips pool
- **propina_mozo**: Waiter/staff tips
- **otro**: Other income

### SALIDA (Outflow)
- **pago_proveedor**: Supplier/vendor payments
- **retiro_dueno**: Owner withdrawal of cash
- **ajuste_arqueo**: Balance adjustments (recount findings)
- **otro**: Other outflow

## Data Model

```typescript
// Financial Movement Document
{
  storeId: string
  type: "cash_movement"
  movementType: "entrada" | "salida"
  category: string (one of 9 categories above)
  amount: number (always positive)
  description: string
  origin: "caja_operativa" | "caja_fuerte"
  userId: string
  userName: string
  timestamp: Timestamp
  archived: boolean
}

// Operational Balance (Single Source of Truth)
{
  storeId: string
  type: "operational"
  balance: number (updated atomically)
  lastUpdated: Timestamp
  updatedBy: string
}

// Audit Log (Complete Trail)
{
  storeId: string
  entityType: "financial_movement"
  entityId: string (movementId)
  action: "cash_movement"
  userId: string
  userName: string
  changes: {
    cashMovement: {
      type: "entrada" | "salida"
      category: string
      amount: number
      origin: string
      previousBalance: number
      newBalance: number
      description: string
    }
  }
  timestamp: Timestamp
  notes: string
}
```

## How It Works

### Balance Update Logic

**ENTRADA (Income):**
```
newBalance = currentBalance + amount
```

**SALIDA (Outflow):**
```
newBalance = currentBalance - amount
```

**Safety Check:**
- Prevent negative balance (except for `ajuste_arqueo` category)
- Throws error if `salida` would go negative

### Transaction Atomicity

All operations are atomic via Firestore Transaction:
1. Read current balance
2. Create financial movement record
3. Update balance
4. Create audit log entry
5. All-or-nothing (no partial updates)

## Usage Example

### From React Component

```typescript
const { recordCashMovement } = usePOS()

// Entrada - Dinero del dueño
await recordCashMovement(
  "entrada",
  "dinero_dueno",
  2000,
  "Depósito del dueño para operaciones",
  "caja_operativa"
)

// Salida - Pago a proveedor
await recordCashMovement(
  "salida",
  "pago_proveedor",
  500,
  "Pago a proveedor XYZ - Factura #123",
  "caja_operativa"
)
```

### From Context

```typescript
import { recordCashMovementTransaction } from "@/lib/firebase/firestore"

const movementId = await recordCashMovementTransaction(
  storeId,
  "entrada",
  "reposicion",
  500,
  "Repositioning cambio",
  userId,
  userName,
  "caja_operativa"
)
```

## Real Scenario: Daily Operations

```
09:00 - Open Caja: S/1000 (initial balance)

09:15 - Entrada: Fondo sencillo S/500
  Balance: 1000 + 500 = 1500

10:30 - Salida: Pago proveedor S/800 (flour delivery)
  Balance: 1500 - 800 = 700

12:00 - Sales: S/1200 cash (auto-added via processPaymentTransaction)
  Balance: 700 + 1200 = 1900

14:30 - Entrada: Dinero dueño S/1000
  Balance: 1900 + 1000 = 2900

16:00 - Salida: Retiro dueño S/500
  Balance: 2900 - 500 = 2400

17:30 - Entrada: Propina tienda S/200
  Balance: 2400 + 200 = 2600

18:00 - Entrada: Ajuste arqueo S/50 (recount found S/50)
  Balance: 2600 + 50 = 2650

20:00 - Close Caja
  Expected balance: S/2650
  Counted: S/2650
  Difference: S/0 ✓ Perfect match
```

## Error Handling

### Validation Errors
- Amount <= 0: "Amount must be greater than 0"
- Negative balance (salida): "Insufficient cash. Current: X, Requested: Y"
- Missing context: Implicit error from missing user/store

### Transaction Failures
- Auto-rollback via Firestore Transaction
- UI should show error message
- Balance not updated if transaction fails

## Audit Trail

Every movement creates two documents:

1. **financialMovements**: Primary business record
   - What happened
   - Amount
   - Category
   - Description
   - Timestamp

2. **auditLogs**: Compliance trail
   - Who made the change
   - When
   - Before/after balance
   - Complete change record
   - Explanation notes

## Integration with Other Systems

### Affected by:
- **processPaymentTransaction**: Automatically adds cash sales to balance
- **closeCashRegister**: Reads final balance for reconciliation

### Affects:
- **operationalBalance** in POS context
- **expectedCash** in sales breakdown
- Final reconciliation on close

## UI Implementation Pattern

For the next phase, the CashMovementModal should:

1. Type selector: Entrada / Salida (radio buttons)
2. Category dropdown: Dynamic options based on type
3. Amount input: Positive number validation
4. Description: Optional textarea
5. Origin selector: caja_operativa (default) / caja_fuerte
6. Submit button: Loading state, error handling
7. Success feedback: Toast or snackbar
8. Auto-refresh: POS context updates automatically

## Testing Checklist

- [ ] Entrada increases balance correctly
- [ ] Salida decreases balance correctly
- [ ] Cannot create salida with insufficient balance
- [ ] ajuste_arqueo can make balance negative (adjustment type)
- [ ] Audit log captures all details
- [ ] Failed transaction doesn't update balance
- [ ] Multiple movements accumulate correctly
- [ ] Close reconciliation reads final balance
- [ ] User/timestamp recorded for all movements
- [ ] Descriptions are optional but recorded

## Future Enhancements

- [ ] Movement categorization by date/shift
- [ ] Summary reports by category
- [ ] Top-up requests workflow
- [ ] Strong box (caja fuerte) tracking
- [ ] Per-user movement quotas
- [ ] Approval workflow for large movements
- [ ] Automated daily reconciliation reports

