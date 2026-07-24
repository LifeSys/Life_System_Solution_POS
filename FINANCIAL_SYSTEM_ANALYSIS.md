# ANÁLISIS COMPLETO DEL SISTEMA FINANCIERO

## PROBLEMAS IDENTIFICADOS

### 1. VIOLACIÓN DE REGLA FIRESTORE: Reads After Writes

**Transacción: `registerExpenseTransactionV2` (línea 1830)**
```
- ESCRIBE: transaction.set(expenseRef) [línea 1848]
- ESCRIBE: transaction.set(movementRef) [línea 1857]
- ESCRIBE: transaction.update(balanceRef) [línea 1873]
- ESCRIBE: transaction.set(auditRef) [línea 1881]
- NUNCA: transaction.get() primero
```
PROBLEMA: No lee nada, crea balances sin validar estado previo

**Transacción: `distributeCashOnClosureTransaction` (línea 1912)**
```
ESCRIBE:
- transaction.set(distributionRef) [1934]
- transaction.set(movementRef) [1949, 1966]
- transaction.update(opBalanceRef) [1983]

LUEGO LEE:
- transaction.get(prinBalanceRef) [1992] ← DESPUÉS de writes
- transaction.get(strongBalanceRef) [2012] ← DESPUÉS de writes

ESCRIBE:
- transaction.set(prinBalanceRef...) [1996]
- transaction.set(strongBalanceRef...) [2016]
- transaction.set(auditRef) [2030]
```
PROBLEMA: VIOLACIÓN CLARA - Lee balances DESPUÉS de actualizar el operativo

### 2. ARQUITECTURA FRAGMENTADA

**Colecciones existentes:**
- `cash_register` - Solo apertura/cierre básico
- `expenses` - Gastos desorganizados
- `financial_movements` - Movimientos (pero algunos se crean dentro de transacciones)
- `balances` - Balances por tipo de caja (operativo, principal, fuerte)
- `safe_box` - Caja fuerte (pero sin historical tracking)
- `safe_box_movements` - Movimientos de caja fuerte
- `audit_logs` - Auditoría (solo lectura)

PROBLEMA: Las transacciones crean movimientos sin lógica clara

### 3. GASTOS SIN CONTROL

**Función: `registerExpenseTransactionV2` (línea 1830)**
- Escribe gasto SIN verificar origen
- No valida saldo disponible antes
- No crea registro histórico en safe_box_movements
- Solo actualiza balance genérico

### 4. LISTENERS POTENCIALMENTE ROTOS

En `app/caja/page.tsx`:
- subscribeToClosedCashRegisters
- subscribeToSafeBox
- subscribeToSafeBoxMovements

Si las transacciones fallan, los listeners ven datos inconsistentes.

### 5. ÍNDICES FALTANTES

Query en safe_box_movements requiere:
- storeId (ASC) + createdAt (DESC)
- NO ESTÁ en Firestore

---

## SOLUCIÓN ARQUITECTÓNICA

### REGLA FUNDAMENTAL
En TODA transacción:
```
1. FASE READ: transaction.get() TODOS los documentos
2. FASE VALIDATE: Validar datos leídos
3. FASE WRITE: transaction.set/update() TODOS los cambios
```

### ESTRUCTURA DEFINITIVA

#### 1. CAJA OPERATIVA (Cash Register Flow)
```
apertura → efectivo inicial
cierre → efectivo contado + diferencia (arqueo)
  → distribuir a: caja_fuerte + caja_principal + operativa
  → crear safe_box_movement
  → crear financial_movement
  → crear audit_log
```

#### 2. CAJA FUERTE (Safe Box State)
```
safe_box document:
  storeId
  currentBalance (actualizado atómicamente)
  lastUpdated
  
safe_box_movements (append-only):
  type: "deposit" | "withdrawal" | "adjustment"
  amount
  reason (from_closure, manual, etc)
  relatedDocId
  userId, userName
  timestamp
  
Query: storeId (ASC) + createdAt (DESC) → REQUIERE ÍNDICE
```

#### 3. MOVIMIENTOS FINANCIEROS (Append-Only Audit Trail)
```
financial_movements:
  type: "cash_distribution" | "expense" | "cash_transfer" | "closure"
  amount
  source: "operational" | "safe_box" | "principal"
  target: "operational" | "safe_box" | "principal"
  relatedDocId
  createdAt
  userId, userName
```

#### 4. AUDITORÍA (Immutable)
```
audit_logs:
  entityType
  entityId
  action: "create" | "update" | "distribute"
  changes: {}
  timestamp
  userId, userName
```

#### 5. GASTOS (Controlled)
```
expenses:
  source: "cash_register" | "safe_box" ← VALIDADO
  category
  amount
  description
  relatedMovementId ← Link a safe_box_movements
  createdAt
  userId
  
Transacción atómica:
  1. READ: expense, balance
  2. VALIDATE: balance >= amount
  3. WRITE: expense, balance-, movement, audit
```

---

## TRANSACCIONES A ARREGLAR

### 1. registerExpenseTransactionV2 (línea 1830)
AHORA: Escribe sin leer
DESPUÉS: READ balances → VALIDATE → WRITE

### 2. distributeCashOnClosureTransaction (línea 1912)
AHORA: Lee después de escribir
DESPUÉS: READ todos → VALIDATE → WRITE todos

### 3. Crear nuevas funciones si faltan:
- `depositToSafeBoxTransaction` - Transacción de depósito limpia
- `safeBoxWithdrawalTransaction` - Retiro con auditoría
- `registerExpenseFromSafeBoxTransaction` - Gasto desde caja fuerte

---

## ÍNDICES NECESARIOS

1. safe_box_movements:
   - storeId (ASC), createdAt (DESC) ← REQUERIDO
   - storeId (ASC), type (ASC) ← RECOMENDADO

2. financial_movements:
   - storeId (ASC), createdAt (DESC) ← RECOMENDADO

3. expenses:
   - storeId (ASC), createdAt (DESC) ← RECOMENDADO

---

## VALIDACIONES CRÍTICAS

- Nunca escribir undefined a Firestore
- Nunca crear balance negativo sin auditoría
- Nunca distribuir más dinero del que existe
- Siempre registrar usuario + timestamp
- Siempre crear audit_log + movement
- Siempre atomicidad: todo o nada
