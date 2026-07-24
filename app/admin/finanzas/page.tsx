"use client"

import { useState, useMemo, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  ArrowUpLeft,
  ArrowDownRight,
  AlertCircle,
  Calendar,
  Clock,
  User,
  X,
  Banknote,
  Vault,
  TrendingUp,
} from "lucide-react"
import { cn, toPeruDate } from "@/lib/utils"
import { subscribeToFinancialMovements, subscribeToSafeBox } from "@/lib/firebase/firestore"

type PeriodFilter = "today" | "week" | "month" | "all"
type MovementTypeFilter = "all" | "entrada" | "salida" | "expense" | "deposit"
type OriginFilter = "all" | "caja_operativa" | "caja_fuerte" | "cash_register" | "safe_box"

export interface FinancialMovementDisplay {
  id: string
  type?: string
  movementType?: string
  category?: string
  amount: number
  description: string
  origin?: string
  userId: string
  userName: string
  timestamp?: Date | { toDate: () => Date } | string
  createdAt?: Date | { toDate: () => Date } | string
  source?: string
}

export default function FinanzasPage() {
  const { currentStoreId, isLoading: authLoading } = useAuth()
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("today")
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>("all")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all")
  const [userFilter, setUserFilter] = useState("all_users")
  const [searchQuery, setSearchQuery] = useState("")
  const [movements, setMovements] = useState<FinancialMovementDisplay[]>([])
  const [movementsLoading, setMovementsLoading] = useState(true)
  const [safeBox, setSafeBox] = useState<any>(null)

  // Subscribe to movements
  useEffect(() => {
    if (!currentStoreId) {
      setMovements([])
      setMovementsLoading(false)
      return
    }

    setMovementsLoading(true)
    const unsubscribe = subscribeToFinancialMovements(currentStoreId, (data) => {
      setMovements(data)
      setMovementsLoading(false)
    }, 500) // Load many more movements for complete history

    return () => {
      unsubscribe()
    }
  }, [currentStoreId])

  // Subscribe to safeBox
  useEffect(() => {
    if (!currentStoreId) {
      setSafeBox(null)
      return
    }

    const unsubscribe = subscribeToSafeBox(currentStoreId, setSafeBox)

    return () => {
      unsubscribe()
    }
  }, [currentStoreId])

  // Calculate cash balance summary
  const cashSummary = useMemo(() => {
    let cashBalance = 0
    let safeBoxBalance = safeBox?.currentBalance || 0
    let todayMovements: FinancialMovementDisplay[] = []

    // Get today's movements
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    movements.forEach(m => {
      const timestamp = m.timestamp || m.createdAt
      const movDate = timestamp instanceof Date ? timestamp : typeof timestamp === "string" ? new Date(timestamp) : timestamp?.toDate?.() || new Date()
      movDate.setHours(0, 0, 0, 0)

      if (movDate.getTime() === today.getTime()) {
        todayMovements.push(m)
      }

      // Calculate cash register balance (entrada positive, salida negative)
      const origin = m.origin || m.source || "unknown"
      if (origin === "caja_operativa" || origin === "cash_register") {
        const type = m.type || "cash_movement"
        const movementType = m.movementType
        if (movementType === "entrada" || type === "deposit" || type === "opening") {
          cashBalance += m.amount
        } else if (movementType === "salida" || type === "expense" || type === "withdrawal") {
          cashBalance -= m.amount
        }
      }
    })

    return {
      cashBalance: Math.max(0, cashBalance),
      safeBoxBalance,
      totalBalance: Math.max(0, cashBalance) + safeBoxBalance,
      todayMovements: todayMovements.slice(0, 5), // Last 5 movements
    }
  }, [movements, safeBox])

  // Helper functions to normalize data
  const getNormalizedType = (movement: FinancialMovementDisplay): string => {
    if (movement.type === "cash_movement" && movement.movementType) {
      return movement.movementType
    }
    return movement.type || "unknown"
  }

  const getNormalizedOrigin = (movement: FinancialMovementDisplay): string => {
    return movement.origin || movement.source || "unknown"
  }

  // Filter movements
  const filteredMovements = useMemo(() => {
    let filtered = movements

    // Period filter
    if (periodFilter !== "all") {
      const now = new Date()
      const startDate = new Date()

      if (periodFilter === "today") {
        startDate.setHours(0, 0, 0, 0)
      } else if (periodFilter === "week") {
        startDate.setDate(now.getDate() - 7)
      } else if (periodFilter === "month") {
        startDate.setMonth(now.getMonth() - 1)
      }

      filtered = filtered.filter(m => {
        const timestamp = m.timestamp || m.createdAt
        const movDate = timestamp instanceof Date ? timestamp : typeof timestamp === "string" ? new Date(timestamp) : timestamp?.toDate?.() || new Date()
        return movDate >= startDate
      })
    }

    // Type filter - handle both old (deposit/expense) and new (entrada/salida) formats
    if (typeFilter !== "all") {
      filtered = filtered.filter(m => {
        const type = getNormalizedType(m)
        if (typeFilter === "entrada") return type === "entrada"
        if (typeFilter === "salida") return type === "salida"
        if (typeFilter === "expense") return m.type === "expense"
        if (typeFilter === "deposit") return m.type === "deposit"
        return true
      })
    }

    // Origin filter - handle both old (source) and new (origin) formats
    if (originFilter !== "all") {
      filtered = filtered.filter(m => {
        const origin = getNormalizedOrigin(m)
        return origin === originFilter
      })
    }

    // User filter
    if (userFilter !== "all_users") {
      filtered = filtered.filter(m => m.userName === userFilter)
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m =>
        m.description?.toLowerCase().includes(query) ||
        m.userName?.toLowerCase().includes(query) ||
        m.category?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [movements, periodFilter, typeFilter, originFilter, userFilter, searchQuery])

  // Calculate summary
  const summary = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    let incomeCount = 0
    let expenseCount = 0

    filteredMovements.forEach(m => {
      const type = getNormalizedType(m)
      if (type === "entrada" || m.type === "deposit" || m.type === "opening" || m.type === "cash_distribution") {
        totalIncome += m.amount
        incomeCount++
      } else if (type === "salida" || m.type === "expense") {
        totalExpenses += m.amount
        expenseCount++
      }
    })

    return { totalIncome, totalExpenses, incomeCount, expenseCount, depositCount: incomeCount }
  }, [filteredMovements])

  const handleReset = () => {
    setPeriodFilter("today")
    setTypeFilter("all")
    setOriginFilter("all")
    setUserFilter("all_users")
    setSearchQuery("")
  }

  const uniqueUsers = useMemo(() => Array.from(new Set(movements.map((movement) => movement.userName).filter(Boolean))).sort(), [movements])

  const hasActiveFilters =
    periodFilter !== "today" ||
    typeFilter !== "all" ||
    originFilter !== "all" ||
    userFilter !== "all_users" ||
    searchQuery

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-12 w-12" />
      </div>
    )
  }

  const formatDateTime = (date: any) => {
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date)
    const peruDate = toPeruDate(d)
    const time = peruDate.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    })
    const dateStr = peruDate.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    return { date: dateStr, time }
  }

  const getMovementTypeLabel = (movement: FinancialMovementDisplay): string => {
    const type = movement.type || "cash_movement"
    const movementType = movement.movementType
    const category = movement.category
    
    // For cash movements, use category as label
    if (type === "cash_movement" && category) {
      const categoryLabels: Record<string, string> = {
        "dinero_dueno": "Dinero Dueño",
        "fondo_sencillo": "Fondo Sencillo",
        "reposicion": "Reposición",
        "propina_tienda": "Propina Tienda",
        "propina_mozo": "Propina Mozo",
        "pago_proveedor": "Pago Proveedor",
        "retiro_dueno": "Retiro Dueño",
        "ajuste_arqueo": "Ajuste Arqueo",
        "otro": "Otro"
      }
      return categoryLabels[category] || category
    }
    
    const labels: Record<string, string> = {
      "entrada": "Entrada",
      "salida": "Salida",
      "deposit": "Depósito",
      "withdrawal": "Retiro",
      "expense": "Gasto",
      "opening": "Apertura",
      "cash_distribution": "Distribución"
    }
    return labels[type] || type
  }

  const getMovementIcon = (movement: FinancialMovementDisplay) => {
    const type = movement.type || "cash_movement"
    const movementType = movement.movementType
    
    if (movementType === "entrada") {
      return <ArrowDownRight className="h-5 w-5" />
    } else if (movementType === "salida") {
      return <ArrowUpLeft className="h-5 w-5" />
    }
    
    switch (type) {
      case "deposit":
      case "opening":
        return <ArrowDownRight className="h-5 w-5" />
      case "withdrawal":
      case "cash_distribution":
        return <ArrowUpLeft className="h-5 w-5" />
      case "expense":
        return <AlertCircle className="h-5 w-5" />
      default:
        return <Calendar className="h-5 w-5" />
    }
  }

  const getMovementTypeColor = (movement: FinancialMovementDisplay) => {
    const type = movement.type || "cash_movement"
    const movementType = movement.movementType
    
    if (movementType === "entrada" || type === "deposit" || type === "opening" || type === "sale") {
      return "bg-green-500/10 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
    } else if (movementType === "salida" || type === "withdrawal" || type === "cash_distribution") {
      return "bg-blue-500/10 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
    } else if (type === "expense") {
      return "bg-red-500/10 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
    }
    return "bg-muted text-muted-foreground border-border"
  }

  const getOriginLabel = (movement: FinancialMovementDisplay): string => {
    const origin = getNormalizedOrigin(movement)
    if (origin === "caja_operativa" || origin === "cash_register") return "Caja Operativa"
    if (origin === "caja_fuerte" || origin === "safe_box") return "Caja Fuerte"
    return origin
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Historial Financiero</h1>
        <p className="text-muted-foreground mt-1">Registro completo de todos los movimientos de caja</p>
      </div>

      {/* Cash Register Summary - NEW SECTION */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Resumen de Caja</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Cash Balance */}
          <Card className="border-green-200 dark:border-green-900 bg-green-500/5 dark:bg-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs sm:text-sm text-muted-foreground">Saldo Efectivo</p>
                <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                S/ {cashSummary.cashBalance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Caja Operativa</p>
            </CardContent>
          </Card>

          {/* Safe Box Balance */}
          <Card className="border-blue-200 dark:border-blue-900 bg-blue-500/5 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs sm:text-sm text-muted-foreground">Saldo Caja Fuerte</p>
                <Vault className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                S/ {cashSummary.safeBoxBalance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Depósitos Seguro</p>
            </CardContent>
          </Card>

          {/* Total Balance */}
          <Card className="border-primary/20 dark:border-primary/30 bg-primary/5 dark:bg-primary/10">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Acumulado</p>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-primary">
                S/ {cashSummary.totalBalance.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Efectivo + Caja Fuerte</p>
            </CardContent>
          </Card>

          {/* Discrepancy Alert */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs sm:text-sm text-muted-foreground">Estado</p>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              {safeBox?.discrepancy ? (
                <p className="text-lg font-bold text-destructive">
                  ⚠️ Discrepancia
                </p>
              ) : (
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  ✓ Conciliado
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Verificación</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Movements */}
        {cashSummary.todayMovements.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Movimientos del Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cashSummary.todayMovements.map((movement, idx) => {
                  const type = movement.type || "cash_movement"
                  const movementType = movement.movementType
                  const isIncome = movementType === "entrada" || type === "deposit"
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isIncome ? (
                          <ArrowDownRight className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <ArrowUpLeft className="h-4 w-4 text-red-600 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate text-xs">{movement.description}</p>
                          <p className="text-xs text-muted-foreground">{movement.userName}</p>
                        </div>
                      </div>
                      <p className={`font-semibold flex-shrink-0 ml-2 ${isIncome ? "text-green-600" : "text-red-600"}`}>
                        {isIncome ? "+" : "-"}S/ {movement.amount.toFixed(2)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Cards */}
      {filteredMovements.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-green-500/5 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardContent className="p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Ingresos</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">S/ {summary.totalIncome.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.depositCount} movimientos</p>
            </CardContent>
          </Card>

          <Card className="bg-red-500/5 dark:bg-red-950/20 border-red-200 dark:border-red-900">
            <CardContent className="p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Egresos</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">S/ {summary.totalExpenses.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.expenseCount} movimientos</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/5 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardContent className="p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Neto</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                S/ {(summary.totalIncome - summary.totalExpenses).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Resultado</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Movimientos</p>
              <p className="text-lg sm:text-2xl font-bold">{filteredMovements.length}</p>
              <p className="text-xs text-muted-foreground mt-1">registrados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filtros</CardTitle>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Período
              </label>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mes</SelectItem>
                  <SelectItem value="all">Todo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tipo
              </label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as MovementTypeFilter)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="salida">Salida</SelectItem>
                  <SelectItem value="expense">Gasto</SelectItem>
                  <SelectItem value="deposit">Depósito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Origen
              </label>
              <Select value={originFilter} onValueChange={(v) => setOriginFilter(v as OriginFilter)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="caja_operativa">Caja Operativa</SelectItem>
                  <SelectItem value="caja_fuerte">Caja Fuerte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Usuario
              </label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_users">Todos</SelectItem>
                  {uniqueUsers.map(user => (
                    <SelectItem key={user} value={user}>{user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Búsqueda
              </label>
              <Input
                placeholder="Buscar descripción o usuario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">
            Movimientos {filteredMovements.length > 0 && `(${filteredMovements.length})`}
          </h2>
        </div>

        {movementsLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : filteredMovements.length > 0 ? (
          <div className="space-y-3">
            {filteredMovements.map((m) => {
              const { date, time } = formatDateTime(m.timestamp || m.createdAt)
              const movType = getNormalizedType(m)
              return (
                <div key={m.id} className={cn(
                  "p-4 rounded-lg border-l-4 transition-colors",
                  getMovementTypeColor(m)
                )}>
                  {/* Header: Description and Amount */}
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5 flex-shrink-0">
                        {getMovementIcon(m)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {m.description || getMovementTypeLabel(m)}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getMovementTypeLabel(m)} · {getOriginLabel(m)}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "text-right flex-shrink-0",
                      movType === "salida" || m.type === "expense" ? "text-destructive" :
                      movType === "entrada" || m.type === "deposit" || m.type === "opening" || m.type === "cash_distribution" ? "text-green-600" : "text-gray-600"
                    )}>
                      <p className="font-bold text-lg">
                        {(movType === "salida" || m.type === "expense") ? "-" : "+"}S/ {m.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Metadata: Date, Time, User */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      <span>{date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                      <User className="h-3 w-3" />
                      <span className="truncate">{m.userName}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No hay movimientos que coincidan con los filtros
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
