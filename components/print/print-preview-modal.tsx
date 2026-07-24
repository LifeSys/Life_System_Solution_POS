"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Printer, Monitor, FileText, Settings, Eye, X } from "lucide-react"
import { ReceiptElement, generatePrintHTML } from "@/lib/print/thermal-printer"

export interface PrintPreviewProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  elements: ReceiptElement[]
  storeName?: string
  storeInfo?: string
  onPrint?: () => void
  printerWidth?: number
}

/**
 * Advanced Print Preview Modal
 * Shows print preview with multiple display modes and settings
 */
export function PrintPreviewModal({
  isOpen,
  onClose,
  title = "Vista Previa",
  elements,
  storeName,
  storeInfo,
  onPrint,
  printerWidth = 42,
}: PrintPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [viewMode, setViewMode] = useState<"preview" | "html" | "code">("preview")

  const html = generatePrintHTML(elements, storeName, storeInfo)

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
        onPrint?.()
      }, 500)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `print-${new Date().toISOString().split("T")[0]}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {title}
            </div>
            <Badge variant="outline" className="ml-auto">
              {printerWidth} caracteres
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Vista previa del documento a imprimir. Puedes cambiar el zoom y el modo de visualización.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview" className="gap-2">
              <Monitor className="h-4 w-4" />
              Vista Previa
            </TabsTrigger>
            <TabsTrigger value="html" className="gap-2">
              <FileText className="h-4 w-4" />
              HTML
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-2">
              <Settings className="h-4 w-4" />
              Código
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Zoom:</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setZoom(Math.max(50, zoom - 25))}
                    >
                      −
                    </Button>
                    <span className="w-12 text-center text-sm font-medium">{zoom}%</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setZoom(Math.min(200, zoom + 25))}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-border p-8 mx-auto" style={{
                width: `${80 * (zoom / 100)}mm`,
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              }}>
                <div
                  className="font-mono text-sm leading-relaxed"
                  style={{
                    fontFamily: "'Courier New', monospace",
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    fontSize: "11px",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: html
                      .split("<body>")[1]
                      ?.split("</body>")[0]
                      ?.replace(/<[^>]*>/g, "")
                      || "",
                  }}
                />
              </div>
            </div>
          </TabsContent>

          {/* HTML Tab */}
          <TabsContent value="html" className="flex-1 overflow-y-auto">
            <div className="p-4 bg-muted rounded-lg">
              <pre className="text-xs overflow-x-auto p-4 bg-background rounded border">
                <code>{html}</code>
              </pre>
            </div>
          </TabsContent>

          {/* Code Tab */}
          <TabsContent value="code" className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Elementos del Documento</CardTitle>
                  <CardDescription>
                    {elements.length} elementos configurados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {elements.map((el, idx) => (
                    <div key={idx} className="p-2 bg-muted rounded text-xs font-mono">
                      <div className="font-semibold text-foreground">{el.type.toUpperCase()}</div>
                      {el.content && (
                        <div className="text-muted-foreground truncate">{el.content}</div>
                      )}
                      {el.align && <div className="text-muted-foreground">align: {el.align}</div>}
                      {el.size && <div className="text-muted-foreground">size: {el.size}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Información de Almacén</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><span className="font-semibold">Nombre:</span> {storeName || "No configurado"}</div>
                  <div><span className="font-semibold">Código:</span> {storeInfo || "No configurado"}</div>
                  <div><span className="font-semibold">Ancho:</span> {printerWidth} caracteres (80mm)</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDownload}>
            Descargar HTML
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Ahora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Print Status Indicator Component
 * Shows current print settings and configuration
 */
export interface PrintStatusIndicatorProps {
  printerName?: string
  paperWidth?: number
  isConfigured?: boolean
  onClick?: () => void
}

export function PrintStatusIndicator({
  printerName = "Impresora Térmica",
  paperWidth = 80,
  isConfigured = true,
  onClick,
}: PrintStatusIndicatorProps) {
  return (
    <Card
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Printer className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{printerName}</p>
              <p className="text-xs text-muted-foreground">
                {paperWidth}mm
                {isConfigured ? " • Configurado" : " • No configurado"}
              </p>
            </div>
          </div>
          <Badge variant={isConfigured ? "default" : "secondary"}>
            {isConfigured ? "Listo" : "Config."}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
