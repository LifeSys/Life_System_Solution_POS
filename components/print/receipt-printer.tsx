"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Printer, Eye, Download, AlertCircle } from "lucide-react"
import { generatePrintHTML, ReceiptElement } from "@/lib/print/thermal-printer"

export interface ReceiptPrinterProps {
  title?: string
  elements: ReceiptElement[]
  storeName?: string
  storeInfo?: string
  fileName?: string
  onPrint?: () => void
  onPreview?: () => void
}

/**
 * Professional Receipt Printer Component
 * Handles printing to thermal printers and PDF generation
 * Supports 80mm printer standard format
 */
export function ReceiptPrinter({
  title = "Recibo",
  elements,
  storeName,
  storeInfo,
  fileName = "recibo",
  onPrint,
  onPreview,
}: ReceiptPrinterProps) {
  const [isPrinting, setIsPrinting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Generate and send to thermal printer
   */
  const handlePrint = useCallback(async () => {
    setIsPrinting(true)
    setError(null)

    try {
      const html = generatePrintHTML(elements, storeName, storeInfo)
      const printWindow = window.open("", "_blank", "width=400,height=600")

      if (!printWindow) {
        throw new Error("No se pudo abrir la ventana de impresión. Verifica que los pop-ups no estén bloqueados.")
      }

      printWindow.document.write(html)
      printWindow.document.close()

      // Wait for content to load, then print
      printWindow.onload = () => {
        printWindow.print()
        onPrint?.()
      }

      // Fallback if onload doesn't fire
      setTimeout(() => {
        printWindow.print()
        onPrint?.()
      }, 500)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al imprimir"
      setError(message)
      console.error("Print error:", err)
    } finally {
      setIsPrinting(false)
    }
  }, [elements, storeName, storeInfo, onPrint])

  /**
   * Show print preview
   */
  const handlePreview = useCallback(() => {
    const html = generatePrintHTML(elements, storeName, storeInfo)
    setShowPreview(true)
    onPreview?.()
  }, [elements, storeName, storeInfo, onPreview])

  /**
   * Download as HTML file
   */
  const handleDownload = useCallback(() => {
    try {
      const html = generatePrintHTML(elements, storeName, storeInfo)
      const blob = new Blob([html], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${fileName}-${new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError("Error al descargar el archivo")
      console.error("Download error:", err)
    }
  }, [elements, storeName, storeInfo, fileName])

  return (
    <>
      <div className="space-y-2">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handlePrint}
            disabled={isPrinting}
            className="gap-2"
            variant="default"
            size="sm"
          >
            <Printer className="h-4 w-4" />
            {isPrinting ? "Imprimiendo..." : "Imprimir"}
          </Button>

          <Button
            onClick={handlePreview}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Vista Previa
          </Button>

          <Button
            onClick={handleDownload}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa - {title}</DialogTitle>
            <DialogDescription>Previsualización del contenido que se enviará a impresión.</DialogDescription>
          </DialogHeader>

          <div className="bg-white p-4 rounded-lg border border-border">
            <div
              className="mx-auto bg-white"
              style={{
                width: "80mm",
                fontFamily: "'Courier New', monospace",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                fontSize: "11px",
                lineHeight: "1.4",
              }}
            >
              {generatePrintHTML(elements, storeName, storeInfo).split("<div")[1] &&
                generatePrintHTML(elements, storeName, storeInfo)
                  .split("</body>")[0]
                  .split('<div class="receipt">')[1]
                  ?.split("</div>")[0]
                  ?.replace(/<[^>]*>/g, "")}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handlePrint}
              disabled={isPrinting}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              {isPrinting ? "Imprimiendo..." : "Imprimir Ahora"}
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Quick Print Button Component
 * Simple button for quick printing without preview options
 */
export interface QuickPrintButtonProps {
  elements: ReceiptElement[]
  storeName?: string
  storeInfo?: string
  label?: string
  onPrint?: () => void
}

export function QuickPrintButton({
  elements,
  storeName,
  storeInfo,
  label = "Imprimir",
  onPrint,
}: QuickPrintButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false)

  const handleQuickPrint = useCallback(async () => {
    setIsPrinting(true)
    try {
      const html = generatePrintHTML(elements, storeName, storeInfo)
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
          onPrint?.()
        }, 500)
      }
    } catch (err) {
      console.error("Print error:", err)
    } finally {
      setIsPrinting(false)
    }
  }, [elements, storeName, storeInfo, onPrint])

  return (
    <Button
      onClick={handleQuickPrint}
      disabled={isPrinting}
      size="sm"
      className="gap-2"
    >
      <Printer className="h-4 w-4" />
      {isPrinting ? "Imprimiendo..." : label}
    </Button>
  )
}
