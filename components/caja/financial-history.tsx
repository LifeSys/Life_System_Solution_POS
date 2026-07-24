"use client"

import { useState, useMemo } from "react"
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
import { 
  ArrowUpLeft, 
  ArrowDownRight, 
  AlertCircle,
  Calendar,
  Clock,
  User,
  X
} from "lucide-react"
import { cn, toPeruDate } from "@/lib/utils"

export interface FinancialMovementDisplay {
  id: string
  type?: string // "sale" | "expense" | "cash_movement" | etc
  movementType?: string // entrada/salida (for cash movements)
  category?: string
  amount: number
  description: string
  origin?: string // "caja_operativa" | "caja_fuerte"
  userId: string
  userName: string
  timestamp: any // Firestore Timestamp
  source?: string // backward compat: "cash_register" | "safe_box"
}

export interface FinancialHistoryProps {
  movements: FinancialMovementDisplay[]
}

type MovementTypeFilter = "all" | "entrada" | "salida" | "expense" | "deposit"
type OriginFilter = "all" | "caja_operativa" | "caja_fuerte" | "cash_register" | "safe_box"

export function FinancialHistory({ movements }: FinancialHistoryProps) {
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>("all")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all")
  const [userFilter, setUserFilter] = useState("all_users")
  const [dateFilter, setDateFilter] = useState("")

  // Get unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    return Array.from(new Set(movements.map(m => m.userName).filter(Boolean))).sort()
  }, [movements])

  // Normalize origin/source for consistent filtering
  const getNormalizedOrigin = (movement: FinancialMovementDisplay): string => {
    return movement.origin || movement.source || "unknown"
  }

  // Normalize type for consistent filtering
  const getNormalizedType = (movement: FinancialMovementDisplay): string => {
    // For cash_movement, use movementType (entrada/salida)
    if (movement.type === "cash_movement" && movement.movementType) {
      return movement.movementType
    }
    // For other types, use as-is or map to standard types
    return movement.type || "unknown"
  }

  // Filter movements
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // Type filter - handle both old (deposit/expense) and new (entrada/salida) formats
      if (typeFilter !== "all") {
        const movType = getNormalizedType(m)
        if (typeFilter === "entrada" && movType !== "entrada") return false
        if (typeFilter === "salida" && movType !== "salida") return false
        if (typeFilter === "expense" && m.type !== "expense") return false
        if (typeFilter === "deposit" && (m.type !== "deposit" && m.type !== "opening")) return false
      }
      
      // Origin filter - handle both old (source) and new (origin) formats
      if (originFilter !== "all") {
        const movOrigin = getNormalizedOrigin(m)
        if (originFilter !== movOrigin) return false
      }
      
      // User filter
      if (userFilter !== "all_users" && m.userName !== userFilter) return false
      
      // Date filter
      if (dateFilter) {
        const timestamp = m.timestamp || m.createdAt
        const movDate = toPeruDate(
          timestamp instanceof Date ? timestamp : timestamp.toDate?.() || new Date(timestamp)
        )
        const filterDate = new Date(dateFilter)
        movDate.setHours(0, 0, 0, 0)
        filterDate.setHours(0, 0, 0, 0)
        if (movDate.getTime() !== filterDate.getTime()) return false
      }
      
      return true
    })
  }, [movements, typeFilter, originFilter, userFilter, dateFilter])

  // Calculate summary
  const summary = useMemo(() => {
    let entradas = 0
    let salidas = 0
    
    filteredMovements.forEach(m => {
      const movType = getNormalizedType(m)
      if (movType === "entrada" || m.type === "deposit" || m.type === "opening") {
        entradas += m.amount
      } else if (movType === "salida" || m.type === "expense") {
        salidas += m.amount
      }
    })
    
    return { entradas, salidas, neto: entradas - salidas }
  }, [filteredMovements])

  const handleReset = () => {
    setTypeFilter("all")
    setOriginFilter("all")
    setUserFilter("all_users")
    setDateFilter("")
  }

  const hasActiveFilters = typeFilter !== "all" || originFilter !== "all" || userFilter !== "all_users" || dateFilter

  // Format datetime with timezone
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
      "sale": "Venta",
      "expense": "Gasto",
      "provider_payment": "Pago Proveedor",
      "cash_transfer": "Transferencia",
      "cash_distribution": "Distribución",
      "adjustment": "Ajuste",
      "deposit": "Depósito",
      "withdrawal": "Retiro",
      "opening": "Apertura"
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
      case "sale":
      case "deposit":
      case "opening":
        return <ArrowDownRight className="h-5 w-5" />
      case "expense":
      case "withdrawal":
      case "cash_distribution":
        return <ArrowUpLeft className="h-5 w-5" />
      default:
        return <Calendar className="h-5 w-5" />
    }
  }

  const getMovementTypeColor = (movement: FinancialMovementDisplay) => {
    const type = movement.type || "cash_movement"
    const movementType = movement.movementType
    
    if (movementType === "entrada" || type === "deposit" || type === "opening" || type === "sale") {
      return "bg-green-500/10 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
    } else if (movementType === "salida" || type === "withdrawal" || type === "cash_distribution" || type === "expense") {
      if (type === "expense") {
        return "bg-red-500/10 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
      }
      return "bg-blue-500/10 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
    }
    
    return "bg-muted text-muted-foreground border-border"
  }

  const getOriginLabel = (movement: FinancialMovementDisplay): string => {
    const origin = movement.origin || movement.source
    if (origin === "caja_operativa" || origin === "cash_register") return "Operativa"
    if (origin === "caja_fuerte" || origin === "safe_box") return "Fuerte"
    return origin || "Desconocido"
  }

  const getSourceLabel = (source: string) => {
    return source === "cash_register" ? "Caja Operativa" : "Caja Fuerte"
  }

  if (movements.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Historial Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-muted-foreground">
            Sin movimientos financieros
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Historial Financiero
          </CardTitle>
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
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Tipo
            </label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as MovementTypeFilter)}>
              <SelectTrigger className="h-8 text-xs">
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
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="caja_operativa">Caja Operativa</SelectItem>
                <SelectItem value="caja_fuerte">Caja Fuerte</SelectItem>
                <SelectItem value="cash_register">Operativa (viejo)</SelectItem>
                <SelectItem value="safe_box">Fuerte (viejo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Usuario
            </label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-8 text-xs">
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

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Fecha
            </label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Summary */}
        {filteredMovements.length > 0 && (
          <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">Total Entradas</p>
              <p className="text-sm font-bold text-green-600">S/ {summary.entradas.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Salidas</p>
              <p className="text-sm font-bold text-destructive">S/ {summary.salidas.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Neto</p>
              <p className={cn("text-sm font-bold", summary.neto >= 0 ? "text-green-600" : "text-destructive")}>
                S/ {summary.neto.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Movements */}
        {filteredMovements.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredMovements.map((m) => {
              const { date, time } = formatDateTime(m.timestamp || m.createdAt)
              return (
                <div key={m.id} className={cn(
                  "p-3 rounded-lg border border-l-4 transition-colors",
                  getMovementTypeColor(m)
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5 flex-shrink-0">
                        {getMovementIcon(m)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {m.description || getMovementTypeLabel(m)}
                        </p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                          <span>{getMovementTypeLabel(m)}</span>
                          <span>•</span>
                          <span>{getOriginLabel(m)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "font-bold text-sm",
                        getNormalizedType(m) === "entrada" || m.type === "deposit" ? "text-green-600" : "text-destructive"
                      )}>
                        {getNormalizedType(m) === "entrada" || m.type === "deposit" ? "+" : "-"}S/ {m.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-2 ml-7">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{date} {time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{m.userName}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No hay movimientos que coincidan con los filtros
          </div>
        )}
      </CardContent>
    </Card>
  )
}
