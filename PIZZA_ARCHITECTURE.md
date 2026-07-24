# Arquitectura Final de Pizzas - Sistema Multipizza

## Objetivo
Separar inventario global (por tamaño operacional) de precios (por sabor + tamaño), sin romper el sistema actual.

## Estructura Implementada

### 1. Inventario Global (No cambia)
- **5 Productos Operacionales Únicos**:
  - `PZ-PER` (Personal)
  - `PZ-BIP` (Bipersonal)
  - `PZ-FAM` (Familiar)
  - `PZ-GIG` (Gigante)
  - `PZ-SGI` (Super Gigante)

- **Stock**: Se maneja únicamente por tamaño, no por sabor.
- **Deducción**: Cuando se vende "Hawaiana + Familiar", se descuenta stock de `PZ-FAM` solamente.

### 2. Precios por Sabor + Tamaño

**Modelo de datos** (Product):
```typescript
{
  id: "pizza-1",
  name: "Hawaiana",              // Nombre del sabor
  category: "pizzas",
  priceMap: {                     // Precios por tamaño (PARCIAL allowed)
    PERSONAL: 18,
    BIPERSONAL: 28,
    FAMILIAR: 42,
    // GIGANTE ausente → no se vende Hawaiana Gigante
    // SUPER_GIGANTE ausente → no se vende Hawaiana Super Gigante
  },
  available: true,
  active: true
}
```

**Característica clave**: `priceMap` puede ser **parcial**.
- Si un tamaño no tiene precio (key ausente, null, vacío o ≤0), ese sabor **no está disponible** en ese tamaño.

### 3. Flujo de Venta (POS)

#### A. Selección de Sabor
1. Usuario ve lista de pizzas (sabores).
2. Hace clic en "Hawaiana".

#### B. Selección de Tamaño (Modal)
1. Sistema muestra los 5 tamaños.
2. **Filtra**: Solo muestra tamaños con precio válido en `priceMap["Hawaiana"]`.
3. Tamaños sin precio → deshabilitados (gris, no clickeable).

**Ejemplo**:
- Hawaiana tiene `priceMap: { PERSONAL: 18, FAMILIAR: 42 }`
- Modal muestra: Personal ($18), Familiar ($42), Gigante (disabled), ...

#### C. Cobro
- Precio = `priceMap[sabor][tamaño]` (ejemplo: `priceMap["Hawaiana"]["FAMILIAR"]` = 42)

#### D. Deducción de Inventario
- Stock = solo por tamaño global (ejemplo: `inventory["PZ-FAM"]` -= 1)
- El sabor NO afecta inventario.

### 4. Admin - Crear/Editar Sabor

**Interfaz**:
```
Nombre del Sabor: [Hawaiana          ]

Precios por Tamaño:
┌─────────────┬──────────┬─────────────┐
│ Personal    │ S/ [18]  │ S/ 18.00    │
│ Bipersonal  │ S/ [28]  │ S/ 28.00    │
│ Familiar    │ S/ [42]  │ S/ 42.00    │
│ Gigante     │ S/ [ ]   │ -           │  (opcional)
│ Super Gigante│ S/ [ ]   │ -           │  (opcional)
└─────────────┴──────────┴─────────────┘
```

**Validación**:
- ✅ Exige al menos **1 precio** válido (> 0).
- ✅ Permite **dejar vacíos** los demás tamaño.
- ✅ Guarda solo tamaños con precio > 0 en `priceMap`.

### 5. Compatibilidad con Datos Existentes

- **Pizzas sin `priceMap`**: Se cargan y editan sin problemas. Al guardar, se crea/actualiza `priceMap`.
- **No se elimina nada**: Sabores antiguos pueden migrar incrementalmente.
- **Firestore**: Admite documentos con `priceMap` parcial o completo.

## Cambios Realizados

### firestore.ts
- Agregué `priceMap?: { [K in PizzaMassType]?: number }` a `Product` interface.

### admin/page.tsx
- Agregué `priceMap` al estado del formulario.
- Mostré tabla de 5 inputs para precios cuando `category === 'pizzas'`.
- Validación: Exige al menos 1 precio, guarda solo tamaños con precio > 0.

### components/waiter/product-list.tsx
- Modal de selección de tamaño ahora lee precios de `selectedPizzaFlavor.priceMap[massType]`.
- Filtra tamaños sin precio (disabled visualmente).
- Valida antes de agregar al carrito.

## Ejemplo de Flujo End-to-End

1. **Admin crea**: "Pepperoni" con `{ PERSONAL: 20, FAMILIAR: 45 }`.
2. **POS muestra**: Personal ($20), Familiar ($45), otros tamaños deshabilitados.
3. **Usuario vende**: Pepperoni + Familiar.
   - Cobro: $45 (de `priceMap["Pepperoni"]["FAMILIAR"]`).
   - Inventario: `PZ-FAM` stock -= 1 (global).
4. **Reporte**: Muestra venta de 1 Familiar.

---

**Estado**: ✅ Implementado y compilado. Listo para uso.
