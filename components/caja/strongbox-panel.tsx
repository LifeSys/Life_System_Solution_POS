"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Vault, TrendingUp, History, Lock } from "lucide-react"
import { subscribeToCashBoxBalances, subscribeToRecentMovements } from "@/lib/firebase/firestore"
import type { CashBoxType } from "@/lib/firebase/firestore"
import { Spinner } from "@/components/ui/spinner"

interface StrongboxPanelProps {
  storeId: string
  onOpenWithdrawal?: () => void
  onOpenTransfer?: () => void
}

export function StrongboxPanel({
  storeId,
  onOpenWithdrawal,
  onOpenTransfer,
}: StrongboxPanelProps) {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [movements, setMovements] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isAdmin = user?.role === "admin" || user?.role === "admin_global"

  useEffect(() => {
    if (!storeId) return

    setIsLoading(true)

    // Subscribe to balance
    const unsubBalance = subscribeToCashBoxBalances(storeId, (balances) => {
      setBalance(balances.strongbox)
      setIsLoading(false)
    })

    // Subscribe to movements
    const unsubMovements = subscribeToRecentMovements(storeId, (newMovements) => {
      setMovements(newMovements)
    })

    return () => {
      unsubBalance()
      unsubMovements()
    }
  }, [storeId])

  const totalIncoming = movements
    .filter((m) => m.type === "distribution" || m.type === "transfer_in")
    .reduce((sum, m) => sum + m.amount, 0)

  const totalOutgoing = movements
    .filter((m) => m.type === "withdrawal" || m.type === "transfer_out")
    .reduce((sum, m) => sum + m.amount, 0)

  return (
    <div className="space-y-4">
      {/* Main Balance Card */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-amber-700 uppercase">Caja Fuerte</p>
                <p className="text-4xl font-bold text-amber-900 mt-2">
                  S/ {balance.toFixed(2)}
                </p>
                <p className="text-xs text-amber-700 mt-2">Dinero reservado</p>
              </div>
              <Vault className="h-12 w-12 text-amber-600 opacity-20" />
            </div>

            {/* Action Buttons - Admin only */}
            {isAdmin && (
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-amber-200">
                <Button
                  onClick={onOpenTransfer}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                >
                  Transfer
                </Button>
                <Button
                  onClick={onOpenWithdrawal}
                  variant="destructive"
                  size="sm"
                  className="justify-start"
                >
                  Retirar
                </Button>
              </div>
            )}

            {!isAdmin && (
              <div className="p-3 bg-amber-100 rounded-lg flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-700" />
                <p className="text-xs text-amber-700">Solo administradores pueden hacer movimientos</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">INGRESOS</p>
            <p className="text-2xl font-bold text-green-600">
              S/ {totalIncoming.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">EGRESOS</p>
            <p className="text-2xl font-bold text-red-600">
              S/ {totalOutgoing.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Movimientos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay movimientos registrados
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {movements.slice(0, 20).map((movement) => {
                const isIncoming = movement.type === "distribution" || movement.type === "transfer_in"
                return (
                  <div
                    key={movement.id}
                    className="flex justify-between items-start py-2 border-b border-border/50 last:border-b-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium capitalize">
                        {movement.type === "distribution" && "Distribución de cierre"}
                        {movement.type === "withdrawal" && "Retiro"}
                        {movement.type === "transfer_in" && "Transferencia entrada"}
                        {movement.type === "transfer_out" && "Transferencia salida"}
                      </p>
                      <p className="text-xs text-muted-foreground">{movement.userName}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className={`text-sm font-semibold ${isIncoming ? "text-green-600" : "text-red-600"}`}>
                        {isIncoming ? "+" : "-"}S/ {movement.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {movement.timestamp?.toDate?.()?.toLocaleTimeString("es-PE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-xs text-blue-800">
            <strong>Nota de Seguridad:</strong> Los movimientos de Caja Fuerte están limitados a administradores y son auditados completamente. Todos los cambios quedan registrados con usuario, fecha y hora.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
