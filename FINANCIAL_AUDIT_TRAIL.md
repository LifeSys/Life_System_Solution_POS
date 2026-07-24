# Financial Audit Trail System - Trazabilidad Completa

## Overview

Complete financial audit trail system for all cash movements in the restaurant. Every peso is tracked, logged, and displayed with full traceability.

## What Gets Recorded

### 1. Every Financial Movement Creates TWO Documents:

**A. Financial Movement (append-only):**
- Type: entrada, salida, deposito, retiro, gasto
- Category: dinero_dueno, fondo_sencillo, pago_proveedor, retiro_dueno, ajuste_arqueo, etc
- Amount: in soles
- Origin: caja_operativa, caja_fuerte
- Balance After: what the balance was after this movement
- User: who performed the action
- Timestamp: exact date/time with Peru timezone
- Description: why/context of movement

**B. Audit Log:**
- Entity type, ID, action
- User who performed it
- Before/after balances
- Complete change details
- Notes: human-readable summary

### 2. Transactions That Generate Financial Movements

All of these automatically create financial movement + audit log:

| Function | Movement Type | Collection |
|----------|---------------|-----------|
| processPaymentTransaction | entrada | sales → cash |
| registerExpenseTransaction | gasto | expense recorded |
| payProviderTransaction | salida | provider payment |
| recordCashMovementTransaction | entrada/salida | manual movement |
| recordCashAdjustmentTransaction | ajuste | balance adjustment |
| transferCashTransaction | transferencia | cash transfer |
| distributeCashOnClosureTransaction | distribucion | daily distribution |
| cancelExpenseTransaction | reversal | expense cancellation |
| depositToSafeBoxFromClosure | deposito | safe box deposit |

## Append-Only Enforcement

**CRITICAL:** Financial movements are NEVER edited, NEVER overwritten.

```typescript
// What happens:
// 1. Create movement → Firestore WRITE to financialMovements
// 2. Create audit log → Firestore WRITE to auditLogs
// 3. Update balance → Firestore WRITE to appropriate balance document

// What NEVER happens:
// ❌ Update or delete a movement
// ❌ Recalculate historical data
// ❌ Change timestamps or amounts

// Result: Permanent, immutable record for compliance
```

## Data Storage

### Collections

**financialMovements (active, < 90 days):**
```typescript
{
  id: string,
  storeId: string,
  type: "cash_movement" | "sale" | "expense" | etc,
  movementType: "entrada" | "salida" | "deposito" | etc,
  category: string,
  amount: number,
  origin: "caja_operativa" | "caja_fuerte",
  description: string,
  userId: string,
  userName: string,
  timestamp: Timestamp,
  previousBalance: number,
  archived: false
}
```

**financialMovements_archived (> 90 days):**
- Same structure as active, used for historical queries

**auditLogs:**
```typescript
{
  storeId: string,
  entityType: "financial_movement",
  entityId: string,
  action: string,
  userId: string,
  userName: string,
  changes: {...},
  timestamp: Timestamp,
  notes: string
}
```

## UI Component: CompleteFinancialAudit

Located: `components/caja/complete-financial-audit.tsx`

### Features

1. **Date Range Filter**
   - From/To dates
   - Default: last 30 days
   - Query automatically updates

2. **Category Filter**
   - Dropdown with all categories
   - Dynamically populated from data

3. **Summary Cards**
   - Entradas (income total)
   - Salidas (outflow total)
   - Neto (net: entradas - salidas)

4. **Comprehensive Audit Table**
   - Columns: DateTime | Type | Category | Origin | Amount | Balance After | User | Description
   - Color-coded type badges
   - Hover effects for readability
   - Sortable by timestamp (descending)

5. **Data Validation**
   - Loads up to 500 movements per query
   - Shows loading state
   - Error handling
   - Empty state

### Example Display

```
Historial Financiero Completo (Append-only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Filters:    [Desde: 05/01/2026] [Hasta: 05/10/2026] [Categoría: Todas]

Summary:
  Entradas: S/ 15,420.50     Salidas: S/ 8,240.00     Neto: S/ 7,180.50

Audit Table:
┌─────────────────┬──────────┬──────────────────┬──────────────┬────────┬─────────────┬────────┬─────────────────────┐
│ Fecha/Hora      │ Tipo     │ Categoría        │ Origen       │ Monto  │ Balance Después │ Usuario│ Descripción         │
├─────────────────┼──────────┼──────────────────┼──────────────┼────────┼─────────────┼────────┼─────────────────────┤
│ 09/05 10:32 AM │ Salida  │ Retiro Dueño     │ Caja Fuerte  │ -200   │ S/ 222      │ Admin  │ Pago urgente        │
│ 09/05 09:15 AM │ Entrada │ Dinero Dueño     │ Operativa    │ +500   │ S/ 1,500    │ Admin  │ Depósito inicial    │
│ 09/04 08:45 PM │ Salida  │ Pago Proveedor   │ Operativa    │ -800   │ S/ 1,000    │ Admin  │ Factura #2024       │
└─────────────────┴──────────┴──────────────────┴──────────────┴────────┴─────────────┴────────┴─────────────────────┘

Append-only: Este historial nunca se edita. Cada movimiento es un registro permanente.
Total movimientos: 847
```

## Backend Functions

### getFinancialMovements()

```typescript
export async function getFinancialMovements(
  storeId: string,
  startDate: Date,
  endDate: Date,
  limit_val: number = 100
): Promise<FinancialMovement[]>
```

**Query Logic:**
- If date range < 90 days: query `financialMovements` (active)
- If date range > 90 days: query `financialMovements_archived` (historical)
- Orders by timestamp descending
- Includes all fields needed for display

**Returns:**
- Array of FinancialMovement objects
- Sorted newest first
- Complete audit trail

## Integration in Caja Page

```typescript
// app/caja/page.tsx
import { CompleteFinancialAudit } from "@/components/caja/complete-financial-audit"

export default function CajaPage() {
  const { currentStoreId } = usePOS()
  
  return (
    <>
      {/* Other components */}
      {currentStoreId && <CompleteFinancialAudit storeId={currentStoreId} isOpen={true} />}
    </>
  )
}
```

## Example: Complete Movement Lifecycle

### User Action: Withdraw S/500 from safe box

**1. User clicks "Movimiento de Caja"**
- Modal opens

**2. User fills form**
- Type: Salida
- Category: Retiro Dueño
- Amount: 500
- Origin: Caja Fuerte
- Description: "Pago urgente proveedor"

**3. Backend processes (recordCashMovementTransaction)**

**Step A: READ PHASE**
```
Read: safe_box/{storeId}
currentBalance = 2000
```

**Step B: VALIDATE PHASE**
```
newBalance = 2000 - 500 = 1500
1500 >= 0? YES ✓
```

**Step C: WRITE PHASE**
```
1. Write financialMovement:
   {
     storeId,
     type: "cash_movement",
     movementType: "salida",
     category: "retiro_dueno",
     amount: 500,
     origin: "caja_fuerte",
     description: "Pago urgente proveedor",
     userId: "user_123",
     userName: "Admin General",
     timestamp: 2026-05-10T10:32:15.000Z,
     previousBalance: 2000,
     archived: false
   }

2. Update safe_box/{storeId}:
   currentBalance = 1500
   updatedAt = now

3. Write auditLog:
   {
     storeId,
     entityType: "financial_movement",
     action: "cash_movement",
     userId: "user_123",
     userName: "Admin General",
     changes: {...},
     timestamp: 2026-05-10T10:32:15.000Z,
     notes: "Cash salida: retiro_dueno. Amount: 500. From: caja_fuerte. Balance: 2000 → 1500"
   }
```

**4. UI auto-updates**
- CompleteFinancialAudit component subscribed to getFinancialMovements
- Shows new entry immediately

**5. Audit Trail Shows**
```
09/05 10:32 AM | Salida | Retiro Dueño | Caja Fuerte | -S/500 | S/1500 | Admin General | Pago urgente proveedor
```

## Compliance & Legal

### Append-Only Guarantee
- Never edited, overwritten, or deleted
- Permanent immutable record
- Every change has who/when/why
- Can be audited by external parties

### Traceability Features
- Complete user attribution
- Exact timestamps (Peru timezone)
- Before/after balances
- Category classification
- Origin tracking (operativa vs fuerte)
- Descriptive notes

### Data Retention
- Active movements: stored in `financialMovements` (< 90 days)
- Historical movements: archived to `financialMovements_archived` (> 90 days)
- Never deleted, only archived
- Full query coverage (both collections searched based on date range)

## Testing Checklist

- [ ] Create cash movement entrada → appears in audit trail
- [ ] Create cash movement salida → appears in audit trail
- [ ] Process payment → shows in audit with "entrada" type
- [ ] Register expense → shows in audit with "gasto" type
- [ ] Pay provider → shows in audit with "salida" type
- [ ] Cancel expense → shows reversal in audit
- [ ] Filter by date range → correct movements shown
- [ ] Filter by category → correct category shown
- [ ] Summary totals match filtered movements
- [ ] Verify timestamps in Peru timezone
- [ ] Verify balance calculations are correct
- [ ] Verify append-only: movements never edited
- [ ] Verify 90-day cutoff: old movements query archived collection
- [ ] Export scenario: all movements queryable for report

## Future Enhancements

- [ ] Export audit trail to CSV/PDF
- [ ] Digital signature for compliance
- [ ] Role-based visibility (manager vs admin)
- [ ] Alert thresholds for large movements
- [ ] Suspicious pattern detection
- [ ] Monthly reconciliation reports
- [ ] Integration with tax reporting systems
