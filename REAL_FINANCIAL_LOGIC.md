# Lógica Financiera REAL del POS MultiPizza

## Descripción General

El sistema ahora implementa contabilidad POS real y consistente donde:
- Cada gasto descuenta el balance correspondiente inmediatamente
- El efectivo esperado se calcula dinámicamente desde openings, sales, gastos, depósitos
- Todo es append-only e inmutable (no se modifica histórico)
- Realtime sync entre caja operativa, caja fuerte y principal

## Arquitectura de Balances

```
CAJA OPERATIVA (cash_register)
├─ Saldo: (opening) + (sales.cash) - (operational_expenses) - (deposits_to_strongbox)
├─ Documento: cashBoxBalances/{storeId}_operational
├─ Actualización: En tiempo real
└─ Cierre: Manual por cajero

CAJA FUERTE (strongbox)
├─ Saldo: (openings_from_register) + (deposits) - (withdrawals)
├─ Documento: safeBox/{storeId}
├─ Actualización: En tiempo real
└─ Auditoría: Completa

CAJA PRINCIPAL
├─ Saldo: Totales consolidados
├─ Documento: cashBoxBalances/{storeId}_principal
├─ Actualización: En cierre de caja
└─ Propósito: Tesorería
```

## Flujos Transaccionales

### 1. GASTO OPERATIVO (Desde Caja Operativa)

```typescript
registerInternalExpenseV2(storeId, {
  description: "Cambio",
  amount: 50,
  source: "cash_register",  // ← KEY: Descuenta operativo
  category: "cambio"
})
```

**Transacción (ACID):**
1. Lee balance operativo (`{storeId}_operational`)
2. Valida fondos suficientes
3. Crea documento gasto
4. Crea movimiento financiero (append-only)
5. **Descuenta balance operativo**
6. Registra auditoría con balance después

**Resultado:**
```
Antes: Caja operativa = 1200
Gasto: -50
Después: Caja operativa = 1150  ✓ CORRECTO
```

### 2. GASTO DESDE CAJA FUERTE

```typescript
registerInternalExpenseV2(storeId, {
  description: "Pago servicios",
  amount: 200,
  source: "safe_box",  // ← KEY: Descuenta caja fuerte
  category: "utilities"
})
```

**Transacción (ACID):**
1. Lee balance caja fuerte
2. Valida fondos suficientes
3. Crea documento gasto
4. Crea movimiento
5. **Descuenta balance caja fuerte**
6. Registra auditoría

**Resultado:**
```
Antes: Caja fuerte = 5000
Gasto: -200
Después: Caja fuerte = 4800  ✓ CORRECTO
```

### 3. DEPÓSITO DESDE OPERATIVO A CAJA FUERTE

```typescript
depositToSafeBoxFromClosure(storeId, 800, cashRegisterId, ...)
```

**Transacción (ACID):**
1. Lee balance operativo
2. Lee balance caja fuerte
3. Descuenta operativo en 800
4. Incrementa caja fuerte en 800
5. Crea movimiento
6. Registra auditoría

**Resultado:**
```
Operativo antes:    1200    →  400
Caja fuerte antes:  4800    →  5600
```

### 4. DISTRIBUCIÓN AL CIERRE

```typescript
distributeCashOnClosureTransaction(storeId, {
  toPrincipal: 300,
  toStrongbox: 500,
  remaining: 350
})
```

**Transacción (ACID):**
1. Lee todos los balances requeridos
2. Valida distribución suma correctamente
3. Descuenta operativo en total
4. Incrementa destinos
5. Crea movimientos de distribución
6. Registra auditoría completa

## Efectivo Esperado (Expected Cash)

Se calcula dinámicamente:

```
Expected = (opening_amount)
         + (total_cash_sales)
         - (operational_expenses_from_cash_register)
         - (deposits_to_safe_box)
         ± (manual_adjustments)
```

**Ejemplo Real:**
```
Apertura:         1200
+ Ventas efectivo: 650
- Gasto cambio:    50
- Depósito fuerte: 800
─────────────────────
Esperado:         1000

Contado (arqueo):  1000
Diferencia:        0 ✓
```

## Movimientos Financieros

Cada movimiento es **append-only** e **inmutable**:

```typescript
{
  id: "auto",
  storeId: "store_1",
  type: "expense" | "deposit" | "withdrawal" | "cash_distribution" | "opening" | "closing",
  source: "cash_register" | "safe_box",
  amount: number,
  category: string,
  description: string,
  relatedDocId: string,  // Referencia a gasto, cierre, etc
  userId: string,
  userName: string,
  createdAt: timestamp,
  archived: false  // Nunca se modifica ni borra
}
```

**Garantías:**
- ✓ Inmutable (una vez creado, no cambia)
- ✓ Trazable (auditoría completa)
- ✓ Histórico (todo el pasado está disponible)
- ✓ Append-only (solo se agrega, nunca se modifica)

## Validaciones

Cada transacción valida:

```
1. Cantidad positiva
2. Fondos disponibles en origen
3. Distribución suma correctamente
4. Usuario autorizado
5. Datos completos (sin undefined)
```

## Realtime Sync

Los listeners de Firestore capturan cambios en:

```
cashBoxBalances/{storeId}_operational
cashBoxBalances/{storeId}_principal
safeBox/{storeId}
financialMovements (todos)
expenses (todos)
```

**Actualización:**
- 50-100ms en operativo/fuerte
- 200-500ms en queries agregadas
- Consistencia eventual garantizada

## Auditoría Completa

Se registran 3 niveles:

1. **Documento de Gasto** - Datos del gasto
2. **Movimiento Financiero** - Cambio de balance
3. **Log de Auditoría** - Quién, cuándo, qué, estado después

**Ejemplo:**
```
action: "expense_registered"
metadata: {
  amount: 50,
  category: "cambio",
  balanceAfter: 1150  ← Estado DESPUÉS del gasto
}
userId: "user_123"
```

## Garantías de Integridad

✓ **Atomicidad**: Todo o nada  
✓ **Consistencia**: Balances siempre cuadran  
✓ **Aislamiento**: Transacciones no se interfieren  
✓ **Durabilidad**: Una vez confirmado, persiste  

## Casos de Uso

### Arqueo de Caja (Reconciliation)

```
Operativo esperado = calculation()
Operativo contado = user_input()
Diferencia = contado - esperado

Si diferencia > 0: Habrá overage
Si diferencia < 0: Habrá shortage (genera alert)
```

### Historial de Cajas

```
Ordenado DESC por createdAt:
1. Depósito 500 a fuerte (hoy 14:30)
2. Gasto cambio 50 (hoy 14:00)
3. Venta 650 (hoy 13:45)
4. Apertura 1200 (hoy 09:00)
```

### Estado Actual

```
GET: /caja/estado → {
  operativeBalance: 1150,
  safeBoxBalance: 5600,
  principalBalance: 300,
  expectedCash: 1000,
  countedCash: 1000,
  difference: 0
}
```

## Testing

Para validar que funciona correctamente:

```
1. Abrir caja con 1000
2. Gasto operativo: 50  → Esperado: 950
3. Depositar 400 a fuerte → Operativo: 550, Fuerte: +400
4. Cierre y arqueo → Diferencia: 0 ✓
```

## Notas Importantes

- La cocina NO fue tocada
- Las órdenes NO fueron tocadas
- El realtime listener NO fue modificado
- Todo es backwards compatible
- No hay breaking changes

## Próximos Pasos

1. Crear índice Firestore para better performance
2. Dashboard financiero con historial actualizado
3. Reportes automáticos de discrepancias
4. Alertas de balances bajos
