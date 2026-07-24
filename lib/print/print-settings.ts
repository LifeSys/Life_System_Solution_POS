/**
 * Print Settings Manager
 * Stores and retrieves printing configuration per store
 */

export interface PrintSettings {
  // Store info
  storeId: string
  
  // Printer configuration
  printerName?: string
  printerWidth: number // 42 for 80mm, 56 for 58mm, 80 for A4
  useThermalFont: boolean // Use monospace for thermal printers
  useThermalPrinter?: boolean // Legacy alias for thermal printer mode
  
  // Receipt customization
  showStoreInfo: boolean // Show store name, code, address
  showOrderNumber: boolean // Show order/receipt number
  showDateTime: boolean // Show date and time
  showTableInfo: boolean // Show table/floor info
  showItemNotes: boolean // Show special instructions
  showPaymentMethod: boolean // Show payment method
  
  // Footer customization
  footerText?: string // Custom footer message
  thanksMessage?: string // Custom thank you message
  includeQRCode: boolean // Include QR code with order info
  
  // Kitchen ticket settings
  kitchenShowTableOnly: boolean // Kitchen: show only table number (hide prices)
  kitchenShowPriority: boolean // Kitchen: show priority indicator
  kitchenLargePrint: boolean // Kitchen: use larger font
  
  // Cash closure settings
  showDetailedBreakdown: boolean // Show payment method breakdown
  showOrderCount: boolean // Show number of orders
  showCashierName: boolean // Show cashier name on closure
  
  // Paper settings
  paperWidth: number // mm (80, 58, or 210 for A4)
  autocut: boolean // Auto-cut paper after print
  blackMarkDetection: boolean // Use black mark detection
  
  // Advanced
  autoOpenDrawer: boolean // Open cash drawer after payment print
  printCopies: number // Number of copies to print
  lastUpdated: number // Timestamp
}

/**
 * Default print settings
 */
export const DEFAULT_PRINT_SETTINGS: Omit<PrintSettings, 'storeId'> = {
  printerWidth: 42, // 80mm standard
  useThermalFont: true,
  useThermalPrinter: true,
  showStoreInfo: true,
  showOrderNumber: true,
  showDateTime: true,
  showTableInfo: true,
  showItemNotes: true,
  showPaymentMethod: true,
  footerText: "Gracias por su compra",
  thanksMessage: undefined,
  includeQRCode: false,
  kitchenShowTableOnly: true,
  kitchenShowPriority: true,
  kitchenLargePrint: false,
  showDetailedBreakdown: true,
  showOrderCount: true,
  showCashierName: false,
  paperWidth: 80,
  autocut: false,
  blackMarkDetection: false,
  autoOpenDrawer: false,
  printCopies: 1,
  lastUpdated: Date.now(),
}

/**
 * Predefined printer profiles
 */
export const PRINTER_PROFILES = {
  thermal80mm: {
    name: "Impresora Térmica 80mm",
    printerWidth: 42,
    useThermalFont: true,
  useThermalPrinter: true,
    paperWidth: 80,
    autocut: true,
  },
  thermal58mm: {
    name: "Impresora Térmica 58mm",
    printerWidth: 32,
    useThermalFont: true,
  useThermalPrinter: true,
    paperWidth: 58,
    autocut: true,
  },
  inkjet: {
    name: "Impresora Inyección de Tinta",
    printerWidth: 80,
    useThermalFont: false,
    paperWidth: 210,
    autocut: false,
  },
  laser: {
    name: "Impresora Láser",
    printerWidth: 80,
    useThermalFont: false,
    paperWidth: 210,
    autocut: false,
  },
} as const

export type PrinterProfile = keyof typeof PRINTER_PROFILES

/**
 * Apply a printer profile to settings
 */
export function applyPrinterProfile(
  settings: PrintSettings,
  profile: PrinterProfile
): PrintSettings {
  const profileSettings = PRINTER_PROFILES[profile]
  return {
    ...settings,
    ...profileSettings,
    lastUpdated: Date.now(),
  }
}

/**
 * Validate print settings
 */
export function validatePrintSettings(settings: Partial<PrintSettings>): string[] {
  const errors: string[] = []

  if (!settings.storeId) {
    errors.push("Store ID es requerido")
  }

  if (!settings.printerWidth || settings.printerWidth < 20 || settings.printerWidth > 80) {
    errors.push("Ancho de impresora debe estar entre 20 y 80 caracteres")
  }

  if (!settings.paperWidth || ![58, 80, 210].includes(settings.paperWidth)) {
    errors.push("Ancho de papel debe ser 58mm, 80mm o 210mm (A4)")
  }

  if (settings.printCopies && (settings.printCopies < 1 || settings.printCopies > 10)) {
    errors.push("Número de copias debe estar entre 1 y 10")
  }

  return errors
}

/**
 * Merge partial settings with defaults
 */
export function mergePrintSettings(
  partial: Partial<PrintSettings>,
  defaults: Omit<PrintSettings, 'storeId'> = DEFAULT_PRINT_SETTINGS
): PrintSettings {
  return {
    storeId: partial.storeId || "",
    ...defaults,
    ...partial,
    lastUpdated: Date.now(),
  }
}

/**
 * Export settings as JSON
 */
export function exportSettingsJSON(settings: PrintSettings): string {
  return JSON.stringify(settings, null, 2)
}

/**
 * Import settings from JSON
 */
export function importSettingsJSON(json: string): PrintSettings | null {
  try {
    const parsed = JSON.parse(json) as PrintSettings
    const errors = validatePrintSettings(parsed)
    if (errors.length > 0) {
      console.error("Invalid settings:", errors)
      return null
    }
    return parsed
  } catch (error) {
    console.error("Error parsing settings JSON:", error)
    return null
  }
}
