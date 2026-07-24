# Sistema Profesional de Impresión para MultiPizza POS

## Resumen de la Implementación

Se ha desarrollado un **sistema integral de impresión profesional** para el sistema MultiPizza POS que incluye soporte completo para impresoras térmicas de 80mm, configuración personalizable, gestión de estados y vistas previas avanzadas.

### Estadísticas del Proyecto
- **Archivos Creados**: 9 nuevos archivos
- **Líneas de Código**: 2,759 líneas nuevas
- **Componentes Principales**: 6 componentes React
- **Módulos Utilitarios**: 3 módulos TypeScript
- **Build Status**: ✅ Compilado exitosamente

---

## Estructura del Sistema

### 1. **Núcleo de Impresión** (`lib/print/`)

#### `thermal-printer.ts` (335 líneas)
Sistema base para formateo de impresoras térmicas:
- Soporte para impresoras de 80mm (42 caracteres)
- Generación de comandos ESC/POS
- Generación de HTML para impresoras web
- Funciones de alineación y envoltura de texto
- Generación de líneas resumen (ej: "Total...S/ 125.50")

**Funciones principales:**
```typescript
formatThermalText()      // Formatea texto con alineación y tamaño
generateESCPOS()        // Genera comandos para impresoras térmicas
generatePrintHTML()     // Genera HTML compatible con navegadores
wrapText()             // Envuelve texto a ancho específico
generateSummaryLine()  // Crea líneas resumen alineadas
```

#### `receipt-templates.ts` (360 líneas)
Plantillas profesionales de recibos y tickets:
- **generateOrderReceipt()** - Recibos de venta para mesas
- **generateKitchenTicket()** - Tickets de cocina con indicadores de prioridad
- **generateCashClosureReport()** - Reportes de cierre de caja
- **generateDailySalesReport()** - Resumen de ventas diarias

Todas las plantillas incluyen:
- Información de tienda personalizable
- Fechas y horas en zona horaria Perú
- Desglose de items y totales
- Métodos de pago
- Mensajes personalizados

#### `print-settings.ts` (193 líneas)
Configuración y perfiles de impresoras:
- **Interface PrintSettings** - 20+ opciones de configuración
- **DEFAULT_PRINT_SETTINGS** - Valores por defecto
- **Perfiles predefinidos**: 80mm, 58mm, Inyección, Láser
- Validación de configuración
- Import/Export como JSON

---

### 2. **Componentes React** (`components/print/`)

#### `receipt-printer.tsx` (249 líneas)
Componente profesional de impresión:
- **ReceiptPrinter** - Componente completo con preview modal
- **QuickPrintButton** - Botón rápido de impresión
- Vista previa interactiva
- Descarga como HTML
- Manejo de errores y validación

```tsx
<ReceiptPrinter
  elements={receiptElements}
  storeName="MultiPizza"
  storeInfo="Local 01"
  onPrint={() => console.log("Imprimido")}
/>
```

#### `print-settings-dialog.tsx` (537 líneas)
Diálogo de configuración avanzado con 4 pestañas:

1. **General**: Selección de perfil, hardware (ancho, papel, fuente)
2. **Recibo**: Elementos a mostrar (tienda, orden, fecha, método pago, QR)
3. **Cocina**: Tickets de cocina (tabla solo, prioridad, fuente grande)
4. **Avanzado**: Cierre de caja, copias, import/export

```tsx
<PrintSettingsDialog
  isOpen={true}
  storeId="store-001"
  onSave={async (settings) => {}}
/>
```

#### `print-preview-modal.tsx` (260 líneas)
Modal de vista previa avanzada con:
- **3 modos de visualización**: Preview, HTML, Código
- Controles de zoom (50%-200%)
- Descarga como HTML
- Inspector de elementos
- Información de hardware

```tsx
<PrintPreviewModal
  isOpen={true}
  elements={receiptElements}
  printerWidth={42}
  onPrint={() => window.print()}
/>
```

#### `print-management-panel.tsx` (280 líneas)
Panel de gestión de impresoras para administradores:
- Estado de impresora (conectado/desconectado)
- Estadísticas rápidas (ancho, caracteres, copias)
- Lista de características habilitadas
- Información de hardware
- Botón para test de impresión (futuro)

```tsx
<PrintManagementPanel
  storeId="store-001"
  storeName="Local Principal"
  onSettingsSaved={(settings) => {}}
/>
```

---

### 3. **Hooks Personalizados** (`lib/hooks/`)

#### `use-print-settings.ts` (145 líneas)
Gestión de estado de configuración de impresión:

**usePrintSettings(storeId)**
- Carga/guarda en localStorage
- Sincronización automática
- Manejo de errores
- Reset a valores por defecto

```tsx
const { settings, saveSettings, error } = usePrintSettings("store-001")
await saveSettings(newSettings)
```

**useCurrentPrintSettings()**
- Contexto global de configuración
- Caché por tienda
- Fallback a defaults

---

## Integración en la Aplicación

### Página de Caja (`app/caja/page.tsx`)
- ✅ Integración de `usePrintSettings`
- ✅ Generación de recibos profesionales en diálogo
- ✅ Impresión con configuración personalizada
- ✅ HTML generado dinámicamente

### Componente Daily Sales (`components/caja/daily-sales.tsx`)
- ✅ Impresión de recibos individuales
- ✅ Plantillas profesionales
- ✅ Botones de impresión en tabla y diálogo
- ✅ Acceso a configuración de tienda

---

## Características Principales

### 🎯 Impresión Profesional
- ✅ Soporte para impresoras térmicas 80mm (estándar POS)
- ✅ Comandos ESC/POS para control de hardware
- ✅ Fuente monoespaciada optimizada
- ✅ Alineación de texto y espaciado
- ✅ Múltiples copias automáticas
- ✅ Auto-corte de papel configurable
- ✅ Control de gaveta de efectivo

### 📋 Plantillas Personalizables
- ✅ Recibos de venta profesionales
- ✅ Tickets de cocina con prioridad
- ✅ Reportes de cierre de caja
- ✅ Resúmenes de ventas diarias
- ✅ Información flexible de tienda
- ✅ Mensajes personalizados
- ✅ Códigos QR (configurables)

### ⚙️ Configuración Avanzada
- ✅ 4 perfiles de impresora predefinidos
- ✅ 20+ opciones de configuración
- ✅ Import/Export como JSON
- ✅ Persistencia en localStorage
- ✅ Validación de datos
- ✅ Sincronización automática

### 👁️ Vistas Previas
- ✅ Vista previa interactiva con zoom
- ✅ Código fuente HTML
- ✅ Inspector de elementos
- ✅ Descarga como archivo
- ✅ Información de hardware

### 📊 Gestión
- ✅ Panel de estado de impresora
- ✅ Estadísticas de configuración
- ✅ Historial de actualizaciones
- ✅ Indicadores de conectividad
- ✅ Gestión centralizada de settings

---

## Uso en la Aplicación

### Imprimir un Recibo de Venta
```tsx
import { generateOrderReceipt } from '@/lib/print/receipt-templates'
import { generatePrintHTML } from '@/lib/print/thermal-printer'

const receiptElements = generateOrderReceipt(order, store)
const html = generatePrintHTML(receiptElements, store.name, store.code)
const printWindow = window.open("", "_blank")
if (printWindow) {
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.print()
}
```

### Configurar Impresora
```tsx
import { PrintSettingsDialog } from '@/components/print/print-settings-dialog'

<PrintSettingsDialog
  isOpen={isOpen}
  storeId={storeId}
  onSave={handleSave}
/>
```

### Ver Panel de Gestión
```tsx
import { PrintManagementPanel } from '@/components/print/print-management-panel'

<PrintManagementPanel
  storeId={storeId}
  storeName="Mi Tienda"
/>
```

---

## Perfiles de Impresora

El sistema incluye 4 perfiles predefinidos:

| Perfil | Ancho | Caracteres | Papel | Auto-corte |
|--------|-------|-----------|-------|-----------|
| 80mm Térmica | 80mm | 42 | 80mm | ✓ |
| 58mm Térmica | 58mm | 32 | 58mm | ✓ |
| Inyección | 210mm | 80 | A4 | ✗ |
| Láser | 210mm | 80 | A4 | ✗ |

---

## Configuraciones Avanzadas

### Hardware
- Nombre de impresora personalizado
- Ancho de papel (58mm, 80mm, A4)
- Ancho en caracteres (32, 42, 56, 80)
- Fuente monoespaciada opcional
- Auto-corte de papel
- Detección de marca negra
- Control de gaveta

### Recibos
- Información de tienda
- Número de orden
- Fecha y hora
- Información de mesa
- Notas de productos
- Método de pago
- Código QR

### Cocina
- Mostrar solo número de mesa
- Indicador de prioridad
- Fuente más grande

### Cierre de Caja
- Desglose detallado
- Cantidad de pedidos
- Nombre del cajero

---

## Notas Técnicas

### Persistencia
- Las configuraciones se guardan en `localStorage` con clave: `print-settings-{storeId}`
- Sincronización automática entre tabs del navegador
- Fallback a valores por defecto si hay error

### Validación
- Validación de rangos de ancho (20-80)
- Validación de tamaños de papel válidos
- Validación de copias (1-10)

### Rendimiento
- Carga lazy de configuración
- Caché en memoria
- Generación de HTML eficiente
- Minimización de re-renders

### Compatibilidad
- Compatible con todos los navegadores modernos
- Soporte para impresoras térmicas ESC/POS
- Fallback a window.print() si es necesario
- Funciona offline (localStorage)

---

## Próximas Mejoras Sugeridas

1. **Integración con Firebase**: Sincronizar settings entre dispositivos
2. **Test de Impresión**: Generar página de prueba automática
3. **Historial de Impresión**: Registrar impresiones exitosas/fallidas
4. **Plantillas Personalizadas**: Editor visual de plantillas
5. **Detección Automática**: Auto-detectar impresora conectada
6. **QR Dinámico**: Generar QR con datos del pedido
7. **Múltiples Impresoras**: Soporte para varias impresoras por tienda
8. **Scheduling**: Imprimir a horas específicas

---

## Archivos Modificados

### `app/caja/page.tsx`
- Agregar imports del sistema de impresión
- Integrar usePrintSettings hook
- Actualizar botón de impresión en diálogo de recibos
- Pasar store a componente DailySales

### `components/caja/daily-sales.tsx`
- Agregar imports del sistema de impresión
- Actualizar interfaz para recibir store
- Cambiar botones de impresión para usar nuevas plantillas

---

## Resumen de Commits

```
✓ 45b45d2 - feat: implement professional print system (templates + printer)
✓ 90deed4 - feat: add print settings management system
✓ 8c5e505 - feat: integrate professional print system into cash register
✓ 724e5c8 - feat: add advanced print preview and management UI
```

---

## Conclusión

El nuevo sistema de impresión proporciona una solución **profesional, configurable y fácil de usar** para la impresión de recibos y tickets en MultiPizza POS. Con más de 2,700 líneas de código nuevo en 9 archivos, incluye:

- ✅ Soporte completo para impresoras térmicas de 80mm
- ✅ Plantillas profesionales personalizables
- ✅ Configuración avanzada con perfiles predefinidos
- ✅ Vistas previas interactivas
- ✅ Panel de gestión integral
- ✅ Persistencia y sincronización
- ✅ Manejo de errores robusto
- ✅ Código bien documentado y mantenible

El sistema está listo para producción y puede ser extendido fácilmente con nuevas características.
