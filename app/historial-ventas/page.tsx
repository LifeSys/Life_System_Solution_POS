"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import {
  subscribeToPaidOrdersForReports,
  type Order,
} from "@/lib/firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Download,
  Filter,
  X,
} from "lucide-react"
import { toPeruDate, formatCurrency } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SalesHistoryPage() {
  const { currentStoreId, isAdmin, isSuperAdmin } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all")
  const [searchTable, setSearchTable] = useState("")

  // Check authorization
  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) {
      router.push("/")
    }
  }, [isAdmin, isSuperAdmin, router])

  // Subscribe to paid orders
  useEffect(() => {
    if (!currentStoreId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const unsubscribe = subscribeToPaidOrdersForReports(
      currentStoreId,
      (paidOrders) => {
        setOrders(paidOrders)
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [currentStoreId])

  // Filter orders by date and payment method
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Date filter
      if (startDate || endDate) {
        const orderDate = new Date(order.createdAt.toDate()).toISOString().split("T")[0]
        if (startDate && orderDate < startDate) return false
        if (endDate && orderDate > endDate) return false
      }

      // Payment method filter
      if (paymentMethodFilter && paymentMethodFilter !== "all") {
        if (paymentMethodFilter === "mixed") {
          if (order.paymentMethod !== "mixed") return false
        } else if (order.paymentMethod !== paymentMethodFilter) {
          return false
        }
      }

      // Table search filter
      if (searchTable && !order.tableNumber.toString().includes(searchTable)) {
        return false
      }

      return true
    })
  }, [orders, startDate, endDate, paymentMethodFilter, searchTable])

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = filteredOrders.length
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {}
    filteredOrders.forEach((order) => {
      const method = order.paymentMethod || "Desconocido"
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + order.total
    })

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      paymentBreakdown,
    }
  }, [filteredOrders])

  // Group orders by table for display
  const tableOrders = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        const key = `Mesa ${order.tableNumber}`
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(order)
        return acc
      },
      {} as Record<string, Order[]>
    )
  }, [filteredOrders])

  const handleClearFilters = () => {
    setStartDate("")
    setEndDate("")
    setPaymentMethodFilter("all")
    setSearchTable("")
  }

  const handleExportCSV = () => {
    const headers = [
      "Mesa",
      "Fecha",
      "Hora",
      "Total",
      "Método Pago",
      "Items",
      "Usuario",
    ]
    const rows = filteredOrders.map((order) => [
      order.tableNumber,
      toPeruDate(order.createdAt.toDate()).split(" ")[0],
      toPeruDate(order.createdAt.toDate()).split(" ")[1],
      order.total.toFixed(2),
      order.paymentMethod || "Desconocido",
      order.items.length,
      order.userName || "Sistema",
    ])

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `historial-ventas-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isAdmin && !isSuperAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Historial de Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Ver y analizar todas las órdenes pagadas
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          className="gap-2 w-full sm:w-auto"
          variant="outline"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Ventas Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(metrics.totalSales)}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.totalOrders} órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              Promedio por Orden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(metrics.averageOrderValue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.totalOrders} pedidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
              Tarjeta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(metrics.paymentBreakdown["tarjeta"] || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(metrics.paymentBreakdown).length} método(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-500" />
              Efectivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(metrics.paymentBreakdown["efectivo"] || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Pagos en efectivo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Desde</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hasta</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Método de Pago</label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="mixed">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Mesa</label>
              <Input
                placeholder="Número de mesa"
                value={searchTable}
                onChange={(e) => setSearchTable(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full gap-2"
              >
                <X className="h-4 w-4" />
                Limpiar
              </Button>
            </div>
          </div>
          {(startDate || endDate || paymentMethodFilter !== "all" || searchTable) && (
            <p className="text-xs text-muted-foreground">
              Mostrando {filteredOrders.length} de {orders.length} órdenes
            </p>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Órdenes ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : filteredOrders.length === 0 ? (
            <Alert>
              <AlertDescription>
                No hay órdenes pagadas que coincidan con los filtros.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Fecha y Hora</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        Mesa {order.tableNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {toPeruDate(order.createdAt.toDate())}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.items.length}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            order.paymentMethod === "efectivo"
                              ? "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700"
                              : order.paymentMethod === "tarjeta"
                                ? "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-700"
                                : "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-700"
                          }
                        >
                          {order.paymentMethod === "efectivo" && (
                            <Banknote className="h-3 w-3" />
                          )}
                          {order.paymentMethod === "tarjeta" && (
                            <CreditCard className="h-3 w-3" />
                          )}
                          {order.paymentMethod === "mixed" && (
                            <Smartphone className="h-3 w-3" />
                          )}
                          {order.paymentMethod === "efectivo"
                            ? "Efectivo"
                            : order.paymentMethod === "tarjeta"
                              ? "Tarjeta"
                              : order.paymentMethod === "mixed"
                                ? "Mixto"
                                : "Desconocido"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.userName || "Sistema"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Breakdown */}
      {Object.keys(metrics.paymentBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desglose por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(metrics.paymentBreakdown).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {method === "efectivo" && (
                      <Banknote className="h-4 w-4 text-emerald-500" />
                    )}
                    {method === "tarjeta" && (
                      <CreditCard className="h-4 w-4 text-blue-500" />
                    )}
                    {method === "mixed" && (
                      <Smartphone className="h-4 w-4 text-purple-500" />
                    )}
                    <span className="font-medium capitalize">
                      {method === "efectivo"
                        ? "Efectivo"
                        : method === "tarjeta"
                          ? "Tarjeta"
                          : method === "mixed"
                            ? "Mixto"
                            : method}
                    </span>
                  </div>
                  <span className="font-semibold text-lg">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
