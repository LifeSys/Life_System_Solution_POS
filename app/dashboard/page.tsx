"use client"

import { useState, useEffect, useMemo } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/auth-context"
import {
  subscribeToPaidOrdersForReports,
  calculateReportFromOrders,
  getAllStores,
  type Order,
  type Store,
} from "@/lib/firebase/firestore"
import FacturacionService from "@/lib/services/facturacion-service"
import type { ComprobanteRegistro } from "@/lib/models/comprobante"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StoresStatusPanel } from "@/components/dashboard/stores-status"
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  Calendar,
  Receipt,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { toPeruDate } from "@/lib/utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

export default function DashboardPage() {
  const { currentStoreId, isSuperAdmin } = useAuth()
  const { theme } = useTheme()
  const [paidOrders, setPaidOrders] = useState<Order[]>([])
  const [comprobantes, setComprobantes] = useState<ComprobanteRegistro[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<string>("current")
  const [dateRange, setDateRange] = useState<"today" | "week" | "month">("week")
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<"reports" | "stores">("reports")

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load stores for super admin
  useEffect(() => {
    if (isSuperAdmin) {
      getAllStores().then(setStores)
    }
  }, [isSuperAdmin])

  // Subscribe to paid orders (real-time)
  useEffect(() => {
    const storeId = selectedStore === "current" ? currentStoreId : selectedStore
    if (!storeId) return

    setIsLoading(true)

    

    const unsubscribe = subscribeToPaidOrdersForReports(storeId, (orders) => {
      setPaidOrders(orders)
      setIsLoading(false)
    })

    const unsubscribeComprobantes = FacturacionService.subscribir(storeId, setComprobantes)

    return () => {
      unsubscribe()
      unsubscribeComprobantes()
    }
  }, [currentStoreId, selectedStore])

  // Calculate date range boundaries using Peru timezone
  const { startDate, endDate } = useMemo(() => {
    // Get current time in Peru timezone
    const nowPeru = toPeruDate(new Date())
    
    // Create end of today in Peru time
    const today = new Date(nowPeru)
    today.setHours(23, 59, 59, 999)

    // Create start date in Peru time
    const start = new Date(nowPeru)
    switch (dateRange) {
      case "today":
        start.setHours(0, 0, 0, 0)
        break
      case "week":
        start.setDate(start.getDate() - 7)
        start.setHours(0, 0, 0, 0)
        break
      case "month":
        start.setMonth(start.getMonth() - 1)
        start.setHours(0, 0, 0, 0)
        break
    }

    return { startDate: start, endDate: today }
  }, [dateRange])

  // Calculate report data from paid orders
  const reportData = useMemo(() => {
    return calculateReportFromOrders(paidOrders, startDate, endDate)
  }, [paidOrders, startDate, endDate])

  // Calculate top products from filtered orders
  const topProducts = useMemo(() => {
    const productCounts: Record<string, number> = {}

    // Filter orders by date range using Peru timezone
    const filteredOrders = paidOrders.filter((order) => {
      const orderDate = order.updatedAt?.toDate?.() || order.createdAt?.toDate?.()
      if (!orderDate) return false
      const peruOrderDate = toPeruDate(orderDate)
      return peruOrderDate >= startDate && peruOrderDate <= endDate
    })

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        productCounts[item.productName] =
          (productCounts[item.productName] || 0) + item.quantity
      })
    })

    return Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [paidOrders, startDate, endDate])

  const averageTicket = reportData.ordersCount > 0 
    ? reportData.totalSales / reportData.ordersCount 
    : 0

  // Comprobantes filtrados por el mismo rango de fechas que el resto del dashboard
  const filteredComprobantes = useMemo(() => {
    return comprobantes.filter((c) => {
      const fecha = c.createdAt?.toDate?.()
      if (!fecha) return false
      const peruFecha = toPeruDate(fecha)
      return peruFecha >= startDate && peruFecha <= endDate
    })
  }, [comprobantes, startDate, endDate])

  // Desglose por tipo de comprobante (Nota de Venta / Boleta / Factura)
  const comprobantesPorTipo = useMemo(() => {
    const base = {
      NOTA_VENTA: { cantidad: 0, total: 0 },
      BOLETA: { cantidad: 0, total: 0 },
      FACTURA: { cantidad: 0, total: 0 },
    }
    for (const c of filteredComprobantes) {
      base[c.tipo].cantidad += 1
      base[c.tipo].total += c.total || 0
    }
    return base
  }, [filteredComprobantes])

  // Desglose por estado SUNAT (solo aplica a Boleta/Factura, Nota de Venta es interna)
  const estadoSunat = useMemo(() => {
    const conteo = { aceptado: 0, pendiente: 0, rechazado: 0, anulado: 0 }
    for (const c of filteredComprobantes) {
      if (c.tipo === "NOTA_VENTA") continue
      if (c.sunatStatus === "aceptado") conteo.aceptado += 1
      else if (c.sunatStatus === "rechazado") conteo.rechazado += 1
      else if (c.sunatStatus === "anulado") conteo.anulado += 1
      else conteo.pendiente += 1 // enviado, pendiente, o sin estado aun
    }
    return conteo
  }, [filteredComprobantes])

  // Ventas cobradas en el rango que NO tienen un comprobante emitido en la API
  // (ej. el pago pasó por Firebase pero la llamada a SUNAT falló)
  const ventasSinComprobante = useMemo(() => {
    const idsConComprobante = new Set(filteredComprobantes.map((c) => c.orderId))
    return paidOrders.filter((order) => {
      const orderDate = order.updatedAt?.toDate?.() || order.createdAt?.toDate?.()
      if (!orderDate) return false
      const peruOrderDate = toPeruDate(orderDate)
      if (peruOrderDate < startDate || peruOrderDate > endDate) return false
      return order.id && !idsConComprobante.has(order.id)
    })
  }, [paidOrders, filteredComprobantes, startDate, endDate])

  // Sales chart data (by day) - uses Peru timezone for display
  const salesChartData = useMemo(() => {
    const data: { date: string; ventas: number; pedidos: number }[] = []
    
    // Sort days chronologically
    const sortedDays = Array.from(reportData.ordersByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))

    for (const [dayKey, orders] of sortedDays) {
      const daySales = calculateReportFromOrders(orders, new Date(0), new Date())
      // Parse the dayKey (YYYY-MM-DD) and format for display
      const [year, month, day] = dayKey.split('-').map(Number)
      const displayDate = new Date(year, month - 1, day)
      data.push({
        date: displayDate.toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "short",
        }),
        ventas: daySales.totalSales,
        pedidos: orders.length,
      })
    }

    return data
  }, [reportData.ordersByDay])

  // Payment methods chart data (with Yape)
  const paymentChartData = [
    { name: "Efectivo", value: reportData.cashSales, color: "#ef4444" }, // Red
    { name: "Tarjeta", value: reportData.cardSales, color: "#facc15" }, // Yellow
    { name: "Yape", value: reportData.yapeSales, color: "#22c55e" }, // Green
  ].filter((item) => item.value > 0)

  // Theme-aware chart colors
  const chartGridColor = mounted && theme === "dark" ? "#333" : "#e5e7eb"
  const chartAxisColor = mounted && theme === "dark" ? "#ccc" : "#333"
  const chartTooltipBg = mounted && theme === "dark" ? "#111" : "#fff"
  const chartTooltipBorder = mounted && theme === "dark" ? "#333" : "#e5e7eb"
  const chartTooltipText = mounted && theme === "dark" ? "#fff" : "#000"

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Cargando reportes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs for view mode */}
      {isSuperAdmin && (
        <div className="flex gap-2 border-b border-border">
          <Button
            variant={viewMode === "reports" ? "default" : "ghost"}
            size="sm"
            className="rounded-none border-b-2 border-transparent"
            onClick={() => setViewMode("reports")}
          >
            Reportes
          </Button>
          <Button
            variant={viewMode === "stores" ? "default" : "ghost"}
            size="sm"
            className="rounded-none border-b-2 border-transparent"
            onClick={() => setViewMode("stores")}
          >
            Estado de Tiendas
          </Button>
        </div>
      )}

      {/* Stores Status View */}
      {isSuperAdmin && viewMode === "stores" && <StoresStatusPanel />}

      {/* Reports View */}
      {viewMode === "reports" && (
        <>
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
        {isSuperAdmin && (
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Seleccionar local" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Local actual</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id!}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-2">
          <Button
            variant={dateRange === "today" ? "default" : "outline"}
            size="sm"
            className="flex-1 sm:flex-none h-10 sm:h-9"
            onClick={() => setDateRange("today")}
          >
            Hoy
          </Button>
          <Button
            variant={dateRange === "week" ? "default" : "outline"}
            size="sm"
            className="flex-1 sm:flex-none h-10 sm:h-9"
            onClick={() => setDateRange("week")}
          >
            Semana
          </Button>
          <Button
            variant={dateRange === "month" ? "default" : "outline"}
            size="sm"
            className="flex-1 sm:flex-none h-10 sm:h-9"
            onClick={() => setDateRange("month")}
          >
            Mes
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Ventas Totales</p>
                <p className="text-lg sm:text-2xl font-bold text-primary truncate">
                  S/ {reportData.totalSales.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Pedidos</p>
                <p className="text-lg sm:text-2xl font-bold">{reportData.ordersCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Ticket Promedio</p>
                <p className="text-lg sm:text-2xl font-bold truncate">S/ {averageTicket.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Días con Ventas</p>
                <p className="text-lg sm:text-2xl font-bold">{reportData.ordersByDay.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comprobantes por tipo */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Comprobantes emitidos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Notas de Venta</p>
                  <p className="text-lg sm:text-xl font-bold">S/ {comprobantesPorTipo.NOTA_VENTA.total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{comprobantesPorTipo.NOTA_VENTA.cantidad} emitidas</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Boletas</p>
                  <p className="text-lg sm:text-xl font-bold">S/ {comprobantesPorTipo.BOLETA.total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{comprobantesPorTipo.BOLETA.cantidad} emitidas</p>
                </div>
                <Receipt className="h-8 w-8 text-blue-500/40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Facturas</p>
                  <p className="text-lg sm:text-xl font-bold">S/ {comprobantesPorTipo.FACTURA.total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{comprobantesPorTipo.FACTURA.cantidad} emitidas</p>
                </div>
                <Receipt className="h-8 w-8 text-primary/40" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estado ante SUNAT (solo Boleta + Factura) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
          <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Aceptados</p>
              <p className="font-semibold text-sm">{estadoSunat.aceptado}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pendientes</p>
              <p className="font-semibold text-sm">{estadoSunat.pendiente}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Rechazados</p>
              <p className="font-semibold text-sm">{estadoSunat.rechazado}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/30 border border-border">
            <Receipt className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Anulados</p>
              <p className="font-semibold text-sm">{estadoSunat.anulado}</p>
            </div>
          </div>
        </div>

        {/* Alerta: ventas cobradas sin comprobante emitido en la API */}
        {ventasSinComprobante.length > 0 && (
          <div className="flex items-center justify-between gap-3 mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {ventasSinComprobante.length} venta{ventasSinComprobante.length > 1 ? "s" : ""} cobrada
                {ventasSinComprobante.length > 1 ? "s" : ""} sin comprobante emitido en la API (revisa Comprobantes)
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/comprobantes">Revisar</a>
            </Button>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {salesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis
                      dataKey="date"
                      stroke={chartAxisColor}
                      tick={{ fill: chartAxisColor }}
                      fontSize={12}
                    />
                    <YAxis 
                      stroke={chartAxisColor} 
                      tick={{ fill: chartAxisColor }}
                      fontSize={12} 
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTooltipBg,
                        border: `1px solid ${chartTooltipBorder}`,
                        borderRadius: "8px",
                        color: chartTooltipText,
                      }}
                      itemStyle={{ color: chartTooltipText }}
                      labelStyle={{ color: chartTooltipText }}
                      formatter={(value: number) => [`S/ ${value.toFixed(2)}`, "Ventas"]}
                    />
                    <Bar
                      dataKey="ventas"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No hay datos disponibles</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métodos de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {paymentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: chartAxisColor }}
                    >
                      {paymentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTooltipBg,
                        border: `1px solid ${chartTooltipBorder}`,
                        borderRadius: "8px",
                        color: chartTooltipText,
                      }}
                      itemStyle={{ color: chartTooltipText }}
                      labelStyle={{ color: chartTooltipText }}
                      formatter={(value: number) => [`S/ ${value.toFixed(2)}`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No hay datos disponibles</p>
                </div>
              )}
            </div>
            
            {/* Payment summary with Yape */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-4">
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/30">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="font-semibold text-sm sm:text-base truncate">S/ {reportData.cashSales.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/30">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Tarjeta</p>
                  <p className="font-semibold text-sm sm:text-base truncate">S/ {reportData.cardSales.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/30">
                <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Yape</p>
                  <p className="font-semibold text-sm sm:text-base truncate">S/ {reportData.yapeSales.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos Más Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="flex items-center gap-4"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {product.count} vendidos
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${(product.count / topProducts[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No hay datos de productos disponibles
            </p>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}
