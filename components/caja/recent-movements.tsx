"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ArrowDownRight, 
  ArrowUpLeft, 
  AlertCircle,
  Clock,
  User,
  ChevronRight
} from "lucide-react"
import { cn, toPeruDate } from "@/lib/utils"
import Link from "next/link"

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

export interface RecentMovementsProps {
  movements: FinancialMovementDisplay[]
}

export function RecentMovements({ movements }: RecentMovementsProps) {
  const getMovementIcon = (movement: FinancialMovementDisplay) => {
    const type = movement.type || "cash_movement"
    const movementType = movement.movementType
    
    if (movementType === "entrada") {
      return <ArrowDownRight className="h-4 w-4" />
    } else if (movementType === "salida") {
      return <ArrowUpLeft className="h-4 w-4" />
    }
    
    switch (type) {
      case "sale":
      case "deposit":
      case "opening":
        return <ArrowDownRight className="h-4 w-4" />
      case "expense":
      case "withdrawal":
      case "cash_distribution":
        return <ArrowUpLeft className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getMovementTypeColor = (movement: FinancialMovementDisplay) => {
    const type = movement.type || "cash_movement"
    const movementType = movement.movementType
    
    if (movementType === "entrada") {
      return "text-green-600"
    } else if (movementType === "salida") {
      return "text-blue-600"
    }
    
    switch (type) {
      case "sale":
      case "deposit":
      case "opening":
        return "text-green-600"
      case "expense":
        return "text-destructive"
      case "withdrawal":
      case "cash_distribution":
        return "text-blue-600"
      default:
        return "text-gray-600"
    }
  }

  const getMovementTypeLabel = (movement: FinancialMovementDisplay) => {
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
      "sale": "Venta",
      "expense": "Gasto",
      "provider_payment": "Pago Proveedor",
      "cash_transfer": "Transferencia",
      "cash_distribution": "Distribución",
      "adjustment": "Ajuste",
      "deposit": "Depósito",
      "withdrawal": "Retiro",
      "opening": "Apertura",
      "cash_movement": movementType === "entrada" ? "Entrada" : "Salida"
    }
    return labels[type] || type
  }

  const getSourceLabel = (movement: FinancialMovementDisplay) => {
    const origin = movement.origin
    const source = movement.source
    
    if (origin === "caja_operativa" || source === "cash_register") return "Operativa"
    if (origin === "caja_fuerte" || source === "safe_box") return "Fuerte"
    return origin || source || "Desconocido"
  }

  const formatTime = (date: any) => {
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date)
    const peruDate = toPeruDate(d)
    return peruDate.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Sin movimientos
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {movements.slice(0, 5).map((m) => (
        <div key={m.id} className="space-y-1 pb-3 border-b border-border/40 last:border-0 last:pb-0">
          {/* Description and Amount */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn("mt-0.5 flex-shrink-0", getMovementTypeColor(m))}>
                {getMovementIcon(m)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {m.description || getMovementTypeLabel(m)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getMovementTypeLabel(m)} · {getSourceLabel(m)}
                </p>
              </div>
            </div>
            <p className={cn(
              "font-bold text-sm flex-shrink-0",
              m.movementType === "salida" || m.type === "expense" ? "text-destructive" : "text-green-600"
            )}>
              {m.movementType === "salida" || m.type === "expense" ? "-" : "+"}S/ {m.amount.toFixed(2)}
            </p>
          </div>
          
          {/* Time and User */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground ml-6">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatTime(m.timestamp)}</span>
            </div>
            <div className="flex items-center gap-1 truncate">
              <User className="h-3 w-3" />
              <span className="truncate">{m.userName}</span>
            </div>
          </div>
        </div>
      ))}
      
      {/* Link to full history */}
      <Link href="/admin/finanzas">
        <Button
          variant="outline"
          className="w-full mt-3 justify-between"
          size="sm"
        >
          <span>Ver historial completo</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  )
}
