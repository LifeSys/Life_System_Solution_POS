# Financial API Reference - LifeSystemSolution POS

**Purpose**: Single source of truth for all financial function usage  
**Status**: Production Ready  
**Last Updated**: May 8, 2026  

---

## Critical Rule

**ALWAYS USE TRANSACTIONAL FUNCTIONS FOR MONEY OPERATIONS**

Transactional functions guarantee:
- ✓ Atomic operations (all-or-nothing)
- ✓ Automatic rollback on error
- ✓ Concurrency safety
- ✓ Complete audit trail
- ✓ No data corruption

---

## TRANSACTIONAL FUNCTIONS (Required for Money Operations)

### 1. registerExpenseTransaction()

**Purpose**: Register an expense with automatic cash box deduction

**Function Signature**:
```typescript
async function registerExpenseTransaction(
  storeId: string,
  expense: Omit<Expense, "id" | "createdAt" | "isVoid">,
  userId: string,
  userName: string
): Promise<string>
```

**What It Does**:
1. Creates expense document
2. Creates financial movement
3. Updates cash box balance (automatic deduction)
4. Creates audit log
5. **ALL ATOMIC** - if any step fails, all rollback

**Expense Object Fields**:
```typescript
{
  amount: number                    // Expense amount
  category: ExpenseCategory         // Category from 13 options
  description: string               // Short description
  cashBoxOrigin: CashBoxType        // Which box: "operational" | "principal" | "strongbox"
  userId: string                    // User ID
  userName: string                  // User name for audit
  providerId?: string               // Optional provider ID
  notes?: string                    // Optional notes
}
```

**Usage Example**:
```typescript
const expenseId = await registerExpenseTransaction(
  store.id!,
  {
    amount: 150.50,
    category: "supplies",
    description: "Office supplies purchase",
    cashBoxOrigin: "operational",
    userId: user.id!,
    userName: user.name,
    notes: "Ordered from Amazon",
  },
  user.id!,
  user.name
)
```

**Error Handling**:
- Throws if insufficient funds in cash box
- Throws if invalid category
- Throws if invalid cash box type
- Clear error messages

---

### 2. distributeCashOnClosureTransaction()

**Purpose**: Atomically distribute cash from operational box to principal/strongbox during closure

**Function Signature**:
```typescript
async function distributeCashOnClosureTransaction(
  storeId: string,
  cajaClosureId: string,
  distribution: {
    toPrincipal: number
    toStrongbox: number
    remaining: number
  },
  userId: string,
  userName: string
): Promise<string>
```

**What It Does**:
1. Validates distribution sums correctly
2. Creates distribution record
3. Creates 1-2 financial movements
4. Updates operational, principal, strongbox balances
5. Creates audit log
6. **ALL ATOMIC** - all boxes updated together or none

**Usage Example**:
```typescript
await distributeCashOnClosureTransaction(
  store.id!,
  closureId,
  {
    toPrincipal: 700,    // Move 700 to principal
    toStrongbox: 300,    // Move 300 to strongbox
    remaining: 200       // Leave 200 in operational
  },
  user.id!,
  user.name
)
```

---

### 3. transferCashTransaction()

**Purpose**: Transfer cash between principal and strongbox

**Function Signature**:
```typescript
async function transferCashTransaction(
  storeId: string,
  fromBox: "principal" | "strongbox",
  toBox: "principal" | "strongbox",
  amount: number,
  reason: string,
  userId: string,
  userName: string
): Promise<string>
```

**What It Does**:
1. Validates source has funds
2. Creates financial movement
3. Updates both balances atomically
4. Creates audit log
5. **ATOMIC** - both boxes updated together or none

**Usage Example**:
```typescript
await transferCashTransaction(
  store.id!,
  "principal",
  "strongbox",
  500,
  "End of week consolidation",
  user.id!,
  user.name
)
```

---

### 4. payProviderTransaction()

**Purpose**: Pay a provider from principal or strongbox

**Function Signature**:
```typescript
async function payProviderTransaction(
  storeId: string,
  providerId: string,
  amount: number,
  boxSource: "principal" | "strongbox",
  reason: string,
  userId: string,
  userName: string
): Promise<string>
```

**What It Does**:
1. Gets provider, validates existence
2. Gets cash box balance, validates funds
3. Creates expense record (category: "providers")
4. Creates financial movement
5. Updates provider balance + total paid
6. Updates cash box balance
7. Creates audit log
8. **ATOMIC** - provider and cash synchronized

**Usage Example**:
```typescript
await payProviderTransaction(
  store.id!,
  providerId,
  1500.00,
  "strongbox",
  "Monthly supplier payment",
  user.id!,
  user.name
)
```

---

### 5. cancelExpenseTransaction()

**Purpose**: Soft delete an expense with automatic balance reversal

**Function Signature**:
```typescript
async function cancelExpenseTransaction(
  storeId: string,
  expenseId: string,
  reason: string,
  userId: string,
  userName: string
): Promise<void>
```

**What It Does**:
1. Gets expense, validates exists and not already void
2. Marks expense as void
3. Reverses cash box balance (adds amount back)
4. Creates reversal movement (negative amount)
5. Creates audit log
6. **ATOMIC** - balance always matches expense state

**Usage Example**:
```typescript
await cancelExpenseTransaction(
  store.id!,
  expenseId,
  "Recorded in error - will reimburse later",
  user.id!,
  user.name
)
```

---

## QUERY FUNCTIONS (Load-Based, No Real-Time)

### 1. getAllCashBoxBalances()

**Purpose**: Get current balance for all cash boxes

**Returns**: `Record<CashBoxType, number>`

```typescript
const balances = await getAllCashBoxBalances(storeId)
// Returns:
// {
//   operational: 1500.00,
//   principal: 5000.00,
//   strongbox: 25000.00
// }
```

---

### 2. getRecentExpenses()

**Purpose**: Get expenses from last N days with pagination

```typescript
const expenses = await getRecentExpenses(
  storeId,
  30,      // daysBack (default: 30)
  100,     // limit (default: 100)
  0        // offset (default: 0)
)
```

---

### 3. getFinancialMovements()

**Purpose**: Get movements with smart active/archived routing

```typescript
const movements = await getFinancialMovements(
  storeId,
  startDate,
  endDate,
  limit
)
// Auto-routes based on date range:
// - If < 90 days: queries active collection
// - If > 90 days: queries archived collection
```

---

### 4. getHistoricalReportFromSnapshots()

**Purpose**: Get report from daily snapshots (MOST EFFICIENT)

```typescript
const report = await getHistoricalReportFromSnapshots(
  storeId,
  "2024-05-01",  // startDate YYYY-MM-DD
  "2024-05-31"   // endDate YYYY-MM-DD
)
// Returns:
// {
//   totalSales: 15000,
//   totalExpenses: 2500,
//   snapshots: [DailyFinancialSummary[], ...]
// }
```

**Why Use This**: 1000x faster than movement iteration

---

### 5. getTodaysFinancialSnapshot()

**Purpose**: Get today's consolidated financial summary

```typescript
const snapshot = await getTodaysFinancialSnapshot(storeId)
// Returns DailyFinancialSummary or null
```

---

### 6. getArchivalStatus()

**Purpose**: Check archival health (for monitoring)

```typescript
const status = await getArchivalStatus(storeId)
// Returns:
// {
//   activeMovementCount: 245,
//   archivedMovementCount: 15000,
//   oldestActiveRecord: Date,
//   newestArchivedRecord: Date
// }
```

---

## SUBSCRIPTION FUNCTIONS (Real-Time, Critical Only)

### 1. subscribeToCashBoxBalances()

**Purpose**: Real-time balance updates for all boxes

```typescript
const unsubscribe = subscribeToCashBoxBalances(
  storeId,
  (balances) => {
    // Called whenever balances change
    console.log(`Operational: ${balances.operational}`)
    console.log(`Principal: ${balances.principal}`)
    console.log(`Strongbox: ${balances.strongbox}`)
  }
)

// Unsubscribe when done
unsubscribe()
```

**Performance**: < 500ms updates  
**Use In**: Dashboard balance cards, real-time monitoring

---

### 2. subscribeToRecentMovements()

**Purpose**: Real-time movements from last N hours (max 50)

```typescript
const unsubscribe = subscribeToRecentMovements(
  storeId,
  (movements) => {
    // Called whenever recent movements change
    movements.forEach((m) => {
      console.log(`${m.type}: ${m.amount}`)
    })
  },
  24  // hoursBack (default: 24, limit: 24)
)

unsubscribe()
```

**Performance**: < 500ms updates  
**Use In**: Activity feed, recent operations list

---

### 3. subscribeToCriticalAlerts()

**Purpose**: Real-time low balance warnings

```typescript
const unsubscribe = subscribeToCriticalAlerts(
  storeId,
  (alerts) => {
    alerts.forEach((alert) => {
      if (alert.severity === "critical") {
        showNotification(alert.message)
      }
    })
  },
  {
    operational: 1000,  // Alert if < 1000
    principal: 5000,    // Alert if < 5000
    strongbox: 10000    // Alert if < 10000
  }
)

unsubscribe()
```

**Thresholds**: Customizable, defaults shown  
**Severity**: "warning" | "critical"  

---

## DEPRECATED FUNCTIONS (Do Not Use)

The following functions are DEPRECATED and should NOT be used:

| Deprecated | Use Instead |
|-----------|-----------|
| `registerExpense()` | `registerExpenseTransaction()` |
| `payProvider()` | `payProviderTransaction()` |
| `voidExpense()` | `cancelExpenseTransaction()` |
| `getCashBoxBalance()` | `getAllCashBoxBalances()` |
| `subscribeCashBoxBalance()` | `subscribeToCashBoxBalances()` |

These old functions will be removed in a future update. Please migrate all code to use the transaction-based functions.

---

## TYPES & ENUMS

### CashBoxType
```typescript
type CashBoxType = "operational" | "principal" | "strongbox"
```

### ExpenseCategory
```typescript
type ExpenseCategory =
  | "supplies"        // Compras/Insumos
  | "providers"       // Pagos a Proveedores
  | "delivery"        // Entregas/Envíos
  | "maintenance"     // Mantenimiento
  | "cleaning"        // Limpieza
  | "services"        // Servicios (Internet, etc)
  | "utilities"       // Luz, Agua, Gas
  | "salaries"        // Sueldos
  | "transportation"  // Movilidad/Combustible
  | "emergency"       // Gastos de Emergencia
  | "other"           // Otros Gastos
```

---

## BEST PRACTICES

### 1. Always Use Transactions for Money

```typescript
// ✓ CORRECT
await registerExpenseTransaction(...)

// ✗ WRONG
await registerExpense(...)
```

### 2. Always Provide User Attribution

```typescript
await registerExpenseTransaction(
  storeId,
  expenseData,
  user.id!,        // ✓ Required
  user.name        // ✓ Required
)
```

### 3. Use Snapshots for Reports

```typescript
// ✓ CORRECT - Fast, pre-calculated
const report = await getHistoricalReportFromSnapshots(...)

// ✗ SLOW - Iterates all movements
const movements = await getFinancialMovements(...)
movements.forEach(m => total += m.amount)
```

### 4. Limit Real-Time Subscriptions

```typescript
// ✓ CORRECT - Only 3-4 active subscriptions
const unsubBalance = subscribeToCashBoxBalances(...)
const unsubMovements = subscribeToRecentMovements(...)

// ✗ WRONG - Listener spam
const unsub1 = subscribeToX(...)
const unsub2 = subscribeToY(...)
const unsub3 = subscribeToZ(...)
// ... many more
```

### 5. Always Unsubscribe

```typescript
useEffect(() => {
  const unsubscribe = subscribeToCashBoxBalances(...)
  
  return () => {
    unsubscribe()  // ✓ Cleanup
  }
}, [])
```

---

## ERROR HANDLING

All transactional functions throw errors with clear messages:

```typescript
try {
  await registerExpenseTransaction(...)
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("Insufficient funds")) {
      // Handle insufficient funds
    } else if (error.message.includes("Provider not found")) {
      // Handle missing provider
    } else {
      // Handle other errors
    }
  }
}
```

---

## Performance Characteristics

| Operation | Speed | Use Case |
|-----------|-------|----------|
| Real-time balance update | < 500ms | Dashboard |
| Recent movements query | < 200ms | Activity feed |
| Monthly report (snapshot) | < 1 second | Reports |
| Monthly report (movement iter) | 5-10 seconds | Avoid |
| Transactional operation | < 1 second | All money ops |

---

## Audit Trail

Every transactional operation creates an audit log entry with:
- **entityType**: Type of entity (expense, provider, etc)
- **action**: What happened (create, void, transfer, etc)
- **userId**: Who did it
- **userName**: User's name
- **timestamp**: When (server-generated)
- **changes**: What changed (before/after values)
- **notes**: Additional context

This ensures complete compliance and accountability.

---

## Multi-Store Isolation

All functions automatically filter by `storeId`:
- Every collection document has `storeId` field
- Every query filters by `storeId`
- No cross-store data leakage possible
- Safe for 10+ locations

---

## Summary

- **Use Transactions**: For all money operations
- **Use Queries**: For load-based history
- **Use Snapshots**: For reports (1000x faster)
- **Use Subscriptions**: Sparingly, for real-time critical data only
- **Provide Attribution**: Always include userId/userName
- **Unsubscribe**: Always cleanup subscriptions
- **Check Errors**: Handle insufficient funds and validation errors

For questions or clarifications, refer to `/lib/firebase/firestore.ts` implementation.
