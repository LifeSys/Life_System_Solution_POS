"use client"

import { useState, useEffect, useMemo } from "react"
import {
  getAllStores,
  getOpenCashRegister,
  subscribeToClosedCashRegisters,
  subscribeToSafeBox,
  subscribeToPaidOrdersForReports,
  calculateReportFromOrders,
  type Store,
  type CashRegister,
  type SafeBox,
  type Order,
} from "@/lib/firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertCircle,
  CheckCircle2,
  Banknote,
  Vault,
  Clock,
  User,
  TrendingUp,
} from "lucide-react"
import { toPeruDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface StoreStatus {
  store: Store
  openCash: CashRegister | null
  safeBoxBalance: number
  lastClosureDate: Date | null
  lastClosureUser: string | null
  lastClosureDifference: number | null
  todaySalesTotal: number
}

export function StoresStatusPanel() {
  const [stores, setStores] = useState<Store[]>([])
  const [storesStatus, setStoresStatus] = useState<Map<string, StoreStatus>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [closedRegisters, setClosedRegisters] = useState<CashRegister[]>([])

  // Load all stores
  useEffect(() => {
    getAllStores().then(setStores)
  }, [])

  // Subscribe to closed cash registers for all stores
  useEffect(() => {
    const unsubscribe = subscribeToClosedCashRegisters((registers) => {
      // Validate that registers is an array and filter out any invalid entries
      if (Array.isArray(registers)) {
        setClosedRegisters(registers.filter(r => r && r.storeId))
      } else {
        setClosedRegisters([])
      }
    })

    return () => unsubscribe()
  }, [])

  // Load data for each store
  useEffect(() => {
    if (!Array.isArray(stores) || stores.length === 0) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const statusMap = new Map<string, StoreStatus>()
    let loadedStoresCount = 0
    const unsubscribers: Array<() => void> = []

    stores.forEach((store) => {
      // Validate store data
      if (!store || !store.id || typeof store.id !== "string") {
        console.warn("[v0] Invalid store data:", store)
        return
      }

      // Get open cash register
      getOpenCashRegister(store.id).then((openCash) => {
        // Get last closure for this store - with proper filtering
        const lastClosure = closedRegisters
          .filter((c) => c && c.storeId === store.id)
          .sort((a, b) => {
            const dateA = a.closedAt ? new Date(a.closedAt as any).getTime() : 0
            const dateB = b.closedAt ? new Date(b.closedAt as any).getTime() : 0
            return dateB - dateA
          })[0] || null

        // Subscribe to safe box with validation
        const unsubscribeSafeBox = subscribeToSafeBox(store.id!, (safeBox) => {
          // Subscribe to today's orders with validation
          const unsubscribeOrders = subscribeToPaidOrdersForReports(
            store.id!,
            (orders) => {
              // Validate orders array
              if (!Array.isArray(orders)) {
                console.warn("[v0] Invalid orders data for store:", store.id)
                return
              }

              // Get today's sales
              const today = toPeruDate(new Date())
              today.setHours(0, 0, 0, 0)
              const tomorrow = new Date(today)
              tomorrow.setDate(tomorrow.getDate() + 1)

              const todayOrders = orders.filter((order) => {
                if (!order) return false
                const orderDate =
                  order.updatedAt?.toDate?.() || order.createdAt?.toDate?.()
                if (!orderDate) return false
                const peruOrderDate = toPeruDate(orderDate)
                return peruOrderDate >= today && peruOrderDate < tomorrow
              })

              const report = calculateReportFromOrders(todayOrders, new Date(0), new Date())

              const status: StoreStatus = {
                store,
                openCash: openCash || null,
                safeBoxBalance: (safeBox && typeof safeBox.currentBalance === "number") ? safeBox.currentBalance : 0,
                lastClosureDate: lastClosure?.closedAt
                  ? lastClosure.closedAt instanceof Date
                    ? lastClosure.closedAt
                    : new Date(lastClosure.closedAt as any)
                  : null,
                lastClosureUser: lastClosure?.closedBy || null,
                lastClosureDifference: (lastClosure && typeof lastClosure.difference === "number") ? lastClosure.difference : null,
                todaySalesTotal: typeof report.totalSales === "number" ? report.totalSales : 0,
              }

              statusMap.set(store.id!, status)
              setStoresStatus(new Map(statusMap))
              loadedStoresCount++

              if (loadedStoresCount === stores.length) {
                setIsLoading(false)
              }
            }
          )

          unsubscribers.push(unsubscribeOrders)
          return unsubscribeOrders
        })

        unsubscribers.push(unsubscribeSafeBox)
        return unsubscribeSafeBox
      }).catch((err) => {
        console.error("[v0] Error loading cash register for store:", store.id, err)
        loadedStoresCount++
        if (loadedStoresCount === stores.length) {
          setIsLoading(false)
        }
      })
    })

    return () => {
      unsubscribers.forEach(unsub => {
        if (typeof unsub === "function") unsub()
      })
    }
  }, [stores, closedRegisters])

  const storeStatusArray = useMemo(
    () => Array.from(storesStatus.values()),
    [storesStatus]
  )

  if (isLoading && storeStatusArray.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Cargando estado de tiendas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">
              Total de Tiendas
            </p>
            <p className="text-2xl sm:text-3xl font-bold">{stores.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">
              Cajas Abiertas
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">
              {storeStatusArray.filter((s) => s.openCash).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">
              Efectivo Total en Caja
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">
              S/ {storeStatusArray.reduce((sum, s) => sum + (s.openCash?.totalCash || 0), 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">
              Saldo Cajas Fuertes
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-amber-600">
              S/ {storeStatusArray.reduce((sum, s) => sum + s.safeBoxBalance, 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {storeStatusArray.map((status) => {
          const isCashOpen = !!status.openCash
          const hasDifference = status.lastClosureDifference && status.lastClosureDifference !== 0

          return (
            <Card
              key={status.store.id}
              className={cn(
                "transition-all border-2",
                isCashOpen
                  ? "border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20"
                  : "border-border"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{status.store.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {isCashOpen ? (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Caja Abierta
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Caja Cerrada
                        </Badge>
                      )}
                      {hasDifference && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Diferencia
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Efectivo en Caja */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Efectivo en Caja</span>
                  </div>
                  <span className="font-semibold">
                    {isCashOpen
                      ? `S/ ${(status.openCash?.totalCash || 0).toFixed(2)}`
                      : "S/ 0.00"}
                  </span>
                </div>

                {/* Caja Fuerte */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    <Vault className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-muted-foreground">Caja Fuerte</span>
                  </div>
                  <span className="font-semibold">
                    S/ {status.safeBoxBalance.toFixed(2)}
                  </span>
                </div>

                {/* Total Disponible */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                  <span className="text-sm font-medium">Total Disponible</span>
                  <span className="font-bold text-primary">
                    S/ {(status.openCash?.totalCash || 0 + status.safeBoxBalance).toFixed(2)}
                  </span>
                </div>

                {/* Ventas del Día */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">Ventas Hoy</span>
                  </div>
                  <span className="font-semibold">
                    S/ {status.todaySalesTotal.toFixed(2)}
                  </span>
                </div>

                {/* Último Cierre */}
                {status.lastClosureDate && (
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="text-xs text-muted-foreground">Último cierre:</div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {status.lastClosureDate.toLocaleDateString("es-PE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}{" "}
                        {status.lastClosureDate.toLocaleTimeString("es-PE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {status.lastClosureUser && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{status.lastClosureUser}</span>
                      </div>
                    )}
                    {status.lastClosureDifference !== null && (
                      <div
                        className={cn(
                          "text-sm font-semibold flex items-center gap-2",
                          status.lastClosureDifference === 0
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        {status.lastClosureDifference === 0 ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        Diferencia: S/ {status.lastClosureDifference.toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {storeStatusArray.length === 0 && (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-muted-foreground">
                No hay datos disponibles de tiendas
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
