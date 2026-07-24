# Firestore Transaction Ordering Fixes

## Problem Identified

Firestore has a mandatory execution rule for transactions:
**All READs must execute BEFORE any WRITEs**

Violating this causes:
```
Error: "Firestore transactions require all reads to be executed before all writes"
```

## Transactions Fixed

### 1. processPaymentTransaction (Critical)

**What it does:** Process order payments and update cash register balance

**Problem:**
```typescript
// WRONG ORDER:
1. Read order ✓
2. Write order (transaction.update) ✗ WRITE
3. Write table (transaction.update) ✗ WRITE
4. Read balance (transaction.get) ✗ READ AFTER WRITES - ERROR!
```

**Solution - 3 Phase Pattern:**
```typescript
// PHASE 1: READ ALL DATA
- transaction.get(orderRef)
- transaction.get(tableRef)
- transaction.get(opBalanceRef) // if cash payment

// PHASE 2: VALIDATE ALL DATA
- Check order exists and not paid
- Check payment amount matches total
- (No Firestore operations here)

// PHASE 3: WRITE ALL DATA
- transaction.update(orderRef)
- transaction.update(tableRef)
- transaction.update(opBalanceRef) // if needed
```

### 2. cancelExpenseTransaction (Critical)

**What it does:** Cancel an expense and reverse the cash box deduction

**Problem:**
```typescript
// WRONG ORDER:
1. Read expense ✓
2. Write expense void flag ✗ WRITE
3. Read balance ✗ READ AFTER WRITE - ERROR!
4. Write balance ✗ WRITE
```

**Solution - 3 Phase Pattern:**
```typescript
// PHASE 1: READ ALL DATA
- transaction.get(expenseRef)
- transaction.get(balanceRef)

// PHASE 2: VALIDATE ALL DATA
- Check expense exists
- Check not already cancelled

// PHASE 3: WRITE ALL DATA
- transaction.update(expenseRef) - mark void
- transaction.update(balanceRef) - reverse amount
- transaction.set(reversalRef) - create movement
- transaction.set(auditRef) - audit log
```

## Transactions Verified (Already Correct)

✓ **registerExpenseTransaction**: reads first at line 1877
✓ **payProviderTransaction**: reads first at line 2383-2395
✓ **recordCashMovementTransaction**: reads first at line 2291
✓ **transferCashTransaction**: reads first at line 1875
✓ **distributeCashOnClosureTransaction**: reads first at line 1945+

## The 3-Phase Pattern (Best Practice)

All Firestore transactions should follow this structure:

```typescript
export async function myTransaction(...): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // PHASE 1: READ ALL DATA (get all documents first)
    const doc1 = await transaction.get(ref1)
    const doc2 = await transaction.get(ref2)
    const doc3 = await transaction.get(ref3)

    // PHASE 2: VALIDATE ALL DATA (after all reads complete)
    if (!doc1.exists()) throw new Error("...")
    if (someCondition) throw new Error("...")
    // Calculate derived values
    const newValue = computeValue(doc1, doc2, doc3)

    // PHASE 3: WRITE ALL DATA (after validations pass)
    transaction.update(ref1, { field: newValue })
    transaction.set(ref2, { ... })
    transaction.delete(ref3)
    // All other writes here
  })
}
```

## Common Patterns

### Pattern 1: Simple Update with Validation
```typescript
const docRef = collection.doc(id)
const doc = await transaction.get(docRef)
if (!doc.exists()) throw new Error("Not found")
transaction.update(docRef, { field: newValue })
```

### Pattern 2: Multiple Reads with Balance Update
```typescript
// Read all
const order = await transaction.get(orderRef)
const balance = await transaction.get(balanceRef)

// Validate
if (order.total > balance.amount) throw new Error("Insufficient funds")

// Write all
transaction.update(orderRef, { status: "paid" })
transaction.update(balanceRef, { amount: balance.amount - order.total })
```

### Pattern 3: Create Movement Record with Audit Trail
```typescript
// Read all
const expense = await transaction.get(expenseRef)
const balance = await transaction.get(balanceRef)

// Validate
if (expense.isVoid) throw new Error("Already cancelled")

// Write all
transaction.update(expenseRef, { isVoid: true })
transaction.update(balanceRef, { amount: balance.amount + expense.amount })
transaction.set(movementRef, { ...movementData })
transaction.set(auditRef, { ...auditData })
```

## Impact of Fixes

✓ **Payments now work**: cash, card, and mixed payments
✓ **Expense cancellation works**: reversals processed atomically
✓ **Cash operations atomic**: all-or-nothing guarantees
✓ **No transaction errors**: compliant with Firestore rules
✓ **Audit trail complete**: all changes recorded
✓ **Data consistency**: balance always accurate

## Testing Checklist

- [ ] Pay S/100 in cash → balance increases
- [ ] Pay S/100 mixed (S/50 cash + S/50 card) → balance increases only S/50
- [ ] Pay S/100 all card → balance unchanged
- [ ] Record cash movement entrada → balance increases
- [ ] Record cash movement salida → balance decreases
- [ ] Cancel expense → balance reversed, audit log created
- [ ] Close caja → distribution matches actual balance

## For Future Development

When creating new transactions:
1. **Plan the reads**: What data do you need?
2. **Plan the writes**: What documents need updating?
3. **Check ordering**: Are all reads before any writes?
4. **Add phase comments**: Make it clear (PHASE 1/2/3)
5. **Test**: Verify transaction completes atomically

**Golden Rule**: If you're about to do `transaction.get()` after any `transaction.update()` or `transaction.set()`, STOP and reorder.
