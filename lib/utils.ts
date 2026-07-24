import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Timestamp } from 'firebase/firestore'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely calculates item total (price * quantity) converting to numbers and handling null/undefined
 * Returns string formatted to 2 decimal places, or "0.00" if invalid
 */
export function calculateItemTotal(price: any, quantity: any): string {
  const numPrice = Number(price) || 0
  const numQuantity = Number(quantity) || 0
  const total = numPrice * numQuantity
  return isNaN(total) ? "0.00" : total.toFixed(2)
}

/**
 * Converts a date to Peru timezone (America/Lima)
 * This is used for display and grouping purposes only
 */
export function toPeruDate(date: Date | Timestamp | string | { toDate: () => Date } | null | undefined): Date {
  if (!date) return new Date()
  
  let d: Date
  if (date instanceof Timestamp) {
    d = date.toDate()
  } else if (typeof (date as { toDate?: () => Date }).toDate === 'function') {
    d = (date as { toDate: () => Date }).toDate()
  } else {
    d = new Date(date as Date)
  }
  
  return new Date(d.toLocaleString("en-US", { timeZone: "America/Lima" }))
}

/**
 * Formats a date to Peru locale date string
 */
export function formatPeruDate(date: Date | Timestamp | string | { toDate: () => Date } | null | undefined): string {
  return toPeruDate(date).toLocaleDateString("es-PE")
}

/**
 * Formats a date to Peru locale time string
 */
export function formatPeruTime(date: Date | Timestamp | string | { toDate: () => Date } | null | undefined): string {
  return toPeruDate(date).toLocaleTimeString("es-PE")
}

/**
 * Gets the day key (YYYY-MM-DD) for grouping orders in Peru timezone
 */
export function getPeruDayKey(date: Date | Timestamp | string | { toDate: () => Date } | null | undefined): string {
  const peruDate = toPeruDate(date)
  const year = peruDate.getFullYear()
  const month = String(peruDate.getMonth() + 1).padStart(2, '0')
  const day = String(peruDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats a number as Peruvian currency (Soles)
 * Returns string in format: "S/ 0.00"
 */
export function formatCurrency(value: any): string {
  const numValue = Number(value) || 0
  return `S/ ${numValue.toFixed(2)}`
}

/**
 * Normalizes variant names for inventory matching
 * Ensures that "500 ml", "500ml", "500 ML" all become "500ml"
 * and "1 litro", "1 Litro", "1L" all become "1litro"
 * 
 * Process:
 * 1. Trim whitespace
 * 2. Convert to lowercase
 * 3. Replace multiple spaces with single space
 * 4. Remove spaces before units: "500 ml" → "500ml"
 * 5. Normalize units: "litro(s)" → "litro", "ml" stays "ml"
 */
export function normalizeVariantName(variant: string): string {
  if (!variant || typeof variant !== 'string') {
    return ''
  }

  return variant
    .trim() // Remove leading/trailing whitespace
    .toLowerCase() // Convert to lowercase
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\s+(ml|mililitro|mililitros|lt|litro|litros|l)\b/g, '$1') // Remove spaces before units
    .replace(/\s+/g, '') // Remove all remaining spaces
    .replace(/litros?$/, 'litro') // Normalize "litro(s)" to "litro"
}

/**
 * Formats a date and time as professional receipt format (DD/MM/YYYY HH:MM AM/PM)
 */
export function formatReceiptDateTime(date: Date | Timestamp | string | { toDate: () => Date } | null | undefined): string {
  try {
    const peruDate = toPeruDate(date)
    const dateStr = peruDate.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" })
    const timeStr = peruDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true })
    return `${dateStr} - ${timeStr}`
  } catch (e) {
    console.error("[v0] Error formatting receipt date/time:", e)
    return "N/A"
  }
}
