"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Vault, TrendingUp } from "lucide-react"
import { subscribeToCashBoxBalances } from "@/lib/firebase/firestore"
import type { CashBoxType } from "@/lib/firebase/firestore"

interface CashBoxBalancesProps {
  storeId: string
  showStrongbox?: boolean
}

export function CashBoxBalances({ storeId, showStrongbox = true }: CashBoxBalancesProps) {
  const [balances, setBalances] = useState<Record<CashBoxType, number>>({
    operational: 0,
    principal: 0,
    strongbox: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!storeId) return

    setIsLoading(true)
    const unsubscribe = subscribeToCashBoxBalances(storeId, (newBalances) => {
      setBalances(newBalances)
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [storeId])

  const boxConfigs = [
    {
      type: "operational" as CashBoxType,
      label: "Caja Operativa",
      icon: Wallet,
      color: "bg-blue-50 border-blue-200",
      iconColor: "text-blue-600",
    },
    {
      type: "strongbox" as CashBoxType,
      label: "Caja Fuerte",
      icon: Vault,
      color: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-600",
    },
  ]

  const totalCash = balances.operational + balances.strongbox

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {boxConfigs.map(({ type, label, icon: Icon, color, iconColor }) => (
          <Card key={type} className={`border ${color}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-3xl font-bold">
                    S/ {balances[type].toFixed(2)}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${iconColor} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total summary */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">TOTAL EN EFECTIVO</p>
              <p className="text-3xl font-bold text-purple-900">
                S/ {totalCash.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600 opacity-60" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
