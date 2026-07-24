/**
 * Thermal Printer Utilities
 * Support for 80mm thermal printers (ESC/POS protocol)
 * Used in POS systems for receipts, tickets, and kitchen orders
 */

export interface ThermalPrinterConfig {
  width: number // Paper width in characters (default: 42 for 80mm)
  lineHeight: number // Line height in pixels
  charWidth: number // Character width in pixels
}

export interface ReceiptElement {
  type: 'text' | 'line' | 'spacer' | 'barcode' | 'qrcode'
  content?: string
  align?: 'left' | 'center' | 'right'
  size?: 'normal' | 'double' | 'large'
  bold?: boolean
  underline?: boolean
  style?: string
}

const DEFAULT_CONFIG: ThermalPrinterConfig = {
  width: 42, // 80mm printer default
  lineHeight: 24,
  charWidth: 8,
}

/**
 * Format text for thermal printer with alignment and sizing
 */
export function formatThermalText(
  text: string,
  align: 'left' | 'center' | 'right' = 'left',
  size: 'normal' | 'double' | 'large' = 'normal',
  config: ThermalPrinterConfig = DEFAULT_CONFIG
): string {
  let formatted = text
  const width = config.width

  // Handle sizing (for display, actual thermal printer would use ESC/POS commands)
  if (size === 'double') {
    formatted = `${formatted}`
  } else if (size === 'large') {
    formatted = `${formatted}`
  }

  // Handle alignment
  if (align === 'center') {
    const padding = Math.max(0, Math.floor((width - formatted.length) / 2))
    formatted = ' '.repeat(padding) + formatted
  } else if (align === 'right') {
    const padding = Math.max(0, width - formatted.length)
    formatted = ' '.repeat(padding) + formatted
  }

  return formatted
}

/**
 * Create ESC/POS commands for thermal printer
 * Returns byte array that can be sent to thermal printer
 */
export function generateESCPOS(elements: ReceiptElement[]): string {
  let output = ''
  const config = DEFAULT_CONFIG

  elements.forEach((element) => {
    switch (element.type) {
      case 'text':
        let text = element.content || ''
        const align = element.align || 'left'
        const size = element.size || 'normal'

        // Align text
        text = formatThermalText(text, align, size, config)

        // Add formatting
        if (element.bold) text = `\x1b[1m${text}\x1b[0m`
        if (element.underline) text = `\x1b[4m${text}\x1b[0m`

        output += text + '\n'
        break

      case 'line':
        output += '-'.repeat(config.width) + '\n'
        break

      case 'spacer':
        output += '\n'
        break

      default:
        break
    }
  })

  return output
}

/**
 * Generate HTML for print preview (browser printing)
 */
export function generatePrintHTML(
  elements: ReceiptElement[],
  storeName?: string,
  storeInfo?: string
): string {
  let html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recibo</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          margin: 0 auto;
          background: white;
          color: black;
          line-height: 1.4;
        }

        .receipt {
          padding: 8mm;
          min-height: 100%;
        }

        .header {
          text-align: center;
          margin-bottom: 8mm;
          border-bottom: 1px solid #000;
          padding-bottom: 4mm;
        }

        .store-name {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 2mm;
        }

        .store-info {
          font-size: 10px;
          line-height: 1.2;
        }

        .content {
          margin-bottom: 8mm;
        }

        .section {
          margin-bottom: 4mm;
        }

        .section-title {
          font-weight: bold;
          margin-bottom: 2mm;
          font-size: 11px;
        }

        .line {
          border-bottom: 1px dashed #000;
          margin: 2mm 0;
        }

        .line.solid {
          border-bottom: 1px solid #000;
        }

        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }

        .text-normal { font-size: 11px; }
        .text-double { font-size: 13px; font-weight: bold; }
        .text-large { font-size: 14px; font-weight: bold; }

        .text-bold { font-weight: bold; }
        .text-underline { text-decoration: underline; }

        .spacer { margin: 4mm 0; }
        .spacer-small { margin: 2mm 0; }

        .footer {
          text-align: center;
          font-size: 9px;
          border-top: 1px solid #000;
          padding-top: 4mm;
          margin-top: 8mm;
        }

        table {
          width: 100%;
          font-size: 10px;
          border-collapse: collapse;
        }

        table td {
          padding: 1mm 0;
        }

        table th {
          border-bottom: 1px solid #000;
          padding: 2mm 0;
          font-weight: bold;
          font-size: 10px;
        }

        @media print {
          body {
            width: 80mm;
            margin: 0;
            padding: 0;
          }
          .receipt {
            padding: 6mm;
          }
        }

        @page {
          size: 80mm auto;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        ${storeName ? `<div class="header"><div class="store-name">${storeName}</div>` : '<div class="header">'}
        ${storeInfo ? `<div class="store-info">${storeInfo}</div>` : ''}
        </div>

        <div class="content">
  `

  elements.forEach((element) => {
    const align = element.align || 'left'
    const size = element.size || 'normal'
    const sizeClass = `text-${size}`
    const alignClass = `text-${align}`
    const boldClass = element.bold ? 'text-bold' : ''
    const underlineClass = element.underline ? 'text-underline' : ''

    switch (element.type) {
      case 'text':
        html += `<div class="${alignClass} ${sizeClass} ${boldClass} ${underlineClass}">${element.content}</div>`
        break

      case 'line':
        const lineClass = element.style === 'solid' ? 'solid' : ''
        html += `<div class="line ${lineClass}"></div>`
        break

      case 'spacer':
        const spacerClass = element.style === 'small' ? 'spacer-small' : 'spacer'
        html += `<div class="${spacerClass}"></div>`
        break

      default:
        break
    }
  })

  html += `
        </div>
      </div>
    </body>
    </html>
  `

  return html
}

/**
 * Calculate text width considering font and size
 */
export function calculateTextWidth(
  text: string,
  size: 'normal' | 'double' | 'large' = 'normal'
): number {
  if (size === 'normal') return text.length
  if (size === 'double') return Math.ceil(text.length * 1.5)
  if (size === 'large') return Math.ceil(text.length * 1.8)
  return text.length
}

/**
 * Wrap text to fit thermal printer width
 */
export function wrapText(
  text: string,
  width: number = 42,
  size: 'normal' | 'double' | 'large' = 'normal'
): string[] {
  const actualWidth = Math.floor(width / (size === 'normal' ? 1 : size === 'double' ? 1.5 : 1.8))
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  words.forEach((word) => {
    if ((currentLine + word).length > actualWidth) {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word
    }
  })

  if (currentLine) lines.push(currentLine)
  return lines
}

/**
 * Generate summary line (label: value) with right alignment
 * Example: "Total........................S/ 125.50"
 */
export function generateSummaryLine(
  label: string,
  value: string,
  width: number = 42,
  fillChar: string = '.'
): string {
  const totalLength = width
  const fillerLength = totalLength - label.length - value.length
  if (fillerLength <= 0) {
    return label + ' ' + value
  }
  return label + fillChar.repeat(fillerLength) + value
}
