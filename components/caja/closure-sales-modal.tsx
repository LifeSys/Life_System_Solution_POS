"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn, calculateItemTotal } from "@/lib/utils"
import {
  Printer,
  Trash2,
  Eye,
  AlertTriangle,
  Clock,
  DollarSign,
} from "lucide-react"
import type { Order, CashRegister } from "@/lib/firebase/firestore"
import { getDocuments, collections, recalculateCashRegisterAfterOrderDeletion, updateDocument } from "@/lib/firebase/firestore"
import { where } from "firebase/firestore"
import { onSnapshot, collection, query } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import { toPeruDate } from "@/lib/utils"

interface ClosureSalesModalProps {
  isOpen: boolean
  onClose: () => void
  cashClosure: CashRegister | null
}

export function ClosureSalesModal({ isOpen, onClose, cashClosure }: ClosureSalesModalProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"
  
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load and listen to real-time updates for orders
  useEffect(() => {
    if (!isOpen || !cashClosure?.id) return

    setIsLoading(true)
    
    // Set up real-time listener for orders in this closure
    const q = query(
      collection(db, collections.orders),
      where("cashClosureId", "==", cashClosure.id),
      where("paymentStatus", "==", "paid")
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const closureOrders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Order))
        setOrders(closureOrders)
        setIsLoading(false)
      },
      (error) => {
        console.error("Error loading closure orders:", error)
        setOrders([])
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [isOpen, cashClosure?.id])

  const handleDelete = async (orderId: string) => {
    if (!isAdmin) return

    try {
      setIsDeleting(true)
      
      // Get the order to retrieve cashClosureId
      const orderToDelete = orders.find(o => o.id === orderId)
      
      if (!orderToDelete?.cashClosureId) {
        alert("Error: No se encontró el cierre asociado a esta venta")
        return
      }

      // 1. Soft-cancel order (no physical delete for financial traceability)
      await updateDocument(collections.orders, orderId, {
        cancelled: true,
        cancelReason: "Anulada desde cierre de caja",
        status: "cancelled",
      })
      
      // 2. Recalculate the cash register with remaining orders
      const initialAmount = cashClosure?.initialAmount || 0
      await recalculateCashRegisterAfterOrderDeletion(orderToDelete.cashClosureId, initialAmount)
      
      // 3. Clear selection (onSnapshot will auto-update the list)
      setDeleteConfirm(null)
    } catch (error) {
      console.error("Error deleting order:", error)
      alert("Error al eliminar la venta")
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePrint = (order: Order) => {
    // Print logic - you can customize this
    window.print()
  }

  const totalSales = orders.reduce((sum, order) => sum + order.total, 0)

  const getPaymentMethodColor = (method?: string) => {
    switch (method) {
      case "cash":
        return "text-green-500"
      case "card":
        return "text-blue-500"
      case "yape":
        return "text-purple-500"
      case "mixed":
        return "text-orange-500"
      default:
        return "text-muted-foreground"
    }
  }

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case "cash":
        return "Efectivo"
      case "card":
        return "Tarjeta"
      case "yape":
        return "Yape"
      case "mixed":
        return "Mixto"
      default:
        return "-"
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ventas del Cierre
            </DialogTitle>
            <DialogDescription>
              Resumen de todas las transacciones incluidas en este cierre de caja
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : orders.length > 0 ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Total de Ventas</p>
                  <p className="text-2xl font-bold text-primary">S/ {totalSales.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cantidad de Pedidos</p>
                  <p className="text-2xl font-bold">{ orders.length}</p>
                </div>
              </div>

              {/* Sales Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Hora</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Mesa</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Método</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const createdAtPeru = order.createdAt ? toPeruDate(order.createdAt) : null
                      return (
                        <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-3 text-xs">
                            {createdAtPeru?.toLocaleTimeString("es-PE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-3 font-medium">Mesa {order.tableNumber}</td>
                          <td className={cn(
                            "py-3 px-3 font-medium",
                            getPaymentMethodColor(order.paymentMethod)
                          )}>
                            {getPaymentMethodLabel(order.paymentMethod)}
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            S/ {order.total.toFixed(2)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setShowDetail(true)
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePrint(order)}
                                className="h-8 w-8 p-0"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteConfirm(order.id!)}
                                  className="h-8 w-8 p-0 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirm && (
                <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">¿Eliminar esta venta?</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Esta acción no se puede deshacer
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(deleteConfirm)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <Spinner className="mr-2 h-4 w-4" />
                              Eliminando...
                            </>
                          ) : (
                            "Confirmar Eliminación"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirm(null)}
                          disabled={isDeleting}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No hay ventas en este cierre</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      {selectedOrder && (
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalle de Venta - Mesa {selectedOrder.tableNumber}</DialogTitle>
              <DialogDescription>
                Información completa del pedido incluyendo items y detalles de pago
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Hora</p>
                  <p className="font-medium">
                    {selectedOrder.createdAt ? toPeruDate(selectedOrder.createdAt).toLocaleTimeString("es-PE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Método de Pago</p>
                  <p className={cn(
                    "font-medium",
                    getPaymentMethodColor(selectedOrder.paymentMethod)
                  )}>
                    {getPaymentMethodLabel(selectedOrder.paymentMethod)}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <h3 className="font-medium">Productos</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between p-2 bg-muted/50 rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {item.productName}
                          {item.variantName && <span className="text-muted-foreground text-xs"> - {item.variantName}</span>}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground">Nota: {item.notes}</p>
                        )}
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                        <p className="font-medium">S/ {calculateItemTotal(item.price, item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end items-center gap-4 p-4 bg-primary/10 rounded-lg">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-2xl font-bold text-primary">S/ {selectedOrder.total.toFixed(2)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => handlePrint(selectedOrder)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                {isAdmin && (
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => {
                      handleDelete(selectedOrder.id!)
                      setShowDetail(false)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
