/**
 * Receipt Template Generators
 * Generates formatted receipt content for different document types
 */

import { ReceiptElement } from "@/lib/print/thermal-printer"
import { generateSummaryLine, wrapText } from "@/lib/print/thermal-printer"
import type { Order, CashRegister, Store } from "@/lib/firebase/firestore"
import { toPeruDate, formatReceiptDateTime } from "@/lib/utils"

/**
 * Generate order/invoice receipt - Professional Customer Ticket
 * Optimized for 80mm thermal printers with enhanced layout and formatting
 */
export function generateOrderReceipt(
  order: Order,
  store?: Store,
  includeDetails = true
): ReceiptElement[] {
  const elements: ReceiptElement[] = []

  // ========== STORE HEADER ==========
  elements.push(
    { type: "text", content: "================================", align: "center" },
    { type: "text", content: store?.name || "MULTIPIZZA", align: "center", size: "large", bold: true },
    { type: "text", content: "@multipizzaperu", align: "center", bold: true },
    { type: "text", content: "===============", align: "center" }
  )

  // Store details
  if (store) {
    elements.push({ type: "spacer" })
    elements.push(
      { type: "text", content: `Local: ${store.name || "N/A"}` },
      { type: "text", content: `RUC: 20609199416` }
    )
  }

  // ========== RECEIPT TITLE ==========
  elements.push(
    { type: "text", content: "================================", align: "center" },
    { type: "text", content: "RECIBO DE VENTA", align: "center", bold: true, size: "large" },
    { type: "text", content: "===============", align: "center" }
  )

  // Order details
  elements.push({ type: "spacer" })

  elements.push(
    { type: "text", content: `Pedido #: ${String(order.id || "").substring(0, 5).toUpperCase().padEnd(5, "0")}` },
    { type: "text", content: `Mesa: ${String(order.tableNumber).padStart(2, "0")}` },
    { type: "text", content: `${formatReceiptDateTime(order.createdAt)}` }
  )

  if (order.userName) {
    elements.push({ type: "text", content: `Atendido por: ${order.userName}` })
  }

  // ========== ITEMS SECTION ==========
  elements.push(
    { type: "spacer" },
    { type: "text", content: "================================", align: "center" },
    { type: "text", content: "ITEMS", align: "center", bold: true },
    { type: "text", content: "=====", align: "center" },
    { type: "spacer" }
  )

  let subtotal = 0
  order.items.forEach((item) => {
    const quantity = item.quantity
    const unitPrice = item.price
    const total = quantity * unitPrice
    subtotal += total

    // Product line with quantity and price
    elements.push({
      type: "text",
      content: `${quantity}x ${item.productName}${item.variantName ? ` ${item.variantName}` : ""}`,
      bold: false,
    })
    elements.push({
      type: "text",
      content: generateSummaryLine("", `S/ ${total.toFixed(2)}`, 42),
    })
    elements.push({ type: "spacer", style: "small" })
  })

  // Notes section if available
  if (order.items.some((item) => item.notes)) {
    elements.push(
      { type: "text", content: "---" },
      { type: "spacer" },
      { type: "text", content: "OBSERVACIONES:", bold: true }
    )

    order.items.forEach((item) => {
      if (item.notes) {
        elements.push({
          type: "text",
          content: `* ${item.notes}`,
        })
      }
    })

    elements.push(
      { type: "spacer" },
      { type: "text", content: "---" }
    )
  }

  // ========== TOTALS SECTION ==========
  elements.push(
    { type: "spacer" },
    { type: "text", content: generateSummaryLine("Subtotal:", `S/ ${subtotal.toFixed(2)}`, 42) },
    { type: "text", content: generateSummaryLine("Descuento:", "S/  0.00", 42) },
    { type: "text", content: generateSummaryLine("Delivery:", "S/  0.00", 42) }
  )

  // Total - emphasized
  elements.push(
    { type: "spacer" },
    { type: "text", content: "================================", align: "center" },
    { type: "text", content: generateSummaryLine("TOTAL:", `S/ ${order.total.toFixed(2)}`, 42), bold: true, size: "large" },
    { type: "text", content: "===============================", align: "center" }
  )

  // ========== PAYMENT INFO ==========
  elements.push(
    { type: "spacer" },
    { type: "text", content: "Método de pago:", bold: true }
  )

  let paymentText = "NO ESPECIFICADO"
  if (order.paymentMethod === "cash") {
    paymentText = "EFECTIVO"
  } else if (order.paymentMethod === "card") {
    paymentText = "TARJETA"
  } else if (order.paymentMethod === "yape") {
    paymentText = "YAPE"
  } else if (order.paymentMethod === "mixed") {
    paymentText = "MIXTO"
  }

  elements.push(
    { type: "text", content: paymentText, align: "center", bold: true, size: "large" }
  )

  // ========== ESTIMATED TIME ==========
  elements.push(
    { type: "spacer" },
    { type: "text", content: "================================", align: "center" },
    { type: "text", content: "Tiempo estimado:", bold: true },
    { type: "text", content: "15 - 20 minutos", align: "center" },
    { type: "text", content: "===============", align: "center" }
  )

  // ========== FOOTER ==========
  elements.push(
    { type: "spacer" },
    { type: "text", content: "¡Gracias por su compra!", align: "center", bold: true },
    { type: "text", content: "Síguenos:", align: "center" },
    { type: "text", content: "@multipizzaperu", align: "center" },
    { type: "spacer" },
    { type: "text", content: "================================", align: "center" }
  )

  return elements
}

/**
 * Generate kitchen order/ticket
 */
export function generateKitchenTicket(order: Order, store?: Store): ReceiptElement[] {
  const elements: ReceiptElement[] = []

  // Header - compact
  elements.push(
    { type: "text", content: "TICKET DE COCINA", align: "center", bold: true, size: "large" },
    { type: "line", style: "solid" }
  )

  // Order info
  elements.push(
    { type: "text", content: `Mesa: ${order.tableNumber}`, size: "double", bold: true },
    { type: "text", content: `Hora: ${new Date(order.createdAt).toLocaleTimeString("es-PE")}` },
    { type: "line" }
  )

  // Items - simplified for kitchen
  elements.push({ type: "text", content: "PREPARAR:", bold: true })
  elements.push({ type: "spacer" })

  order.items.forEach((item) => {
    elements.push({
      type: "text",
      content: `${item.quantity}x ${item.productName}${item.variantName ? ` - ${item.variantName}` : ""}`,
      size: "double",
      bold: true,
    })

    // Add notes/instructions if any
    if (item.notes) {
      const wrappedNotes = wrapText(item.notes, 40, "normal")
      wrappedNotes.forEach((note) => {
        elements.push({
          type: "text",
          content: `  > ${note}`,
          size: "normal",
        })
      })
    }

    elements.push({ type: "spacer" })
  })

  // Priority indicator
  const now = new Date()
  const orderTime = new Date(order.createdAt)
  const minutesOld = Math.floor((now.getTime() - orderTime.getTime()) / 60000)

  if (minutesOld > 10) {
    elements.push({
      type: "text",
      content: `*** PEDIDO ATRASADO (${minutesOld} min) ***`,
      align: "center",
      bold: true,
      style: "alert",
    })
    elements.push({ type: "spacer" })
  }

  // Footer
  elements.push({
    type: "text",
    content: `Impreso: ${new Date().toLocaleTimeString("es-PE")}`,
    align: "center",
    size: "normal",
  })

  return elements
}

/**
 * Generate cash register closure report
 */
export function generateCashClosureReport(
  closure: CashRegister,
  store?: Store,
  ordersCount = 0
): ReceiptElement[] {
  const elements: ReceiptElement[] = []

  // Header
  elements.push(
    { type: "text", content: store?.name || "MultiPizza POS", align: "center", size: "large", bold: true },
    { type: "text", content: `Local ${store?.code || "N/A"}`, align: "center" },
    { type: "line" }
  )

  // Title
  elements.push(
    { type: "text", content: "CIERRE DE CAJA", align: "center", bold: true, size: "large" },
    { type: "spacer" }
  )

  // Dates and operator
  elements.push(
    { type: "text", content: `Abierta: ${toPeruDate(closure.openedAt)} ${new Date(closure.openedAt).toLocaleTimeString("es-PE")}` }
  )

  if (closure.closedAt) {
    elements.push({
      type: "text",
      content: `Cerrada: ${toPeruDate(closure.closedAt)} ${new Date(closure.closedAt).toLocaleTimeString("es-PE")}`,
    })
  }

  elements.push(
    { type: "text", content: `Operador: ${closure.openedByName}` },
    { type: "line" }
  )

  // Financial summary
  elements.push({ type: "text", content: "RESUMEN FINANCIERO", bold: true })
  elements.push({ type: "spacer" })

  elements.push({
    type: "text",
    content: generateSummaryLine("Monto Inicial", `S/ ${closure.initialAmount.toFixed(2)}`, 42),
  })

  if (closure.cashSales !== undefined) {
    elements.push({
      type: "text",
      content: generateSummaryLine("Ventas Efectivo", `S/ ${closure.cashSales.toFixed(2)}`, 42),
    })
  }

  if (closure.cardSales !== undefined) {
    elements.push({
      type: "text",
      content: generateSummaryLine("Ventas Tarjeta", `S/ ${closure.cardSales.toFixed(2)}`, 42),
    })
  }

  if (closure.expectedCash !== undefined) {
    elements.push({
      type: "text",
      content: generateSummaryLine("Efectivo Esperado", `S/ ${closure.expectedCash.toFixed(2)}`, 42),
      bold: true,
    })
  }

  elements.push({ type: "line", style: "solid" })

  // Counted and difference
  if (closure.countedCash !== undefined) {
    elements.push({
      type: "text",
      content: generateSummaryLine("Efectivo Contado", `S/ ${closure.countedCash.toFixed(2)}`, 42),
      bold: true,
      size: "double",
    })
  }

  if (closure.difference !== undefined) {
    const diffStr = `S/ ${Math.abs(closure.difference).toFixed(2)}`
    const label = closure.difference >= 0 ? "Sobrante" : "Faltante"
    const diffColor = closure.difference >= 0 ? "positive" : "negative"

    elements.push({
      type: "text",
      content: generateSummaryLine(label, diffStr, 42),
      bold: true,
      style: diffColor,
    })
  }

  // Order count
  elements.push({ type: "spacer" })
  elements.push({
    type: "text",
    content: `Total de Pedidos: ${ordersCount}`,
    align: "center",
  })

  elements.push({ type: "spacer" })
  elements.push({
    type: "text",
    content: "Fin de Cierre",
    align: "center",
    size: "normal",
  })

  return elements
}

/**
 * Generate daily sales summary report
 */
export function generateDailySalesReport(
  date: string,
  store?: Store,
  totals?: {
    totalSales: number
    cashSales: number
    cardSales: number
    yapeSales: number
    ordersCount: number
  }
): ReceiptElement[] {
  const elements: ReceiptElement[] = []

  // Header
  elements.push(
    { type: "text", content: store?.name || "MultiPizza POS", align: "center", size: "large", bold: true },
    { type: "text", content: `Local ${store?.code || "N/A"}`, align: "center" },
    { type: "line" }
  )

  // Title
  elements.push(
    { type: "text", content: "REPORTE DIARIO DE VENTAS", align: "center", bold: true, size: "large" },
    { type: "text", content: `Fecha: ${date}`, align: "center" },
    { type: "line" }
  )

  if (!totals) {
    elements.push({ type: "text", content: "Sin datos disponibles", align: "center" })
    return elements
  }

  // Sales summary
  elements.push(
    { type: "text", content: "VENTAS POR MÉTODO", bold: true },
    { type: "spacer" }
  )

  elements.push({
    type: "text",
    content: generateSummaryLine("Efectivo", `S/ ${totals.cashSales.toFixed(2)}`, 42),
  })
  elements.push({
    type: "text",
    content: generateSummaryLine("Tarjeta", `S/ ${totals.cardSales.toFixed(2)}`, 42),
  })
  elements.push({
    type: "text",
    content: generateSummaryLine("Yape", `S/ ${totals.yapeSales.toFixed(2)}`, 42),
  })

  elements.push({ type: "line", style: "solid" })

  elements.push({
    type: "text",
    content: generateSummaryLine("TOTAL", `S/ ${totals.totalSales.toFixed(2)}`, 42),
    bold: true,
    size: "double",
  })

  elements.push({ type: "spacer" })
  elements.push({
    type: "text",
    content: `Total de Pedidos: ${totals.ordersCount}`,
    align: "center",
  })

  // Footer
  elements.push({ type: "spacer" })
  elements.push({
    type: "text",
    content: `Impreso: ${new Date().toLocaleString("es-PE")}`,
    align: "center",
    size: "normal",
  })

  return elements
}
