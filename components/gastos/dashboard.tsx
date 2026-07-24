"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  subscribeToCashBoxBalance,
  subscribeToRecentExpenses,
  getExpenses,
  type CashBoxType,
  type Expense,
} from "@/lib/firebase/firestore"
import { formatCurrency } from "@/lib/utils"

interface BalanceCard {
  label: string
  boxType: CashBoxType
  balance: number
}

export function GastosDashboard() {
  const { store } = useAuth()
  const [balances, setBalances] = useState<Record<CashBoxType, number>>({
    operational: 0,
    principal: 0,
    strongbox: 0,
  })
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [dailyTotal, setDailyTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  if (!store) return null

  useEffect(() => {
    // Subscribe to cash box balances
    const unsubscribers: Array<() => void> = []

    const boxTypes: CashBoxType[] = ["operational", "principal", "strongbox"]
    boxTypes.forEach((boxType) => {
      const unsub = subscribeToCashBoxBalance(store.id!, boxType, (balance) => {
        setBalances((prev) => ({ ...prev, [boxType]: balance }))
      })
      unsubscribers.push(unsub)
    })

    return () => unsubscribers.forEach((unsub) => unsub())
  }, [store.id])

  // Subscribe to recent expenses
  useEffect(() => {
    const unsub = subscribeToRecentExpenses(store.id!, (expenses) => {
      setRecentExpenses(expenses)

      // Calculate today's total
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayExpenses = expenses.filter(
        (exp) => exp.createdAt.toDate() >= today && !exp.isVoid
      )
      const total = todayExpenses.reduce((sum, exp) => sum + exp.amount, 0)
      setDailyTotal(total)

      setLoading(false)
    })

    return () => unsub()
  }, [store.id])

  const balanceCards: BalanceCard[] = [
    { label: "Caja Operativa", boxType: "operational", balance: balances.operational },
    { label: "Caja Principal", boxType: "principal", balance: balances.principal },
    { label: "Caja Fuerte", boxType: "strongbox", balance: balances.strongbox },
  ]

  const totalCash = Object.values(balances).reduce((sum, bal) => sum + bal, 0)

  return (
    <div className="space-y-6">
      {/* Cash Box Balances */}
      <div className="grid gap-4 md:grid-cols-3">
        {balanceCards.map((card) => (
          <Card key={card.boxType} className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(card.balance)}</div>
              <p className="text-xs text-muted-foreground mt-2">Saldo actual</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Cash Summary */}
      <Card className="bg-primary/5 border-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Efectivo Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{formatCurrency(totalCash)}</div>
          <p className="text-xs text-muted-foreground mt-2">
            Suma de todas las cajas
          </p>
        </CardContent>
      </Card>

      {/* Daily Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen del Día</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gastos Registrados:</span>
              <span className="font-semibold text-red-600">{formatCurrency(dailyTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Número de Gastos:</span>
              <span className="font-semibold">{recentExpenses.filter(e => !e.isVoid).length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : recentExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos registrados</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex justify-between items-start py-2 border-b last:border-b-0 text-sm"
                >
                  <div>
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">{expense.userName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{formatCurrency(expense.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {expense.createdAt.toDate().toLocaleTimeString("es-PE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
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
