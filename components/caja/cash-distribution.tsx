"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { distributeCashOnClosureTransaction, depositToSafeBoxFromClosure } from "@/lib/firebase/firestore"
import { Spinner } from "@/components/ui/spinner"

interface CashDistributionProps {
  totalCash: number
  cajaClosureId: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function CashDistribution({
  totalCash,
  cajaClosureId,
  onSuccess,
  onError,
}: CashDistributionProps) {
  const { currentStoreId, user } = useAuth()
  const [toStrongbox, setToStrongbox] = useState("")
  const [remaining, setRemaining] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [distributionComplete, setDistributionComplete] = useState(false)

  // Auto-calculate remaining when strongbox amount changes
  useEffect(() => {
    const strongboxAmount = parseFloat(toStrongbox) || 0
    if (strongboxAmount > totalCash) {
      setError("La cantidad a caja fuerte no puede exceder el total")
    } else if (strongboxAmount < 0) {
      setError("La cantidad debe ser positiva")
    } else {
      setError("")
      const remainingAmount = totalCash - strongboxAmount
      setRemaining(remainingAmount.toFixed(2))
    }
  }, [toStrongbox, totalCash])

  const handleDistribute = async () => {
    if (!currentStoreId || !user) return

    const strongboxAmount = parseFloat(toStrongbox) || 0

    if (strongboxAmount < 0 || strongboxAmount > totalCash) {
      setError("Montos inválidos")
      return
    }

    if (error) {
      return
    }

    try {
      setIsSubmitting(true)
      setError("")

      await distributeCashOnClosureTransaction(
        currentStoreId,
        cajaClosureId,
        {
          toPrincipal: 0, // We only use strongbox in this implementation (2-box system)
          toStrongbox: strongboxAmount,
          remaining: totalCash - strongboxAmount,
        },
        user.id || "unknown",
        user.name || "Usuario"
      )

      if (strongboxAmount > 0) {
        await depositToSafeBoxFromClosure(
          currentStoreId,
          strongboxAmount,
          cajaClosureId,
          user.id || "unknown",
          user.name || "Usuario",
          "Depósito desde cierre de caja"
        )
      }

      setSuccess(true)
      setDistributionComplete(true)
      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error distribuyendo efectivo"
      setError(message)
      onError?.(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (distributionComplete) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Distribución completada</p>
              <p className="text-sm text-green-700">
                S/ {toStrongbox} a Caja Fuerte | S/ {remaining} en Caja Operativa
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Distribución de Dinero</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total cash summary */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700 font-medium">EFECTIVO TOTAL</p>
          <p className="text-2xl font-bold text-blue-900">S/ {totalCash.toFixed(2)}</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Cantidad a Caja Fuerte
          </label>
          <Input
            type="number"
            min="0"
            max={totalCash}
            step="0.01"
            value={toStrongbox}
            onChange={(e) => setToStrongbox(e.target.value)}
            placeholder="0.00"
            className="text-lg font-semibold"
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Dinero reservado/guardado en caja fuerte
          </p>
        </div>

        {/* Distribution breakdown */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Caja Fuerte</p>
            <p className="text-lg font-bold">S/ {(parseFloat(toStrongbox) || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Caja Operativa</p>
            <p className="text-lg font-bold">S/ {remaining || "0.00"}</p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <Button
          onClick={handleDistribute}
          disabled={isSubmitting || !!error || !toStrongbox}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Procesando...
            </>
          ) : (
            "Confirmar Distribución"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
