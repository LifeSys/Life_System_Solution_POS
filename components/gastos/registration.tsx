"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  registerExpenseTransaction,
  type ExpenseCategory,
  type CashBoxType,
} from "@/lib/firebase/firestore"
import { AlertCircle, Check } from "lucide-react"

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "supplies", label: "Compras/Insumos" },
  { value: "providers", label: "Pagos a Proveedores" },
  { value: "delivery", label: "Entregas/Envíos" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "cleaning", label: "Limpieza" },
  { value: "services", label: "Servicios (Internet, Teléfono, etc)" },
  { value: "utilities", label: "Servicios (Luz, Agua, Gas)" },
  { value: "salaries", label: "Sueldos" },
  { value: "transportation", label: "Movilidad/Combustible" },
  { value: "emergency", label: "Gastos de Emergencia" },
  { value: "other", label: "Otros Gastos" },
]

const CASH_BOXES: { value: CashBoxType; label: string }[] = [
  { value: "operational", label: "Caja Operativa" },
  { value: "principal", label: "Caja Principal" },
  { value: "strongbox", label: "Caja Fuerte" },
]

export function GastosRegistration() {
  const { user, store } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    amount: "",
    category: "supplies" as ExpenseCategory,
    description: "",
    cashBox: "operational" as CashBoxType,
    notes: "",
  })

  if (!user || !store) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.amount || !formData.description) {
      toast({
        title: "Error",
        description: "Por favor completa los campos requeridos",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      await registerExpenseTransaction(
        store.id!,
        {
          storeId: store.id!,
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description,
          cashBoxOrigin: formData.cashBox,
          userId: user.id!,
          userName: user.name,
          notes: formData.notes,
        },
        user.id!,
        user.name
      )

      toast({
        title: "Éxito",
        description: "Gasto registrado correctamente",
      })

      // Reset form
      setFormData({
        amount: "",
        category: "supplies",
        description: "",
        cashBox: "operational",
        notes: "",
      })
    } catch (error) {
      console.error("Error registering expense:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar el gasto. Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          Registrar Nuevo Gasto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Monto <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center">
              <span className="text-lg font-semibold text-muted-foreground mr-2">S/</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Categoría <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value as ExpenseCategory })
              }
              disabled={loading}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Descripción <span className="text-red-500">*</span>
            </Label>
            <Input
              id="description"
              placeholder="Ej: Compra de queso fresco"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Cash Box */}
          <div className="space-y-2">
            <Label htmlFor="cashBox">
              De dónde sale el dinero <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.cashBox}
              onValueChange={(value) =>
                setFormData({ ...formData, cashBox: value as CashBoxType })
              }
              disabled={loading}
            >
              <SelectTrigger id="cashBox">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASH_BOXES.map((box) => (
                  <SelectItem key={box.value} value={box.value}>
                    {box.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El dinero se descontará automáticamente de la caja seleccionada
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observaciones</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales (opcional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            size="lg"
          >
            {loading ? (
              "Registrando..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Registrar Gasto
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
