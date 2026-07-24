"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Printer,
  Settings,
  AlertCircle,
  CheckCircle,
  Wifi,
  WifiOff,
  Zap,
  Info,
} from "lucide-react"
import { PrintStatusIndicator } from "@/components/print/print-preview-modal"
import { PrintSettingsDialog } from "@/components/print/print-settings-dialog"
import { usePrintSettings } from "@/lib/hooks/use-print-settings"
import { PrintSettings } from "@/lib/print/print-settings"

export interface PrintManagementPanelProps {
  storeId: string
  storeName?: string
  onSettingsSaved?: (settings: PrintSettings) => void
}

/**
 * Print Management Panel
 * Shows printer status and allows configuration
 * Can be integrated into store settings page
 */
export function PrintManagementPanel({
  storeId,
  storeName = "Tienda",
  onSettingsSaved,
}: PrintManagementPanelProps) {
  const { settings: printSettings, saveSettings, isLoading, error } = usePrintSettings(storeId)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [printerStatus, setPrinterStatus] = useState<"connected" | "disconnected" | "unknown">(
    "unknown"
  )

  // Simulate printer status check
  useEffect(() => {
    const checkPrinterStatus = async () => {
      try {
        // In a real app, you would check actual printer connectivity here
        // For now, we'll just set it to connected if settings are configured
        if (printSettings?.printerName) {
          setPrinterStatus("connected")
        } else {
          setPrinterStatus("unknown")
        }
      } catch {
        setPrinterStatus("disconnected")
      }
    }

    checkPrinterStatus()
  }, [printSettings])

  const handleSaveSettings = async (newSettings: PrintSettings) => {
    await saveSettings(newSettings)
    onSettingsSaved?.(newSettings)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Printer Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Estado de Impresora
            </CardTitle>
            <CardDescription>
              Configuración y estado actual de impresión para {storeName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Printer Status Indicator */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                {printerStatus === "connected" ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">Impresora Conectada</span>
                  </div>
                ) : printerStatus === "disconnected" ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm font-medium text-red-600">Impresora Desconectada</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm font-medium text-yellow-600">Estado Desconocido</span>
                  </div>
                )}
              </div>

              <Badge variant={printerStatus === "connected" ? "default" : "secondary"}>
                {printSettings?.paperWidth}mm
              </Badge>
            </div>

            {/* Quick Stats */}
            {printSettings && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Ancho Papel</p>
                  <p className="text-lg font-bold text-primary">{printSettings.paperWidth}mm</p>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10">
                  <p className="text-xs text-muted-foreground mb-1">Caracteres</p>
                  <p className="text-lg font-bold text-blue-500">{printSettings.printerWidth}</p>
                </div>

                <div className="p-3 rounded-lg bg-green-500/10">
                  <p className="text-xs text-muted-foreground mb-1">Copias</p>
                  <p className="text-lg font-bold text-green-500">{printSettings.printCopies}</p>
                </div>

                <div className="p-3 rounded-lg bg-purple-500/10">
                  <p className="text-xs text-muted-foreground mb-1">Fuente</p>
                  <p className="text-sm font-bold text-purple-500">
                    {printSettings.useThermalFont ? "Mono" : "Normal"}
                  </p>
                </div>
              </div>
            )}

            {/* Features List */}
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <p className="text-sm font-semibold mb-2">Características Habilitadas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {printSettings?.showStoreInfo && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Info. de Tienda
                  </div>
                )}
                {printSettings?.autocut && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Auto-corte
                  </div>
                )}
                {printSettings?.autoOpenDrawer && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Gaveta Auto
                  </div>
                )}
                {printSettings?.includeQRCode && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Código QR
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración Rápida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Haz clic en el botón de configuración para personalizar cómo se imprimen tus recibos
                y tickets de cocina.
              </AlertDescription>
            </Alert>

            <Button
              className="w-full gap-2"
              onClick={() => setShowSettingsDialog(true)}
            >
              <Settings className="h-4 w-4" />
              Configurar Impresora
            </Button>
          </CardContent>
        </Card>

        {/* Hardware Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información de Hardware</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {printSettings && (
              <>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Nombre de Impresora</span>
                  <span className="font-medium">
                    {printSettings.printerName || "Por defecto"}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Ancho de Papel</span>
                  <span className="font-medium">{printSettings.paperWidth}mm</span>
                </div>

                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Ancho en Caracteres</span>
                  <span className="font-medium">{printSettings.printerWidth} chars</span>
                </div>

                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Detección de Marca Negra</span>
                  <span className="font-medium">
                    {printSettings.blackMarkDetection ? "Habilitado" : "Deshabilitado"}
                  </span>
                </div>

                <div className="flex justify-between py-2">
                  <span className="text-sm text-muted-foreground">Última Actualización</span>
                  <span className="font-medium text-xs">
                    {new Date(printSettings.lastUpdated).toLocaleString("es-PE")}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Test Print Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prueba de Impresión</CardTitle>
            <CardDescription>
              Imprime un documento de prueba para verificar que tu impresora está configurada correctamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full gap-2" disabled>
              <Printer className="h-4 w-4" />
              Imprimir Página de Prueba (Próximamente)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Settings Dialog */}
      <PrintSettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        storeId={storeId}
        onSave={handleSaveSettings}
        initialSettings={printSettings || undefined}
      />
    </>
  )
}
