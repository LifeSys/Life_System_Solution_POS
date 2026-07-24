"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getExpenses, type ExpenseCategory, type CashBoxType } from "@/lib/firebase/firestore"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Trash2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function GastosHistory() {
  const { store, user } = useAuth()
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">("all")

  if (!store) return null

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const filters = filterCategory !== "all" ? { category: filterCategory } : undefined
        const data = await getExpenses(store.id!, filters)
        setExpenses(data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()))
      } catch (error) {
        console.error("Error loading expenses:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los gastos",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadExpenses()
  }, [filterCategory, store.id, toast])

  const categories = [
    { value: "all", label: "Todas las categorías" },
    { value: "supplies", label: "Compras/Insumos" },
    { value: "providers", label: "Pagos a Proveedores" },
    { value: "delivery", label: "Entregas/Envíos" },
    { value: "maintenance", label: "Mantenimiento" },
    { value: "cleaning", label: "Limpieza" },
    { value: "services", label: "Servicios" },
    { value: "utilities", label: "Servicios Básicos" },
    { value: "salaries", label: "Sueldos" },
    { value: "transportation", label: "Movilidad" },
    { value: "emergency", label: "Emergencias" },
    { value: "other", label: "Otros" },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Historial de Gastos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
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

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay gastos registrados</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className={`p-3 border rounded-lg flex justify-between items-start ${
                    expense.isVoid ? "bg-muted opacity-50" : ""
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {expense.userName} • {expense.createdAt.toDate().toLocaleString("es-PE")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{formatCurrency(expense.amount)}</p>
                    {expense.isVoid && (
                      <p className="text-xs text-muted-foreground">Anulado</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
