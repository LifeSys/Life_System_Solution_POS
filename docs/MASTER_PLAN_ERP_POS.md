# MultiPizza ERP/POS System - Master Architectural Plan

## Executive Summary

Building a professional, scalable ERP/POS system for restaurant operations. This document outlines the complete architecture, data model, and implementation roadmap without breaking existing functionality.

**Status**: Phase 1 & 2 Complete. Phase 3+ Ready for Implementation.

---

## Current System State

### ✓ What Exists (Working)
- Order management (mesas, productos)
- Basic cash register (caja)
- User authentication & roles
- Kitchen display system (cocina)
- Waiter interface (mesero)
- Multi-store support (storeId)
- Print system (thermal 80mm)
- Real-time subscriptions

### ✓ What Was Added (Phase 1-2)
- Financial module (gastos, proveedores, cash boxes)
- Order concurrency fixes (sentAt tracking)
- Expense registration & management
- Provider management
- Real-time balance monitoring

### ✗ What's Missing (To Build)
- Professional inventory system (stock, recipes, ingredients)
- Recipe costing and ingredient tracking
- Inventory movement history & analytics
- Stock alerts (critical, minimum, reorder)
- Multi-box cash management (operational → principal → strongbox)
- Comprehensive cash register closure workflow
- Financial reporting (daily, weekly, monthly)
- Audit logging (complete trail of all operations)

---

## Financial Architecture

### The Money Flow

```
Caja Operativa (Point of Sale)
  ├─ Sales deposits
  ├─ Daily operations
  └─ Transfers → Caja Principal
        │
        ├─ Receives from operations
        ├─ Aggregates store balance
        └─ Transfers → Caja Fuerte
              │
              ├─ Reserve accumulation
              ├─ Provider payments
              ├─ Bank deposits
              └─ Business reserves
```

### Three Cash Box Types

```typescript
CashBoxType = "operational" | "principal" | "strongbox"

// Operational (Caja Operativa)
- Where sales are deposited
- Daily closures transfer to principal
- Used by: cajero, mesero (deposits only)
- Can perform: sales, deposits, transfers out

// Principal (Caja Principal)
- Receives from operational closures
- Central accumulation point
- Used by: admin, cashier supervisor
- Can perform: receives, transfers to strongbox

// Strongbox (Caja Fuerte)
- Reserve & security cash
- Provider payments
- Used by: admin only
- Can perform: provider payments, reserve management
```

---

## Data Model: Unified Schema

### Collections Structure

```
stores/
  {storeId}/
    # Core Operations
    tables/
    products/
    orders/
    users/
    
    # Financial Management
    expenses/
    providers/
    cashBoxBalances/
    
    # Inventory Management (NEW)
    inventory/
    ingredients/
    recipes/
    inventoryMovements/
    
    # Operational
    settings/
    auditLogs/
    reports/
```

### Key Interfaces

```typescript
// Inventory
interface InventoryItem {
  productId: string
  productName: string
  currentStock: number
  minimumStock: number
  criticalStock: number
  unit: "kg" | "lt" | "units" | "boxes"
  category: string
  supplier?: string
  lastUpdated: Timestamp
  alerts?: InventoryAlert[]
}

interface Recipe {
  productId: string
  productName: string
  ingredients: RecipeIngredient[]
  totalCost: number
  prepTime: number
  createdAt: Timestamp
}

interface RecipeIngredient {
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
  costPerUnit: number
  totalCost: number
}

interface InventoryMovement {
  id?: string
  storeId: string
  type: "entry" | "sale" | "adjustment" | "waste" | "transfer"
  productId: string
  quantity: number
  previousStock: number
  newStock: number
  reason?: string
  userId: string
  createdAt: Timestamp
  notes?: string
}

// Financial
interface CashBoxBalance {
  id?: string
  storeId: string
  boxType: "operational" | "principal" | "strongbox"
  balance: number
  lastUpdated: Timestamp
}

interface CashClosureRecord {
  id?: string
  storeId: string
  cashBoxId: string
  openedAt: Timestamp
  closedAt?: Timestamp
  expectedCash: number
  actualCash: number
  difference: number
  userId: string
  notes?: string
}

// Audit
interface AuditLog {
  id?: string
  storeId: string
  entityType: "expense" | "provider" | "inventory" | "cash" | "order"
  action: "create" | "update" | "delete" | "void" | "close"
  userId: string
  userName: string
  changes: Record<string, any>
  timestamp: Timestamp
}
```

---

## Implementation Roadmap

### Phase 1: ✓ Complete
- Financial module (expenses, providers, cash boxes)
- Real-time balance monitoring
- Audit logging

### Phase 2: ✓ Complete  
- UI dashboard for financial management
- Expense registration form
- Provider management UI

### Phase 3: Inventory System (NEXT)
**Timeline**: 2-3 weeks

1. **Inventory Schema & Functions**
   - Add InventoryItem interface
   - Add Recipe interface
   - Add InventoryMovement tracking
   - Create CRUD functions

2. **Recipe Management UI**
   - Recipe creation/editing
   - Ingredient assignment
   - Cost calculation

3. **Stock Management UI**
   - Stock level display
   - Add/remove stock
   - Alert configuration

4. **Inventory Dashboard**
   - Stock overview
   - Critical alerts
   - Low stock warnings
   - Recent movements

### Phase 4: Order-Inventory Integration (AFTER Phase 3)
**Timeline**: 1-2 weeks

1. **Automatic Stock Deduction**
   - When order placed → deduct ingredients
   - Real-time stock updates
   - Handle edge cases (insufficient stock)

2. **Recipe Costing**
   - Calculate dish cost from ingredients
   - Track food cost percentage
   - Margin analysis

3. **Stock Alerts in Orders**
   - Warn if insufficient stock
   - Suggest alternatives
   - Track stockouts

### Phase 5: Cash Management Workflow (AFTER Phase 2)
**Timeline**: 2 weeks

1. **Cash Register Closure**
   - Expected vs actual reconciliation
   - Difference tracking
   - Operator signature/confirmation

2. **Cash Transfers**
   - Operational → Principal
   - Principal → Strongbox
   - Audit trail for each transfer

3. **Provider Payments**
   - Track payments from strongbox
   - Deduct from provider balance
   - Generate payment receipts

### Phase 6: Advanced Reporting (AFTER Phase 5)
**Timeline**: 2-3 weeks

1. **Financial Reports**
   - Daily/weekly/monthly summaries
   - Revenue vs expenses
   - Profit/loss analysis

2. **Inventory Reports**
   - Stock valuation
   - Movement history
   - Reorder recommendations

3. **Audit Reports**
   - All financial operations
   - User accountability
   - Compliance trails

### Phase 7: Multi-Location Optimization (ONGOING)
**Timeline**: Continuous

1. **Store Isolation**
   - Verify storeId on all operations
   - Cross-store data leakage prevention
   - Store-level permissions

2. **Aggregated Reporting**
   - Multi-store summaries
   - Comparative analysis
   - Master account views

### Phase 8: Performance & Scale (ONGOING)
**Timeline**: Continuous

1. **Firestore Optimization**
   - Proper indexing
   - Query efficiency
   - Batch operations

2. **Frontend Optimization**
   - Pagination for large datasets
   - Lazy loading
   - Real-time only where necessary

---

## Technical Decisions

### Real-Time vs. Loaded Data

**REAL-TIME (Streaming):**
- Current cash balances (operational, principal, strongbox)
- Active orders (kitchen, waiter)
- Critical stock alerts
- Recent transactions (last 24 hours)

**LOADED ON-DEMAND (Queries):**
- Historical data (reports, analytics)
- Inventory detailed views
- Old transactions
- Archived orders

**Why:** Real-time subscriptions cost performance. Only critical operational data streams.

### Data Isolation

**Store Level:**
- Every document has `storeId` field
- All queries filter by `storeId`
- Cross-store data access prevented

**User Level:**
- Users belong to one store (mostly)
- admin_global can access multiple stores
- Roles determine permissions within store

### Transactions & Safety

**Atomic Operations:**
- Sale + inventory deduction (single transaction)
- Cash closure reconciliation (atomic)
- Provider payment + balance update (atomic)
- Expense + cash box update (atomic)

**Why:** Prevents inconsistent state if operation fails mid-way.

---

## Security & Audit

### Access Control Matrix

```
                    super_admin  admin  admin_global  cajero  mesero  cocina
Inventory View            ✓        ✓        ✓          ✓       ✗       ✗
Stock Adjustment          ✓        ✓        ✓          ✗       ✗       ✗
Recipe Management         ✓        ✓        ✗          ✗       ✗       ✗
Expense View              ✓        ✓        ✓          ✓       ✗       ✗
Expense Register          ✓        ✓        ✓          ✓       ✗       ✗
Expense Delete            ✓        ✓        ✗          ✗       ✗       ✗
Cash Close                ✓        ✓        ✗          ✓       ✗       ✗
Cash Transfer             ✓        ✓        ✗          ✗       ✗       ✗
Strongbox Access          ✓        ✓        ✗          ✗       ✗       ✗
Provider Mgmt             ✓        ✓        ✓          ✗       ✗       ✗
Reports View              ✓        ✓        ✓          ✓       ✗       ✗
Audit Logs View           ✓        ✓        ✓          ✗       ✗       ✗
```

### Audit Trail

Every critical operation logged:
- User (name, ID)
- Timestamp
- Action (create, update, delete, void, close)
- Changes (before/after)
- Entity (expense, provider, inventory, cash, order)
- Notes/reason

---

## UI/UX Structure

### Dashboard Hub

```
/dashboard
├─ Financial Summary
│  ├─ Caja Operativa (current balance)
│  ├─ Caja Principal (daily total)
│  ├─ Caja Fuerte (strongbox balance)
│  ├─ Daily revenue
│  └─ Recent transactions
│
├─ Inventory Summary
│  ├─ Stock overview (low/critical alerts)
│  ├─ Today's sales impact
│  ├─ Reorder suggestions
│  └─ Inventory value
│
└─ Quick Actions
   ├─ Register Expense
   ├─ Pay Provider
   ├─ Adjust Stock
   └─ Close Cash
```

### Module Pages

```
/gastos           Financial control (existing - Phase 2)
/inventario       Stock management (Phase 3)
/proveedores      Provider management (existing + enhanced)
/reportes         Financial/inventory reports (Phase 6)
/auditoria        Audit logs & compliance (Phase 6)
/cajas            Multi-box management (Phase 5)
```

---

## Success Criteria

### Functional
- ✓ All modules work independently
- ✓ Modules integrate seamlessly
- ✓ Multi-store operations supported
- ✓ No data loss or inconsistency
- ✓ Complete audit trail

### Performance
- ✓ Dashboard loads < 2 seconds
- ✓ Real-time updates within 500ms
- ✓ Reports generate within 5 seconds
- ✓ Mobile tablet responsive

### Security
- ✓ Role-based access enforced
- ✓ Store boundaries maintained
- ✓ Audit trail immutable
- ✓ User actions traceable

### Scalability
- ✓ Handles 10+ locations
- ✓ Handles 100k+ transactions/month
- ✓ Supports 50+ concurrent users
- ✓ Tablet offline-capable

---

## File Organization

```
lib/firebase/
├─ config.ts
├─ firestore.ts (core schemas & functions)
│  ├─ Financial functions
│  ├─ Inventory functions
│  ├─ Cash management functions
│  ├─ Audit functions
│  └─ Helper functions

lib/inventory/
├─ inventory-functions.ts (Phase 3)
├─ recipe-functions.ts (Phase 3)
└─ stock-alerts.ts (Phase 3)

app/
├─ /gastos (Financial) ✓
├─ /inventario (Stock Management) [Phase 3]
├─ /reportes (Reports) [Phase 6]
├─ /cajas (Cash Management) [Phase 5]
└─ /auditoria (Audit) [Phase 6]

components/
├─ /gastos (Financial UI) ✓
├─ /inventario (Stock UI) [Phase 3]
├─ /reportes (Reports UI) [Phase 6]
└─ /cajas (Cash UI) [Phase 5]
```

---

## Migration & Rollout

### Week 1: Foundation
- ✓ Financial module implemented
- Inventory schema defined
- Testing on single store

### Week 2: Inventory
- Inventory system live
- Recipe management
- Stock tracking

### Week 3: Integration
- Stock deduction on sales
- Inventory alerts
- Recipe costing

### Week 4: Cash Management
- Multi-box transfers
- Cash closure workflow
- Report generation

### Week 5+: Scaling
- Multi-location optimization
- Advanced analytics
- Performance tuning
- Mobile app features

---

## Known Constraints

1. **Firestore Limits**
   - Document size: 1MB max
   - Write rate: 1 per second per document
   - Mitigation: Batch operations, proper indexing

2. **Real-Time Cost**
   - Each subscription costs read operations
   - Mitigation: Limited real-time to critical data

3. **Offline Capability**
   - Service worker caching
   - Delayed sync on reconnect
   - Conflict resolution needed

4. **Multi-User Conflicts**
   - Last write wins for non-critical data
   - Transactions for financial operations
   - Optimistic UI updates

---

## Next Steps (Immediate)

1. **Review & Approve** this master plan
2. **Implement Phase 3** (Inventory System)
   - Define inventory schemas completely
   - Build inventory CRUD functions
   - Create inventory management UI
3. **Test** on staging store
4. **Deploy** Phase 3 to production
5. **Plan Phase 4** (Order-Inventory Integration)

---

**Document Version**: 1.0  
**Last Updated**: May 8, 2026  
**Status**: Master Plan Ready for Execution  
**Build**: ✓ Production Ready  

