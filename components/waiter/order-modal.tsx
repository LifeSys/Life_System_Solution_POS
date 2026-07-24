"use client"

import { useState } from "react"
import { usePOS } from "@/contexts/pos-context"
import type { Table, Product, ProductVariant, PizzaMassType } from "@/lib/firebase/firestore"
import { ProductList } from "./product-list"
import { Cart } from "./cart"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface OrderModalProps {
  table: Table
  onClose: () => void
}

export function OrderModal({ table, onClose }: OrderModalProps) {
  const { addToCart, createOrder, orders, cart } = usePOS()
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find existing order for this table (by tableId for consistency)
  const existingOrder = orders.find(
    (o) => o.tableId === table.id && o.paymentStatus === "pending"
  )

  const handleAddProduct = (product: Product, variant?: ProductVariant, pizzaOptions?: { massType: PizzaMassType; flavor?: string; price: number }) => {
    addToCart(product, 1, undefined, variant, pizzaOptions)
  }

  const handleSendOrder = async () => {
    setIsSending(true)
    setError(null)
    
    if (!cart || cart.length === 0) {
      setError("El carrito está vacío. Agrega productos antes de enviar el pedido.")
      setIsSending(false)
      return
    }

    try {
      const orderId = await createOrder()
      if (orderId) {
        onClose()
      } else {
        setError("No se pudo crear el pedido. Verifica que hay productos en el carrito.")
      }
    } catch (err: any) {
      setError(err?.message || "Error al crear el pedido")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-2 sm:inset-4 md:inset-8 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Mesa {table.number}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {existingOrder ? "Agregar a pedido existente" : "Nuevo pedido"}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Products Section */}
          <div className="flex-1 p-3 sm:p-4 overflow-auto border-b md:border-b-0 md:border-r border-border min-h-[200px] md:min-h-0">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 sm:mb-4 uppercase tracking-wider">
              Productos
            </h3>
            <ProductList onAddProduct={handleAddProduct} />
          </div>

          {/* Cart Section */}
          <div className="w-full md:w-96 p-3 sm:p-4 flex flex-col overflow-auto">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 sm:mb-4 uppercase tracking-wider">
              Pedido Actual
            </h3>
            <div className="flex-1 overflow-auto">
              <Cart onSendOrder={handleSendOrder} isSending={isSending} />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-destructive/10 border-t border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Existing Order Info */}
        {existingOrder && (
          <div className="px-6 py-3 bg-secondary/10 border-t border-secondary/20">
            <p className="text-sm text-secondary">
              <span className="font-medium">Pedido existente:</span>{" "}
              Total: S/ {existingOrder.total.toFixed(2)} - Estado:{" "}
              <span className="capitalize">
                {existingOrder.status === "open" ? "Abierto" :
                 existingOrder.status === "preparing" ? "Preparando" :
                 existingOrder.status === "ready" ? "Listo" :
                 existingOrder.status === "delivered" ? "Entregado" : existingOrder.status}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
