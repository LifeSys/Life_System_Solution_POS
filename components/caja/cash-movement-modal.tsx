"use client"

import { useState } from "react"
import { usePOS } from "@/contexts/pos-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { ArrowUp, ArrowDown, AlertCircle } from "lucide-react"

interface CashMovementModalProps {
  isOpen: boolean
  onClose: () => void
  isCashOpen?: boolean
}

type MovementType = "entrada" | "salida"
type MovementCategory =
  | "fondo_sencillo"
  | "dinero_dueno"
  | "reposicion"
  | "propina_tienda"
  | "propina_mozo"
  | "pago_proveedor"
  | "retiro_dueno"
  | "ajuste_arqueo"
  | "otro"

const ENTRADA_CATEGORIES: { value: MovementCategory; label: string }[] = [
  { value: "fondo_sencillo", label: "Fondo Sencillo (Cambio)" },
  { value: "dinero_dueno", label: "Dinero del Dueño" },
  { value: "reposicion", label: "Reposición" },
  { value: "propina_tienda", label: "Propina Tienda" },
  { value: "propina_mozo", label: "Propina Mozo" },
  { value: "otro", label: "Otro" },
]

const SALIDA_CATEGORIES: { value: MovementCategory; label: string }[] = [
  { value: "pago_proveedor", label: "Pago Proveedor" },
  { value: "retiro_dueno", label: "Retiro Dueño" },
  { value: "ajuste_arqueo", label: "Ajuste Arqueo" },
  { value: "otro", label: "Otro" },
]

export function CashMovementModal({ isOpen, onClose, isCashOpen = false }: CashMovementModalProps) {
  const { recordCashMovement } = usePOS()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    type: "entrada" as MovementType,
    category: "dinero_dueno" as MovementCategory,
    amount: "",
    description: "",
    origin: "caja_operativa" as "caja_operativa" | "caja_fuerte",
  })

  const categories =
    formData.type === "entrada" ? ENTRADA_CATEGORIES : SALIDA_CATEGORIES

  const handleTypeChange = (type: MovementType) => {
    setFormData({
      ...formData,
      type,
      category: type === "entrada" ? "dinero_dueno" : "pago_proveedor",
      origin: "caja_operativa", // Reset to operational when changing type
    })
  }

  const handleCategoryChange = (category: MovementCategory) => {
    setFormData({ ...formData, category })
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setFormData({ ...formData, amount: value })
    }
  }

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, description: e.target.value })
  }

  const handleOriginChange = (origin: "caja_operativa" | "caja_fuerte") => {
    setFormData({ ...formData, origin })
  }

  const resetForm = () => {
    setFormData({
      type: "entrada",
      category: "dinero_dueno",
      amount: "",
      description: "",
      origin: "caja_operativa",
    })
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    // Validate
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("El monto debe ser mayor a 0")
      return
    }

    // Validate cash is open for ANY operativa movement (entrada or salida)
    if (formData.origin === "caja_operativa" && !isCashOpen) {
      setError("No se puede realizar movimientos en caja operativa porque la caja está cerrada")
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      await recordCashMovement(
        formData.type,
        formData.category,
        parseFloat(formData.amount),
        formData.description || `${formData.type}: ${formData.category}`,
        formData.origin
      )

      // Success - reset and close
      resetForm()
      onClose()
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al registrar movimiento"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formData.type === "entrada" ? (
              <ArrowUp className="h-5 w-5 text-green-500" />
            ) : (
              <ArrowDown className="h-5 w-5 text-red-500" />
            )}
            Movimiento de Caja
          </DialogTitle>
          <DialogDescription>
            {formData.type === "entrada"
              ? "Registrar dinero que entra a la caja"
              : "Registrar dinero que sale de la caja"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Movimiento</label>
            <div className="flex gap-2">
              <Button
                variant={formData.type === "entrada" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => handleTypeChange("entrada")}
                disabled={isLoading}
              >
                <ArrowUp className="h-4 w-4" />
                Entrada
              </Button>
              <Button
                variant={formData.type === "salida" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => handleTypeChange("salida")}
                disabled={isLoading}
              >
                <ArrowDown className="h-4 w-4" />
                Salida
              </Button>
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoría</label>
            <Select
              value={formData.category}
              onValueChange={handleCategoryChange}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destination/Origin Selection (for Entrada and Salida) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {formData.type === "entrada" ? "Destino del Dinero" : "Origen del Dinero"}
            </label>
            <div className="flex gap-2">
              <Button
                variant={
                  formData.origin === "caja_operativa" ? "default" : "outline"
                }
                className="flex-1"
                onClick={() => handleOriginChange("caja_operativa")}
                disabled={isLoading}
              >
                Operativa
              </Button>
              <Button
                variant={
                  formData.origin === "caja_fuerte" ? "default" : "outline"
                }
                className="flex-1"
                onClick={() => handleOriginChange("caja_fuerte")}
                disabled={isLoading}
              >
                Fuerte
              </Button>
            </div>
            {formData.origin === "caja_operativa" && !isCashOpen && (
              <p className="text-xs text-red-600 mt-1">
                ⚠ No se puede realizar movimientos en caja operativa porque la caja está cerrada
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Monto (S/.)</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={formData.amount}
              onChange={handleAmountChange}
              disabled={isLoading}
              className="text-lg font-semibold"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción (Opcional)</label>
            <Textarea
              placeholder="Notas adicionales sobre este movimiento..."
              value={formData.description}
              onChange={handleDescriptionChange}
              disabled={isLoading}
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.amount}
            className="gap-2"
          >
            {isLoading && <Spinner className="h-4 w-4" />}
            {isLoading ? "Registrando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
