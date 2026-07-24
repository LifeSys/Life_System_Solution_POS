"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  DollarSign, 
  Banknote, 
  CreditCard, 
  Smartphone, 
  TrendingUp,
  Lock,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface SalesBreakdown {
  cashSales: number
  cardSales: number
  yapeSales: number
  totalSales: number
  ordersCount: number
  expectedCash: number
}

export interface FinancialDashboardProps {
  cashRegisterOpen: boolean
  initialAmount: number
  currentCash: number
  totalSales: number
  safeBoxBalance: number
  expectedCash: number
  cashDifference: number
  expenses: number
  ordersCount: number
  salesBreakdown: SalesBreakdown
}

export function FinancialDashboard({
  cashRegisterOpen,
  initialAmount,
  currentCash,
  totalSales,
  safeBoxBalance,
  expectedCash,
  cashDifference,
  expenses,
  ordersCount,
  salesBreakdown,
}: FinancialDashboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Daily Sales */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Ventas del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            S/ {totalSales.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {ordersCount} {ordersCount === 1 ? "pedido" : "pedidos"}
          </p>
        </CardContent>
      </Card>

      {/* Current Cash in Register */}
      <Card className={cn(
        "border-border bg-card",
        cashRegisterOpen && cashDifference >= 0 ? "border-green-500/30" : ""
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Banknote className="h-4 w-4" />
            Efectivo Esperado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            S/ {expectedCash.toFixed(2)}
          </div>
          <div className={cn(
            "text-xs mt-1 flex items-center gap-1",
            cashDifference === 0 ? "text-green-600" :
            cashDifference > 0 ? "text-blue-600" : "text-destructive"
          )}>
            {cashDifference === 0 ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Cuadra
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                {cashDifference > 0 ? "+" : ""}{cashDifference.toFixed(2)}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Safe Box Balance */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Lock className="h-4 w-4" />
            Caja Fuerte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            S/ {safeBoxBalance.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Saldo total
          </p>
        </CardContent>
      </Card>

      {/* Register Status */}
      <Card className={cn(
        "border-border bg-card",
        cashRegisterOpen ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            Estado Caja
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-lg font-bold",
            cashRegisterOpen ? "text-green-600" : "text-destructive"
          )}>
            {cashRegisterOpen ? "Abierta" : "Cerrada"}
          </div>
          {cashRegisterOpen && (
            <p className="text-xs text-muted-foreground mt-1">
              Inicial: S/ {initialAmount.toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Breakdown */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Banknote className="h-4 w-4" />
            Efectivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            S/ {salesBreakdown.cashSales.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Por pagar
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <CreditCard className="h-4 w-4" />
            Tarjeta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            S/ {salesBreakdown.cardSales.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Por pagar
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Smartphone className="h-4 w-4" />
            Yape
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            S/ {salesBreakdown.yapeSales.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Por pagar
          </p>
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Gastos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            S/ {expenses.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Hoy
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
