## Financial Module Documentation

### Overview

The Financial Module is a comprehensive system for managing expenses, cash boxes, and providers within the LifeSystemSolution POS system. It integrates seamlessly with the existing architecture and provides real-time financial visibility.

---

## Architecture

### Data Model

#### Cash Boxes
The system manages three types of cash boxes:
- **Operational**: Day-to-day working cash
- **Principal**: Main cash register
- **Strongbox**: Secure storage for large amounts

#### Expense Categories
1. **supplies** - Compras/Insumos
2. **providers** - Pagos a Proveedores
3. **delivery** - Entregas/Envíos
4. **maintenance** - Mantenimiento
5. **cleaning** - Limpieza
6. **services** - Servicios (Internet, Teléfono, etc)
7. **utilities** - Servicios Básicos (Luz, Agua, Gas)
8. **salaries** - Sueldos
9. **transportation** - Movilidad/Combustible
10. **emergency** - Gastos de Emergencia
11. **other** - Otros Gastos

### Collections

#### Providers
```typescript
{
  name: string
  contact?: string
  phone?: string
  email?: string
  products?: string[]
  balance: number // Owed to provider
  totalPaid: number
  storeId: string
  active: boolean
  createdAt: Timestamp
}
```

#### Expenses
```typescript
{
  amount: number
  category: ExpenseCategory
  description: string
  cashBoxOrigin: CashBoxType
  userId: string
  userName: string
  providerId?: string
  receipt?: string
  notes?: string
  isVoid?: boolean
  voidReason?: string
  storeId: string
  createdAt: Timestamp
}
```

#### CashBoxBalances
```typescript
{
  storeId: string
  boxType: CashBoxType
  balance: number
  lastUpdated: Timestamp
}
```

#### AuditLogs
Complete audit trail for all operations:
- Who created/modified/deleted an expense
- What changed (before/after values)
- When it happened
- Why (reason for void, etc)

---

## Core Functions

### Expense Management

#### `registerExpense(storeId, expense)`
Register a new expense with atomic cash box deduction.

```typescript
await registerExpense(storeId, {
  amount: 150.00,
  category: "supplies",
  description: "Compra de queso fresco",
  cashBoxOrigin: "principal",
  userId: user.id,
  userName: user.name,
  notes: "Proveedor: Don Queso"
})
```

**Behavior:**
1. Creates expense document
2. Deducts amount from specified cash box
3. Creates audit log entry
4. Uses transaction for atomicity

#### `voidExpense(expenseId, userId, userName, reason)`
Soft-delete an expense with automatic reversal of cash box deduction.

```typescript
await voidExpense(
  "expense123",
  userId,
  userName,
  "Entrada duplicada"
)
```

**Behavior:**
1. Marks expense as void
2. Records void reason and timestamp
3. Adds amount back to cash box
4. Creates audit log entry

#### `getExpenses(storeId, filters?)`
Query expenses with optional filtering.

```typescript
const expenses = await getExpenses(storeId, {
  category: "supplies",
  cashBox: "operational",
  providerId: "provider123",
  startDate: new Date("2026-05-01"),
  endDate: new Date("2026-05-08"),
  excludeVoid: true
})
```

### Provider Management

#### `registerProvider(storeId, provider)`
Create a new provider record.

```typescript
await registerProvider(storeId, {
  name: "Proveedor Don Queso",
  contact: "Juan Pérez",
  phone: "+51 999 999 999",
  email: "juan@donqueso.com"
})
```

#### `payProvider(storeId, providerId, amount, cashBoxOrigin, userId, userName, notes?)`
Process a payment to a provider.

```typescript
await payProvider(
  storeId,
  "provider123",
  2500.00,
  "strongbox",
  userId,
  userName,
  "Pago de compra anterior"
)
```

**Behavior:**
1. Updates provider balance (reduces debt)
2. Deducts from specified cash box
3. Registers as "providers" expense
4. Creates audit log

#### `getProviders(storeId)`
List all active providers.

### Cash Box Management

#### `getCashBoxBalance(storeId, boxType)`
Get current balance for a cash box.

```typescript
const balance = await getCashBoxBalance(storeId, "operational")
// Returns: 5000.00
```

#### `subscribeToCashBoxBalance(storeId, boxType, callback)`
Real-time subscription to cash box balance changes.

```typescript
const unsub = subscribeToCashBoxBalance(storeId, "operational", (balance) => {
  console.log("Current balance:", balance)
})

// Clean up when done
unsub()
```

#### `subscribeToRecentExpenses(storeId, callback, limitCount?)`
Real-time subscription to recent expenses.

```typescript
const unsub = subscribeToRecentExpenses(storeId, (expenses) => {
  console.log("Recent expenses:", expenses)
}, 20)
```

---

## UI Components

### GastosDashboard
Main dashboard showing:
- Real-time balances for all three cash boxes
- Total cash across all boxes
- Daily expenses summary
- Recent transactions feed

**Access:** admin, admin_global, cajero

### GastosRegistration
Form to register new expenses:
- Amount input
- Category selection
- Description
- Cash box source selection
- Optional notes
- Validates required fields
- Automatic submission to Firestore

**Access:** admin, admin_global, cajero

### GastosHistory
View and filter expense history:
- Filter by category
- Shows all expenses sorted by date
- Displays void status
- User and timestamp info
- Scrollable list

**Access:** admin, admin_global, cajero

### ProvidersManagement
Manage provider records:
- Add new providers
- View provider details
- Display balance/debt
- Contact information

**Access:** admin, admin_global only

### GastosReports
Financial analytics:
- Select period (today, week, month)
- Total expenses
- Breakdown by category
- Visual progress bars
- Transaction count

**Access:** admin, admin_global only

---

## Security & Audit

### Audit Trail
Every operation is logged:
- **Create**: New expense recorded
- **Update**: Changes tracked (before/after)
- **Void**: Reason, timestamp, user recorded
- **Pay**: Provider payment tracked

### Access Control
- **admin/admin_global**: Full access to all features
- **cajero**: Can register expenses and view history
- **cocina/mesero**: No access to financial module

### Data Integrity
- All operations use Firestore transactions
- Atomicity guaranteed even with multiple cash boxes
- No partial updates possible
- All data store-level isolated

---

## Real-Time Features

### What's Real-Time
✓ Cash box balances (for active monitoring)
✓ Recent expense feed (last 20 transactions)
✓ Active alerts (if needed)

### What's NOT Real-Time
✗ Historical expense queries (loaded on demand)
✗ Reports (calculated on request)
✗ Provider list (minimal updates)

This design prioritizes performance while maintaining visibility on what matters most.

---

## Integration Points

### With Existing POS System
1. **User Context**: Uses existing `useAuth()` for permission checking
2. **Store Context**: All data filtered by `storeId`
3. **UI Components**: Uses existing Button, Card, Input, Select, Textarea
4. **Toast Notifications**: Uses existing `useToast()` hook
5. **Layout**: Follows existing POS layout patterns

### With Cash Register (caja)
- Cash box balances feed into caja module
- Expense deductions update available cash
- Complementary systems (not replacing)

---

## Performance Considerations

### Optimizations
1. **Subscriptions**: Only real-time for active data
2. **Queries**: Firestore queries with proper indexes
3. **Caching**: Client-side state management
4. **Pagination**: History component scrolls efficiently

### Firebase Recommendations
1. Create indexes for common queries:
   ```
   Collection: expenses
   - storeId + category + createdAt
   - storeId + cashBoxOrigin + createdAt
   - storeId + providerId
   ```

2. Set up read quotas if needed

---

## Common Workflows

### Daily Expense Registration
1. User navigates to Gastos module
2. Clicks "Registrar Gasto" tab
3. Fills in amount, category, description
4. Selects cash box source
5. Adds optional notes
6. Clicks "Registrar Gasto"
7. Confirmation toast appears
8. Form clears automatically

### Provider Payment
1. Admin navigates to Gastos
2. Clicks "Proveedores" tab
3. Clicks on provider to view balance
4. Clicks "Pay" (future feature)
5. Enters payment amount
6. Selects cash box source
7. Confirms payment
8. Balance updates automatically

### End-of-Day Review
1. Manager navigates to Gastos
2. Checks "Dashboard" tab
3. Reviews cash box balances
4. Checks daily total expenses
5. Reviews recent transactions
6. Can drill into "Historial" for details

### Report Generation
1. Admin clicks "Reportes" tab
2. Selects period (today, week, month)
3. Reviews total expenses
4. Analyzes by category
5. Identifies high-cost areas
6. Takes action if needed

---

## Troubleshooting

### "Not enough balance" error
The cash box doesn't have enough funds. Check balance before registering expense or transfer funds between boxes (future feature).

### Expense not appearing in real-time
Subscription may have disconnected. Refresh page to re-establish connection.

### Provider balance incorrect
Check if payments were recorded properly. Review audit log for all transactions related to provider.

### Missing categories or cash boxes
Ensure you're not using outdated enums. Restart application to refresh types.

---

## Future Enhancements

1. **Transfer Between Boxes**: Move cash between cash boxes
2. **Receipt Upload**: Attach receipt images to expenses
3. **Export Reports**: PDF/Excel export functionality
4. **Recurring Expenses**: Automatic monthly expense registration
5. **Budget Alerts**: Warn when expenses exceed budget
6. **Provider Debt Management**: Automated payment reminders
7. **Expense Approvals**: Multi-level approval workflow
8. **Advanced Analytics**: Trends, forecasting, comparisons
9. **Mobile App**: Expense registration from phone
10. **Integration with Accounting**: Export to accounting software

---

## API Reference

See `lib/firebase/firestore.ts` for:
- `registerExpense()`
- `registerProvider()`
- `payProvider()`
- `voidExpense()`
- `getCashBoxBalance()`
- `getExpenses()`
- `getProviders()`
- `subscribeToCashBoxBalance()`
- `subscribeToRecentExpenses()`

All functions are fully typed with TypeScript and include comprehensive JSDoc comments.

---

**Module Status**: Production Ready
**Last Updated**: May 8, 2026
**Version**: 1.0
