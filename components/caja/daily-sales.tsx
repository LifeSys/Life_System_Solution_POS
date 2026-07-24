"use client"

import { useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Printer,
  Eye,
  Trash2,
  Clock,
  DollarSign,
} from "lucide-react"
import type { Order } from "@/lib/firebase/firestore"
import { collections, recalculateCashRegisterAfterOrderDeletion, getDocument } from "@/lib/firebase/firestore"
import { formatPeruTime, getPeruDayKey, toPeruDate, calculateItemTotal } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase/config"

interface DailySalesProps {
  orders: Order[]
}

export function DailySales({ orders }: DailySalesProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filter orders for today and by status paid
  const todaysSales = useMemo(() => {
    const today = getPeruDayKey(new Date())
    return orders.filter((order) => {
      const orderDate = getPeruDayKey(order.createdAt)
      return (
        orderDate === today &&
        order.paymentStatus === "paid" &&
        !order.deleted
      )
    })
  }, [orders])

  // Calculate totals
  const totalsData = useMemo(() => {
    return {
      total: todaysSales.reduce((sum, order) => sum + order.total, 0),
      count: todaysSales.length,
      average: todaysSales.length > 0 
        ? todaysSales.reduce((sum, order) => sum + order.total, 0) / todaysSales.length
        : 0,
    }
  }, [todaysSales])

  const handlePrint = (order: Order) => {
    // Create a printable version
    const printContent = `
      <html>
        <head>
          <title>Recibo - Mesa ${order.tableNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .items { margin: 20px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { border-top: 2px solid #000; padding-top: 10px; font-weight: bold; font-size: 18px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Recibo de Venta</h2>
            <p>Mesa ${order.tableNumber}</p>
            <p>${formatPeruTime(order.createdAt)}</p>
          </div>
          <div class="items">
            ${order.items.map(item => `
              <div class="item">
                <span>${item.quantity}x ${item.productName}${item.variantName ? ` - ${item.variantName}` : ''}</span>
                <span>S/ ${calculateItemTotal(item.price, item.quantity)}</span>
              </div>
            `).join('')}
          </div>
          <div class="total">
            <div class="item">
              <span>Total:</span>
              <span>S/ ${order.total.toFixed(2)}</span>
            </div>
          </div>
          <div class="footer">
            <p>Método de pago: ${order.paymentMethod || 'Mixto'}</p>
            <p>${new Date().toLocaleString("es-PE")}</p>
          </div>
        </body>
      </html>
    `
    const printWindow = window.open("", "", "width=400,height=600")
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleDelete = async (order: Order) => {
    if (!isAdmin) {
      alert("No tienes permisos para eliminar ventas")
      return
    }
    
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la venta de la mesa ${order.tableNumber}?`)) {
      return
    }

    setIsDeleting(true)
    try {
      if (!order.cashClosureId) {
        alert("Error: No se encontró el cierre asociado a esta venta")
        return
      }

      // 1. Get the closure to retrieve initialAmount
      const cashClosure = await getDocument(collections.cashRegister, order.cashClosureId)
      const initialAmount = cashClosure?.initialAmount || 0

      // 2. Delete the order using deleteDoc
      const orderRef = doc(db, collections.orders, order.id!)
      await deleteDoc(orderRef)
      
      // 3. Recalculate the cash register with remaining orders
      await recalculateCashRegisterAfterOrderDeletion(order.cashClosureId, initialAmount)
      
      setSelectedOrder(null)
      setShowDetail(false)
    } catch (error) {
      console.error("Error al eliminar:", error)
      alert("Error al eliminar la venta")
    } finally {
      setIsDeleting(false)
    }
  }

  if (todaysSales.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Ventas del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay ventas registradas hoy</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Ventas del Día
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg sm:text-xl font-bold text-primary">
                S/ {totalsData.total.toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
              <p className="text-xs text-muted-foreground">Ventas</p>
              <p className="text-lg sm:text-xl font-bold text-blue-500">
                {totalsData.count}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-xs text-muted-foreground">Promedio</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-500">
                S/ {totalsData.average.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Sales Table */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Mesa</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Hora</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Items</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {todaysSales.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-2 font-medium">
                      Mesa {order.tableNumber}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatPeruTime(order.createdAt)}
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">
                      {order.items.length} {order.items.length === 1 ? "producto" : "productos"}
                    </td>
                    <td className="py-3 px-2 text-right font-bold">
                      S/ {order.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedOrder(order)
                            setShowDetail(true)
                          }}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handlePrint(order)}
                          title="Imprimir"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(order)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle de Venta - Mesa {selectedOrder?.tableNumber}</DialogTitle>
            <DialogDescription>
              Información completa del pedido y detalles de pago
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hora:</span>
                  <span className="font-medium">{formatPeruTime(selectedOrder.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Método de pago:</span>
                  <span className="font-medium">
                    {selectedOrder.paymentMethod === "cash"
                      ? "Efectivo"
                      : selectedOrder.paymentMethod === "card"
                      ? "Tarjeta"
                      : selectedOrder.paymentMethod === "yape"
                      ? "Yape"
                      : "Mixto"}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-medium mb-2">Items</h4>
                <div className="space-y-1">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.productName}
                        {item.variantName && (
                          <span className="text-muted-foreground"> - {item.variantName}</span>
                        )}
                      </span>
                      <span>S/ {calculateItemTotal(item.price, item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 flex justify-between items-center">
                <span className="font-medium">Total:</span>
                <span className="text-lg font-bold text-primary">
                  S/ {selectedOrder.total.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handlePrint(selectedOrder)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                {isAdmin && (
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => handleDelete(selectedOrder)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isDeleting ? "Eliminando..." : "Eliminar"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
