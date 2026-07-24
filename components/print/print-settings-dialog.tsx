"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Printer,
  Download,
  Upload,
  Settings,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import {
  PrintSettings,
  DEFAULT_PRINT_SETTINGS,
  PRINTER_PROFILES,
  applyPrinterProfile,
  validatePrintSettings,
  mergePrintSettings,
  exportSettingsJSON,
  importSettingsJSON,
  type PrinterProfile,
} from "@/lib/print/print-settings"

export interface PrintSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  storeId: string
  onSave: (settings: PrintSettings) => Promise<void>
  initialSettings?: PrintSettings
}

/**
 * Print Settings Management Component
 * Allows administrators to configure printer behavior and receipt formatting
 */
export function PrintSettingsDialog({
  isOpen,
  onClose,
  storeId,
  onSave,
  initialSettings,
}: PrintSettingsDialogProps) {
  const [settings, setSettings] = useState<PrintSettings>(
    initialSettings || mergePrintSettings({ storeId })
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  )

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings)
    }
  }, [initialSettings, isOpen])

  const handleApplyProfile = (profile: PrinterProfile) => {
    const newSettings = applyPrinterProfile(settings, profile)
    setSettings(newSettings)
    setMessage({ type: "success", text: "Perfil aplicado exitosamente" })
  }

  const handleSave = async () => {
    const errors = validatePrintSettings(settings)
    if (errors.length > 0) {
      setMessage({ type: "error", text: errors.join("; ") })
      return
    }

    setIsSaving(true)
    try {
      await onSave(settings)
      setMessage({ type: "success", text: "Configuración guardada exitosamente" })
      setTimeout(() => onClose(), 1500)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Error al guardar la configuración",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = () => {
    const json = exportSettingsJSON(settings)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `print-settings-${storeId}-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const imported = importSettingsJSON(content)
      if (imported) {
        setSettings({ ...imported, storeId })
        setMessage({ type: "success", text: "Configuración importada exitosamente" })
      } else {
        setMessage({ type: "error", text: "Error al importar la configuración" })
      }
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Impresión
          </DialogTitle>
          <DialogDescription>
            Personaliza cómo se imprimen los recibos y tickets en tu local
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="receipt">Recibo</TabsTrigger>
            <TabsTrigger value="kitchen">Cocina</TabsTrigger>
            <TabsTrigger value="advanced">Avanzado</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seleccionar Perfil de Impresora</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.entries(PRINTER_PROFILES) as Array<[PrinterProfile, any]>).map(
                  ([key, profile]) => (
                    <Button
                      key={key}
                      variant="outline"
                      className="w-full text-left justify-start"
                      onClick={() => handleApplyProfile(key)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      {profile.name}
                    </Button>
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuración de Hardware</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="printer-name">Nombre de la Impresora</Label>
                  <Input
                    id="printer-name"
                    value={settings.printerName || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, printerName: e.target.value })
                    }
                    placeholder="ej: Printer1, USB Printer"
                  />
                </div>

                <div>
                  <Label htmlFor="printer-width">Ancho de Papel (caracteres)</Label>
                  <Select
                    value={settings.printerWidth.toString()}
                    onValueChange={(val) =>
                      setSettings({ ...settings, printerWidth: parseInt(val) })
                    }
                  >
                    <SelectTrigger id="printer-width">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="32">32 caracteres (58mm)</SelectItem>
                      <SelectItem value="42">42 caracteres (80mm)</SelectItem>
                      <SelectItem value="56">56 caracteres (A4)</SelectItem>
                      <SelectItem value="80">80 caracteres (A4 ancho)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="paper-width">Ancho de Papel (mm)</Label>
                  <Select
                    value={settings.paperWidth.toString()}
                    onValueChange={(val) =>
                      setSettings({ ...settings, paperWidth: parseInt(val) })
                    }
                  >
                    <SelectTrigger id="paper-width">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58">58mm</SelectItem>
                      <SelectItem value="80">80mm (Estándar)</SelectItem>
                      <SelectItem value="210">210mm (A4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="thermal-font">Usar fuente monoespaciada para impresoras térmicas</Label>
                  <Switch
                    id="thermal-font"
                    checked={settings.useThermalFont}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, useThermalFont: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="autocut">Auto-corte de papel</Label>
                  <Switch
                    id="autocut"
                    checked={settings.autocut}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, autocut: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="open-drawer">Abrir gaveta de efectivo automáticamente</Label>
                  <Switch
                    id="open-drawer"
                    checked={settings.autoOpenDrawer}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, autoOpenDrawer: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receipt Tab */}
          <TabsContent value="receipt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Elementos a Mostrar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "showStoreInfo", label: "Información de la tienda" },
                  { key: "showOrderNumber", label: "Número de orden" },
                  { key: "showDateTime", label: "Fecha y hora" },
                  { key: "showTableInfo", label: "Información de mesa" },
                  { key: "showItemNotes", label: "Notas de productos" },
                  { key: "showPaymentMethod", label: "Método de pago" },
                  { key: "includeQRCode", label: "Código QR" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={settings[key as keyof PrintSettings] as boolean}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          [key]: checked,
                        })
                      }
                    />
                    <Label htmlFor={key}>{label}</Label>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personalización</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="footer-text">Texto de pie de página</Label>
                  <Input
                    id="footer-text"
                    value={settings.footerText || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, footerText: e.target.value })
                    }
                    placeholder="Ej: Gracias por su compra"
                  />
                </div>

                <div>
                  <Label htmlFor="thanks-message">Mensaje de agradecimiento</Label>
                  <Input
                    id="thanks-message"
                    value={settings.thanksMessage || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, thanksMessage: e.target.value })
                    }
                    placeholder="Ej: Vuelva pronto"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Kitchen Tab */}
          <TabsContent value="kitchen" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tickets de Cocina</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="kitchen-table-only">Mostrar solo número de mesa</Label>
                  <Switch
                    id="kitchen-table-only"
                    checked={settings.kitchenShowTableOnly}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, kitchenShowTableOnly: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="kitchen-priority">Mostrar indicador de prioridad</Label>
                  <Switch
                    id="kitchen-priority"
                    checked={settings.kitchenShowPriority}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, kitchenShowPriority: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="kitchen-large">Usar fuente más grande</Label>
                  <Switch
                    id="kitchen-large"
                    checked={settings.kitchenLargePrint}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, kitchenLargePrint: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cierre de Caja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-breakdown"
                    checked={settings.showDetailedBreakdown}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        showDetailedBreakdown: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="show-breakdown">Mostrar desglose detallado</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-order-count"
                    checked={settings.showOrderCount}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        showOrderCount: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="show-order-count">Mostrar cantidad de pedidos</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-cashier"
                    checked={settings.showCashierName}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        showCashierName: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="show-cashier">Mostrar nombre del cajero</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Otras Opciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="print-copies">Copias a imprimir</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="print-copies"
                      type="number"
                      min="1"
                      max="10"
                      value={settings.printCopies}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          printCopies: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                        })
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">copias</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="black-mark">Detección de marca negra</Label>
                  <Switch
                    id="black-mark"
                    checked={settings.blackMarkDetection}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, blackMarkDetection: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Importar / Exportar</CardTitle>
                <CardDescription>
                  Exporta tu configuración para respaldarla o compartirla con otros locales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4" />
                  Exportar Configuración
                </Button>
                <label className="block">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4" />
                      Importar Configuración
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {message && (
          <Alert className={message.type === "success" ? "border-green-500" : "border-destructive"}>
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <AlertDescription className={message.type === "success" ? "text-green-700" : ""}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
