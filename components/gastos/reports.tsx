"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  getExpenses,
  subscribeToSafeBoxMovements,
  subscribeToOpenCashRegister,
  subscribeToPaidOrders,
  type Expense,
  type ExpenseCategory,
  type SafeBoxMovement,
  type CashRegister,
  type Order
} from "@/lib/firebase/firestore"
import { formatCurrency, toPeruDate } from "@/lib/utils"
import { BarChart3, Wallet, TrendingUp, AlertCircle, Clock } from "lucide-react"

interface BranchFinancials {
  storeId: string
  storeName: string
  operationalBalance: number
  safeBoxBalance: number
  todaySales: number
  todayExpenses: number
  cashRegisterStatus: "open" | "closed"
  lastOpenedAt?: Date
  lastClosedAt?: Date
}

export function GastosReports() {
  const { store, storeId } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [movements, setMovements] = useState<SafeBoxMovement[]>([])
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [paidOrders, setPaidOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<"today" | "week" | "month">("month")

  if (!store) return null

  // Subscribe to realtime financial data
  useEffect(() => {
    if (!storeId) return

    setLoading(true)

    // Subscribe to movements
    const unsubMovements = subscribeToSafeBoxMovements(storeId, setMovements)

    // Subscribe to cash register
    const unsubCashRegister = subscribeToOpenCashRegister(storeId, setCashRegister)

    // Subscribe to paid orders for sales
    const unsubOrders = subscribeToPaidOrders(storeId, cashRegister?.id || "", setPaidOrders)

    setLoading(false)

    return () => {
      unsubMovements()
      unsubCashRegister()
      unsubOrders()
    }
  }, [storeId, cashRegister?.id])

  // Load historical expenses
  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const now = new Date()
        let startDate = new Date()

        if (period === "today") {
          startDate.setHours(0, 0, 0, 0)
        } else if (period === "week") {
          startDate.setDate(now.getDate() - 7)
        } else if (period === "month") {
          startDate.setMonth(now.getMonth() - 1)
        }

        const data = await getExpenses(store.id!, {
          startDate,
          endDate: now,
          excludeVoid: true,
        })
        setExpenses(data)
      } catch (error) {
        console.error("Error loading expenses:", error)
      }
    }

    loadExpenses()
  }, [period, store.id])

  // Calculate today's data
  const todayData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayMovements = movements.filter(m => {
      const mDate = m.createdAt instanceof Date ? m.createdAt : m.createdAt.toDate()
      mDate.setHours(0, 0, 0, 0)
      return mDate.getTime() === today.getTime()
    })

    const todayExpenses = todayMovements
      .filter(m => m.type === "expense")
      .reduce((sum, m) => sum + m.amount, 0)

    const todaySales = paidOrders
      .filter(o => {
        const oDate = o.createdAt instanceof Date ? o.createdAt : o.createdAt.toDate()
        oDate.setHours(0, 0, 0, 0)
        return oDate.getTime() === today.getTime()
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    return { todayExpenses, todaySales }
  }, [movements, paidOrders])

  // Calculate totals by category
  const byCategory = expenses.reduce<Record<ExpenseCategory, number>>(
    (acc, exp) => {
      const key = exp.category
      acc[key] = (acc[key] || 0) + exp.amount
      return acc
    },
    {} as Record<ExpenseCategory, number>
  )

  const categoryLabels: Record<ExpenseCategory, string> = {
    supplies: "Compras/Insumos",
    providers: "Proveedores",
    delivery: "Entregas",
    maintenance: "Mantenimiento",
    cleaning: "Limpieza",
    services: "Servicios",
    utilities: "Servicios Básicos",
    salaries: "Sueldos",
    transportation: "Movilidad",
    emergency: "Emergencias",
    other: "Otros",
  }

  const totalExpenses = Object.values(byCategory).reduce((sum: number, val: number) => sum + val, 0)

  // Get operational balance from movements
  const operationalBalance = useMemo(() => {
    let balance = cashRegister?.initialAmount || 0
    
    movements.forEach(m => {
      if (m.source === "cash_register") {
        if (m.type === "expense") {
          balance -= m.amount
        } else if (m.type === "opening") {
          balance = m.amount
        } else if (m.type === "deposit" || m.type === "cash_distribution") {
          balance -= m.amount
        }
      }
    })
    
    return Math.max(0, balance)
  }, [movements, cashRegister?.initialAmount])

  // Get safe box balance
  const safeBoxBalance = useMemo(() => {
    let balance = 0
    
    movements.forEach(m => {
      if (m.source === "safe_box" && m.type === "expense") {
        balance -= m.amount
      } else if (m.type === "deposit" || m.type === "cash_distribution") {
        balance += m.amount
      }
    })
    
    return Math.max(0, balance)
  }, [movements])

  const branchFinancials: BranchFinancials = {
    storeId: storeId || "",
    storeName: store?.name || "Sucursal",
    operationalBalance,
    safeBoxBalance,
    todaySales: todayData.todaySales,
    todayExpenses: todayData.todayExpenses,
    cashRegisterStatus: cashRegister?.status === "open" ? "open" : "closed",
    lastOpenedAt: cashRegister?.openedAt instanceof Date ? cashRegister.openedAt : undefined,
    lastClosedAt: undefined, // Will need to get from closure records
  }

  const netToday = branchFinancials.todaySales - branchFinancials.todayExpenses

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        <Button
          variant={period === "today" ? "default" : "outline"}
          onClick={() => setPeriod("today")}
          className="shrink-0"
        >
          Hoy
        </Button>
        <Button
          variant={period === "week" ? "default" : "outline"}
          onClick={() => setPeriod("week")}
          className="shrink-0"
        >
          Última Semana
        </Button>
        <Button
          variant={period === "month" ? "default" : "outline"}
          onClick={() => setPeriod("month")}
          className="shrink-0"
        >
          Último Mes
        </Button>
      </div>

      {/* Branch Financial Summary Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {branchFinancials.storeName}
            </div>
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              branchFinancials.cashRegisterStatus === "open"
                ? "bg-green-500/10 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                : "bg-gray-500/10 dark:bg-gray-950/30 text-gray-700 dark:text-gray-400"
            }`}>
              {branchFinancials.cashRegisterStatus === "open" ? "ABIERTA" : "CERRADA"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Balances */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Caja Operativa</p>
              <p className="text-xl font-bold text-foreground">S/ {branchFinancials.operationalBalance.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Caja Fuerte</p>
              <p className="text-xl font-bold text-foreground">S/ {branchFinancials.safeBoxBalance.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Total Caja</p>
              <p className="text-xl font-bold text-foreground">S/ {(branchFinancials.operationalBalance + branchFinancials.safeBoxBalance).toFixed(2)}</p>
            </div>
          </div>

          {/* Today's Performance */}
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Resumen de Hoy
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-green-500/5 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <p className="text-xs text-muted-foreground mb-1">Ventas</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">S/ {branchFinancials.todaySales.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <p className="text-xs text-muted-foreground mb-1">Gastos</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">S/ {branchFinancials.todayExpenses.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/5 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-muted-foreground mb-1">Neto</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">S/ {netToday.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Last Activity */}
          {branchFinancials.lastOpenedAt && (
            <div className="border-t border-border pt-4 text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>
                Abierta: {toPeruDate(branchFinancials.lastOpenedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses Report */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reporte de Gastos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total de Gastos</p>
                <p className="text-3xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Gastos por Categoría</h3>
                {Object.entries(byCategory).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin gastos en este período</p>
                ) : (
                  Object.entries(byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center p-2 border-b border-border/50">
                        <span className="text-sm">{categoryLabels[category as ExpenseCategory]}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-muted rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{
                                width: `${(amount / totalExpenses) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-right font-semibold min-w-24 text-sm">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Total de transacciones: {expenses.length}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
