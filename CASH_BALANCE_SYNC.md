# Cash Balance Synchronization Fix

## Problem

When closing cash register with distribution, the system threw error:
```
Distribution mismatch. Balance: 0, Distribution: 1300
```

**UI showed:** S/1300 cash available (opening S/1000 + sales S/300)
**Firestore showed:** balance = 0
**Result:** Cannot distribute cash, error blocks closure

## Root Cause Analysis

The system had three cash-related operations but only two were updating Firestore:

1. **openCashRegister()** ✓ Updated balance
   ```javascript
   await setDoc(operationalBalanceRef, {
     balance: initialAmount,  // S/1000
     ...
   })
   ```

2. **processPaymentTransaction()** ✗ Did NOT update balance
   - Marked order as paid
   - Updated table status
   - ~~But never updated balances/{storeId}_operational~~

3. **closeCashRegister()** ✗ Did NOT update balance
   - Just saved snapshot
   - Never synced with Firestore

4. **distributeCashOnClosureTransaction()** ✓ Reads balance
   - But reads 0 because never updated
   - Throws mismatch error

## Data Flow Before Fix

```
Open: balance = 1000 ✓
  ↓
Sell S/100 cash: UI balance = 1100 (local only)
  ↓
Sell S/200 cash: UI balance = 1300 (local only)
  ↓
Close: tries to distribute S/1300
  ↓
Reads Firestore balance = 0 (never updated!)
  ↓
ERROR: Distribution mismatch
```

## Solution

Enhanced `processPaymentTransaction()` to atomically update operational balance:

### Code Changes

**lib/firebase/firestore.ts:**
```typescript
export async function processPaymentTransaction(
  orderId: string,
  tableId: string,
  payments: Payment[],
  orderTotal: number,
  cashRegisterId: string,
  storeId?: string  // NEW: Accept storeId to update balance
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // ... existing validation code ...

    // NEW: Update operational balance if cash payment
    const cashPaymentAmount = payments
      .filter(p => p.method === "cash")
      .reduce((sum, p) => sum + p.amount, 0)

    if (cashPaymentAmount > 0 && storeId) {
      const opBalanceRef = doc(db, collections.cashBoxBalances, `${storeId}_operational`)
      const opBalanceSnap = await transaction.get(opBalanceRef)

      if (opBalanceSnap.exists()) {
        const currentBalance = (opBalanceSnap.data() as CashBoxBalance).balance || 0
        transaction.update(opBalanceRef, {
          balance: currentBalance + cashPaymentAmount,  // ADD payment to balance
          lastUpdated: serverTimestamp(),
        })
      }
    }
  })
}
```

**contexts/pos-context.tsx:**
```typescript
await processPaymentTransaction(
  orderId,
  order.tableId,
  payments,
  order.total,
  cashRegister.id,
  currentStoreId  // NEW: Pass storeId for balance update
)
```

## Data Flow After Fix

```
Open: balance = 1000 ✓
  ↓
Sell S/100 cash: 
  - UI balance = 1100 ✓
  - Firestore balance = 1100 ✓
  ↓
Sell S/200 cash:
  - UI balance = 1300 ✓
  - Firestore balance = 1300 ✓
  ↓
Close: tries to distribute S/1300
  ↓
Reads Firestore balance = 1300 ✓
  ↓
SUCCESS: Distribution matches
```

## How It Works

1. **When order is paid in cash:**
   - Extract cash amount from payments array
   - In atomic transaction:
     - Read current operational balance
     - Add cash amount to balance
     - Write updated balance to Firestore

2. **When order is paid by card/Yape:**
   - Extract cash amount = 0
   - Balance not updated (correct!)

3. **When order is paid mixed (cash + card):**
   - Extract only cash portion
   - Add only cash to balance

## Example Scenarios

### Scenario 1: Multiple Cash Sales
```
Opening: S/1000
Sale 1: S/100 cash → balance = 1100
Sale 2: S/150 cash → balance = 1250
Sale 3: S/75 cash → balance = 1325
Closing: Distribute S/1325 ✓
```

### Scenario 2: Mixed Payments
```
Opening: S/1000
Sale 1: S/200 cash + S/0 card → balance = 1200
Sale 2: S/0 cash + S/300 card → balance = 1200 (unchanged)
Sale 3: S/100 cash + S/100 card → balance = 1300
Closing: Distribute S/1300 ✓
```

### Scenario 3: Expenses
```
Note: Expenses are NOT yet integrated with balance.
They should be added in future update.
```

## Security & Atomicity

- **Atomic:** Uses Firebase transaction (all-or-nothing)
- **Consistent:** Balance always reflects actual cash received
- **Isolated:** No race conditions with concurrent payments
- **Durable:** Persisted immediately in Firestore

## Testing

**✓ Test Scenarios:**
1. Open register S/1000
2. Sell item for S/50 cash → balance should be 1050
3. Sell item for S/25 card → balance should stay 1050
4. Sell item for S/75 cash → balance should be 1125
5. Close register and distribute → should work

**✓ Error Cases:**
1. If distribution > balance → error (correct)
2. If distribution < balance → error (correct, leftover must be allocated)
3. If exactly matches → success ✓

## Future Improvements

1. **Add expense support:**
   - Record expenses in transaction
   - Subtract from operational balance
   - Track expenses separately

2. **Add initial floats/loans:**
   - Loan someone money from register
   - Update balance accordingly

3. **Add manual adjustments:**
   - For reconciliation errors
   - Audit trail for corrections

4. **Real-time sync:**
   - Show actual balance in UI (subscribe to Firestore)
   - Not just local calculation

## Files Changed

- `lib/firebase/firestore.ts`: Enhanced processPaymentTransaction
- `contexts/pos-context.tsx`: Pass storeId to function

## Deployment

✓ Build: 11/11 routes prerendered
✓ No TypeScript errors
✓ No breaking changes
✓ Backwards compatible (storeId optional)
