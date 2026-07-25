"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { usePOS } from "@/contexts/pos-context"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { cn, calculateItemTotal } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { 
  CreditCard, 
  Banknote, 
  Printer, 
  DollarSign,
  TrendingUp,
  Receipt,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Smartphone,
  History,
  Calendar,
  User,
  Vault,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
} from "lucide-react"
import type { Order, Payment, PaymentMethod, CashRegister, OrderItem } from "@/lib/firebase/firestore"
import { subscribeToClosedCashRegisters, subscribeToSafeBox, subscribeToFinancialMovements, registerInternalExpenseV2, type SafeBox, updateOpenOrderItems, cancelOrderItems } from "@/lib/firebase/firestore"
import { toPeruDate } from "@/lib/utils"
import { DailySales } from "@/components/caja/daily-sales"
import { ClosureSalesModal } from "@/components/caja/closure-sales-modal"
import { CashDistribution } from "@/components/caja/cash-distribution"
import { RecentMovements } from "@/components/caja/recent-movements"
import { CashMovementModal } from "@/components/caja/cash-movement-modal"
import { generateOrderReceipt } from "@/lib/print/receipt-templates"
import { generatePrintHTML } from "@/lib/print/thermal-printer"
import { usePrintSettings } from "@/lib/hooks/use-print-settings"
import FacturacionService, { ClienteVarios } from "@/lib/services/facturacion-service"
import { useDocumentLookup } from "@/lib/hooks/use-document-lookup"
import type { ClienteLocal } from "@/lib/services/clientes-service"
import type { TipoComprobante, ClienteComprobante } from "@/lib/models/comprobante"

export default function CajaPage() {
  const { 
    orders, 
    cashRegister, 
    paidOrders,
    salesBreakdown,
    processPayment, 
    openCashRegister, 
    closeCashRegister, 
    isLoading 
  } = usePOS()
  const { currentStoreId, currentStore, user } = useAuth()
  const { settings: printSettings } = usePrintSettings(currentStoreId || "")
  const { toast } = useToast()
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentMethod, string>>({
    cash: "",
    card: "",
    yape: "",
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>("NOTA_VENTA")
  const [clienteDoc, setClienteDoc] = useState("")
  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteDireccion, setClienteDireccion] = useState("")
  const [clienteEstado, setClienteEstado] = useState("")
  const [clienteCondicion, setClienteCondicion] = useState("")
  const [comprobanteWarning, setComprobanteWarning] = useState<string | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastProcessedOrder, setLastProcessedOrder] = useState<Order | null>(null)
  
  const completarCliente = useCallback((cliente: ClienteLocal) => {
    setClienteNombre(cliente.razon_social || cliente.nombre_completo || "")
    setClienteDireccion(cliente.direccion || "")
    setClienteEstado(cliente.estado || "")
    setClienteCondicion(cliente.condicion || "")
  }, [])

  const notifyDocumentLookup = useCallback((message: string, variant?: "default" | "destructive") => {
    toast({
      title: variant === "destructive" ? "Consulta de documento" : message,
      description: variant === "destructive" ? message : undefined,
      variant,
    })
  }, [toast])

  const { isLookingUp: isLookingUpCliente, statusMessage: clienteLookupMessage } = useDocumentLookup({
    tipoComprobante,
    documento: clienteDoc,
    tenantId: currentStoreId,
    onCompleted: completarCliente,
    onMessage: notifyDocumentLookup,
  })

  // Order editing state
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ index: number; item: OrderItem } | null>(null)
  
  // Cash register modals
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [initialAmount, setInitialAmount] = useState("")
  const [countedCash, setCountedCash] = useState("")
  
  // Cash register history
  const [closedRegisters, setClosedRegisters] = useState<CashRegister[]>([])
  const [selectedClosureForSales, setSelectedClosureForSales] = useState<CashRegister | null>(null)
  const [showSalesModal, setShowSalesModal] = useState(false)
  const [showDistributionModal, setShowDistributionModal] = useState(false)
  const [distributionContext, setDistributionContext] = useState<{ closureId: string; totalCash: number } | null>(null)
  const [safeBox, setSafeBox] = useState<SafeBox | null>(null)
  const [safeMovements, setSafeMovements] = useState<any[]>([])
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", source: "cash_register" as "cash_register" | "safe_box", category: "otros" })
  const [showCashMovementModal, setShowCashMovementModal] = useState(false)
  
  // Month filter for history
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all")

  // Subscribe to closed cash registers (history)
  useEffect(() => {
    if (!currentStoreId) return
    const unsub = subscribeToClosedCashRegisters(currentStoreId, setClosedRegisters)
    return () => unsub()
  }, [currentStoreId])

  useEffect(() => {
    if (!currentStoreId) return
    const unsubSafe = subscribeToSafeBox(currentStoreId, setSafeBox)
    const unsubMov = subscribeToFinancialMovements(currentStoreId, setSafeMovements, 30)
    return () => { unsubSafe(); unsubMov() }
  }, [currentStoreId])

  // Filter orders ready for payment (pending payment and ready/delivered) - memoized
  const pendingPaymentOrders = useMemo(() => 
    orders.filter(
      (o) => o.paymentStatus === "pending" && (o.status === "ready" || o.status === "delivered")
    ), [orders]
  )

  // Memoize parsed payment amounts to avoid recalculating
  const parsedPayments = useMemo(() => ({
    cash: parseFloat(paymentAmounts.cash) || 0,
    card: parseFloat(paymentAmounts.card) || 0,
    yape: parseFloat(paymentAmounts.yape) || 0,
  }), [paymentAmounts])

  // Calculate total from payment amounts - memoized
  const getTotalPayment = useCallback(() => {
    return parsedPayments.cash + parsedPayments.card + parsedPayments.yape
  }, [parsedPayments])

  // Build payments array from amounts - memoized
  const buildPayments = useCallback((): Payment[] => {
    const payments: Payment[] = []
    if (parsedPayments.cash > 0) payments.push({ method: "cash", amount: parsedPayments.cash })
    if (parsedPayments.card > 0) payments.push({ method: "card", amount: parsedPayments.card })
    if (parsedPayments.yape > 0) payments.push({ method: "yape", amount: parsedPayments.yape })
    return payments
  }, [parsedPayments])

  // Quick fill for single payment method - memoized
  const fillSingleMethod = useCallback((method: PaymentMethod) => {
    if (!selectedOrder) return
    setPaymentAmounts({
      cash: method === "cash" ? selectedOrder.total.toString() : "",
      card: method === "card" ? selectedOrder.total.toString() : "",
      yape: method === "yape" ? selectedOrder.total.toString() : "",
    })
  }, [selectedOrder])

  // Calculate daily expenses from financial movements - memoized
  const dailyExpenses = useMemo(() => {
    if (!cashRegister) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return safeMovements
      .filter(m => {
        // Handle both Firestore timestamp and regular dates
        const timestamp = m.timestamp || m.createdAt
        const movDate = new Date(timestamp?.toDate ? timestamp.toDate() : timestamp)
        movDate.setHours(0, 0, 0, 0)
        // Include expenses and salidas (manual expenses are recorded as salidas in financial movements)
        return (m.type === "expense" || (m.type === "cash_movement" && m.movementType === "salida")) && movDate.getTime() === today.getTime()
      })
      .reduce((sum, m) => sum + (m.amount || 0), 0)
  }, [safeMovements, cashRegister])

  // Calculate cash difference - memoized
  const cashDifference = useMemo(() => {
    if (!cashRegister) return 0
    return (parseFloat(countedCash) || 0) - salesBreakdown.expectedCash
  }, [cashRegister, countedCash, salesBreakdown.expectedCash])

  const handlePayment = async () => {
    if (!selectedOrder?.id) return

    const payments = buildPayments()
    const totalPaid = getTotalPayment()

    // Validate payment totals
    if (Math.abs(totalPaid - selectedOrder.total) > 0.01) {
      alert(`El monto pagado (S/ ${totalPaid.toFixed(2)}) no coincide con el total (S/ ${selectedOrder.total.toFixed(2)})`)
      return
    }

    if (payments.length === 0) {
      alert("Debe ingresar al menos un monto de pago")
      return
    }

    // Validate cliente data required for Factura
    if (tipoComprobante === "FACTURA") {
      if (!/^\d{11}$/.test(clienteDoc.trim())) {
        alert("Para emitir Factura necesitas el RUC del cliente (11 dígitos)")
        return
      }
      if (!clienteNombre.trim()) {
        alert("Para emitir Factura necesitas la Razón Social del cliente")
        return
      }
    }
    if (tipoComprobante === "BOLETA" && clienteDoc.trim() && !/^\d{8}$/.test(clienteDoc.trim())) {
      alert("El DNI del cliente debe tener 8 dígitos (o déjalo vacío para Cliente Varios)")
      return
    }

    setIsProcessing(true)
    setComprobanteWarning(null)

    try {
      await processPayment(selectedOrder.id, payments)

      // Emitir el comprobante correspondiente via API (ya no se guarda simulado en Firebase)
      const cliente: ClienteComprobante =
        tipoComprobante === "NOTA_VENTA" || !clienteDoc.trim()
          ? ClienteVarios
          : {
              tipoDoc: tipoComprobante === "FACTURA" ? "6" : "1",
              numDoc: clienteDoc.trim(),
              razonSocial: clienteNombre.trim() || "CLIENTE VARIOS",
              direccion: clienteDireccion.trim() || undefined,
            }

      const resultado = await FacturacionService.emitir({
        tipo: tipoComprobante,
        order: selectedOrder as any,
        cliente,
        userId: user?.id,
        userName: user?.name,
      })

      if (!resultado.ok) {
        // El pago ya se registró en caja; solo avisamos que la emisión ante la API falló.
        setComprobanteWarning(
          `El pago se procesó, pero no se pudo emitir el comprobante en la API: ${resultado.mensaje || "error desconocido"}`
        )
        toast({
          title: "Pago registrado, comprobante pendiente",
          description: resultado.mensaje || "No se pudo emitir el comprobante en la API",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Comprobante emitido",
          description: resultado.numeroCompleto ? `Se emitió ${resultado.numeroCompleto}` : "Comprobante enviado a la API",
        })
      }

      setLastProcessedOrder({
        ...selectedOrder,
        payments,
        paymentMethod: payments.length === 1 ? payments[0].method : "mixed",
      })
      setShowReceipt(true)
      setSelectedOrder(null)
      setPaymentAmounts({ cash: "", card: "", yape: "" })
      setTipoComprobante("NOTA_VENTA")
      setClienteDoc("")
      setClienteNombre("")
      setClienteDireccion("")
      setClienteEstado("")
      setClienteCondicion("")
    } catch (error: any) {
      alert(error?.message || "Error al procesar el pago")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateItemQuantity = async (itemIndex: number, newQuantity: number) => {
    if (!selectedOrder || !user?.id) return

    // Validate quantity
    if (newQuantity <= 0) {
      toast({
        title: "Cantidad inválida",
        description: "La cantidad debe ser mayor a 0",
        variant: "destructive",
      })
      return
    }

    if (selectedOrder.paymentStatus === "paid") {
      toast({
        title: "Pedido pagado",
        description: "No se puede editar un pedido pagado",
        variant: "destructive",
      })
      return
    }

    try {
      setIsProcessing(true)
      const updatedItems = selectedOrder.items.map((item, idx) => 
        idx === itemIndex ? { ...item, quantity: newQuantity } : item
      )
      
      if (!selectedOrder.id) return
      await updateOpenOrderItems(
        selectedOrder.id,
        updatedItems,
        user.id,
        user.name || "Usuario",
        "quantity_change_from_caja"
      )

      // Update UI with new data
      const newTotal = updatedItems
        .filter((i) => !i.cancelled)
        .reduce((sum, i) => sum + i.price * i.quantity, 0)
      
      setSelectedOrder({
        ...selectedOrder,
        items: updatedItems,
        total: newTotal,
      })

      toast({
        title: "Item actualizado",
        description: `Cantidad modificada a ${newQuantity}x`,
      })
      setEditingItemIndex(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Error al actualizar cantidad",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!selectedOrder || !itemToDelete || !user?.id) return

    if (selectedOrder.paymentStatus === "paid") {
      toast({
        title: "Pedido pagado",
        description: "No se puede editar un pedido pagado",
        variant: "destructive",
      })
      setShowDeleteConfirmation(false)
      return
    }

    try {
      setIsProcessing(true)
      const itemIndex = itemToDelete.index
      const item = itemToDelete.item

      if (!selectedOrder.id) return
      await cancelOrderItems(
        selectedOrder.id,
        [item.id || `legacy:${itemIndex}`],
        "user_deletion_from_caja",
        user.id,
        user.name || "Usuario"
      )

      // Update UI with new items
      const updatedItems = selectedOrder.items.map((i, idx) => 
        idx === itemIndex ? { ...i, cancelled: true } : i
      )
      const newTotal = updatedItems
        .filter((i) => !i.cancelled)
        .reduce((sum, i) => sum + i.price * i.quantity, 0)

      setSelectedOrder({
        ...selectedOrder,
        items: updatedItems,
        total: newTotal,
      })

      toast({
        title: "Item eliminado",
        description: `${item.productName} ha sido removido del pedido`,
      })
      
      setShowDeleteConfirmation(false)
      setItemToDelete(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Error al eliminar item",
        variant: "destructive",
      })
      setShowDeleteConfirmation(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenCashRegister = async () => {
    const amount = parseFloat(initialAmount) || 0
    try {
      await openCashRegister(amount)
      setShowOpenModal(false)
      setInitialAmount("")
    } catch (error: any) {
      alert(error?.message || "Error al abrir caja")
    }
  }

  const handleCloseCashRegister = async () => {
    const amount = parseFloat(countedCash) || 0
    try {
      const closureId = cashRegister?.id
      await closeCashRegister(amount)
      setShowCloseModal(false)
      setCountedCash("")
      if (closureId) {
        setDistributionContext({ closureId, totalCash: amount })
        setShowDistributionModal(true)
      }
    } catch (error: any) {
      alert(error?.message || "Error al cerrar caja")
    }
  }

  const handleRegisterExpense = async () => {
    if (!currentStoreId || !user?.id || !expenseForm.description.trim() || !expenseForm.amount) {
      alert("Por favor completa todos los campos requeridos")
      return
    }

    const amount = parseFloat(expenseForm.amount)
    if (isNaN(amount) || amount <= 0) {
      alert("El monto debe ser mayor a 0")
      return
    }

    if (amount > 100000) {
      alert("El monto no puede ser mayor a S/ 100,000")
      return
    }

    // Validate balance if withdrawing from safe box
    if (expenseForm.source === "safe_box" && safeBox && safeBox.currentBalance < amount) {
      alert(`Saldo insuficiente en caja fuerte. Disponible: S/ ${safeBox.currentBalance.toFixed(2)}`)
      return
    }

    try {
      setIsProcessing(true)
      await registerInternalExpenseV2(
        currentStoreId,
        { 
          description: expenseForm.description.trim(), 
          amount, 
          source: expenseForm.source, 
          category: expenseForm.category.trim() || "otros" 
        },
        user.id,
        user.name || "Usuario"
      )
      setShowExpenseModal(false)
      setExpenseForm({ description: "", amount: "", source: "cash_register", category: "otros" })
    } catch (error: any) {
      alert(error?.message || "Error registrando gasto")
    } finally {
      setIsProcessing(false)
    }
  }

  // Calculate difference for close modal
  const closeDifference = cashRegister 
    ? (parseFloat(countedCash) || 0) - salesBreakdown.expectedCash
    : 0

  // Filter closed registers by month - memoized
  const filteredClosedRegisters = useMemo(() => {
    if (selectedMonthFilter === "all") return closedRegisters
    
    const today = new Date()
    const currentYear = today.getFullYear()
    const [year, month] = selectedMonthFilter.split("-")
    
    return closedRegisters.filter(register => {
      const closedDate = register.closedAt ? toPeruDate(register.closedAt) : null
      if (!closedDate) return false
      
      return closedDate.getFullYear() === parseInt(year) && 
             (closedDate.getMonth() + 1).toString().padStart(2, "0") === month
    })
  }, [closedRegisters, selectedMonthFilter])

  // Generate available months for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    closedRegisters.forEach(register => {
      const closedDate = register.closedAt ? toPeruDate(register.closedAt) : null
      if (closedDate) {
        const year = closedDate.getFullYear()
        const month = (closedDate.getMonth() + 1).toString().padStart(2, "0")
        months.add(`${year}-${month}`)
      }
    })
    return Array.from(months).sort().reverse()
  }, [closedRegisters])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Simplified 3-section operational layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Cash Register Status */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Estado de Caja
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cashRegister ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <span className="flex items-center gap-1 text-green-500 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Abierta
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Monto inicial</span>
                  <span className="font-semibold">S/ {cashRegister.initialAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Abierta por</span>
                  <span className="text-sm">{cashRegister.openedByName}</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowCloseModal(true)}
                >
                  Cerrar Caja
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Cerrada
                  </span>
                </div>
                <Button
                  className="w-full mt-2 bg-primary hover:bg-primary/90"
                  onClick={() => setShowOpenModal(true)}
                >
                  Abrir Caja
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Summary - Real-time from orders */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Resumen de Ventas (Tiempo Real)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cashRegister ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
                <div className="text-center p-2 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-green-500" />
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="text-sm sm:text-lg font-bold text-green-500">
                    S/ {salesBreakdown.cashSales.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-blue-500" />
                  <p className="text-xs text-muted-foreground">Tarjeta</p>
                  <p className="text-sm sm:text-lg font-bold text-blue-500">
                    S/ {salesBreakdown.cardSales.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-purple-500" />
                  <p className="text-xs text-muted-foreground">Yape</p>
                  <p className="text-sm sm:text-lg font-bold text-purple-500">
                    S/ {salesBreakdown.yapeSales.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm sm:text-lg font-bold text-primary">
                    S/ {salesBreakdown.totalSales.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Receipt className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-amber-500" />
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                  <p className="text-sm sm:text-lg font-bold text-amber-500">
                    {salesBreakdown.ordersCount}
                  </p>
                </div>
                <div className="text-center p-2 sm:p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 text-emerald-500" />
                  <p className="text-xs text-muted-foreground">Caja Esperada</p>
                  <p className="text-sm sm:text-lg font-bold text-emerald-500">
                    S/ {salesBreakdown.expectedCash.toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Abra la caja para ver el resumen de ventas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Orders and Payment Processing - After Sales Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pending Orders */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Pedidos por Cobrar</h2>
          <div className="space-y-3 max-h-[calc(100vh-24rem)] overflow-y-auto">
            {pendingPaymentOrders.map((order) => (
              <Card
                key={order.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary",
                  selectedOrder?.id === order.id && "border-primary bg-primary/5"
                )}
                onClick={() => {
                  setSelectedOrder(order)
                  setPaymentAmounts({ cash: "", card: "", yape: "" })
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl font-bold">Mesa {order.tableNumber}</span>
                    <span className="text-xl font-bold text-primary">
                      S/ {order.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.items.length} productos
                  </div>
                </CardContent>
              </Card>
            ))}

            {pendingPaymentOrders.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay pedidos pendientes de cobro</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Section */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Procesar Pago</h2>
          {selectedOrder ? (
            <Card className="border-border bg-card">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Order Summary with edit capabilities */}
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                  <div className="flex justify-between items-center pb-3 border-b border-border">
                    <span className="text-muted-foreground">Mesa</span>
                    <span className="font-bold text-xl">{selectedOrder.tableNumber}</span>
                  </div>
                  
                  {selectedOrder.paymentStatus === "paid" && (
                    <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>Pedido pagado: no se puede editar</span>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, index) => {
                      if (item.cancelled) return null
                      const isEditable = selectedOrder.paymentStatus !== "paid"
                      
                      return (
                        <div key={index} className="flex items-center justify-between text-sm p-2 rounded bg-card border border-border/50">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {item.productName}
                              {item.variantName && <span className="text-muted-foreground text-xs"> - {item.variantName}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              S/ {item.price.toFixed(2)} c/u
                            </div>
                          </div>
                          
                          {isEditable ? (
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    handleUpdateItemQuantity(index, item.quantity - 1)
                                  } else {
                                    setItemToDelete({ index, item })
                                    setShowDeleteConfirmation(true)
                                  }
                                }}
                                disabled={isProcessing}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              
                              <span className="w-8 text-center font-medium text-xs">
                                {item.quantity}x
                              </span>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 hover:bg-primary/20 hover:text-primary"
                                onClick={() => handleUpdateItemQuantity(index, item.quantity + 1)}
                                disabled={isProcessing}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 ml-1 hover:bg-destructive/20 hover:text-destructive"
                                onClick={() => {
                                  setItemToDelete({ index, item })
                                  setShowDeleteConfirmation(true)
                                }}
                                disabled={isProcessing}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-right min-w-12 flex-shrink-0 ml-2">
                              <div className="font-medium text-xs">{item.quantity}x</div>
                            </div>
                          )}
                          
                          <div className="text-right ml-2 min-w-16 font-medium flex-shrink-0">
                            S/ {calculateItemTotal(item.price, item.quantity)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      S/ {selectedOrder.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quick Payment Buttons */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Pago Rápido (un solo método)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="flex-col gap-2 h-auto py-3 hover:bg-green-500/10 hover:border-green-500"
                      onClick={() => fillSingleMethod("cash")}
                    >
                      <Banknote className="h-5 w-5 text-green-500" />
                      <span className="text-xs">Efectivo</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col gap-2 h-auto py-3 hover:bg-blue-500/10 hover:border-blue-500"
                      onClick={() => fillSingleMethod("card")}
                    >
                      <CreditCard className="h-5 w-5 text-blue-500" />
                      <span className="text-xs">Tarjeta</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col gap-2 h-auto py-3 hover:bg-purple-500/10 hover:border-purple-500"
                      onClick={() => fillSingleMethod("yape")}
                    >
                      <Smartphone className="h-5 w-5 text-purple-500" />
                      <span className="text-xs">Yape</span>
                    </Button>
                  </div>
                </div>

                {/* Payment Amounts - For mixed payments */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Montos de Pago (soporta pagos mixtos)</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Banknote className="h-3 w-3 text-green-500" />
                        Efectivo
                      </label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={paymentAmounts.cash}
                        onChange={(e) => setPaymentAmounts(prev => ({ ...prev, cash: e.target.value }))}
                        className="bg-input"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-blue-500" />
                        Tarjeta
                      </label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={paymentAmounts.card}
                        onChange={(e) => setPaymentAmounts(prev => ({ ...prev, card: e.target.value }))}
                        className="bg-input"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Smartphone className="h-3 w-3 text-purple-500" />
                        Yape
                      </label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={paymentAmounts.yape}
                        onChange={(e) => setPaymentAmounts(prev => ({ ...prev, yape: e.target.value }))}
                        className="bg-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Tipo de Comprobante */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Tipo de Comprobante</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["NOTA_VENTA", "BOLETA", "FACTURA"] as TipoComprobante[]).map((tipo) => (
                      <Button
                        key={tipo}
                        type="button"
                        variant={tipoComprobante === tipo ? "default" : "outline"}
                        className="h-auto py-3 text-xs sm:text-sm"
                        onClick={() => setTipoComprobante(tipo)}
                      >
                        {tipo === "NOTA_VENTA" ? "Nota de Venta" : tipo === "BOLETA" ? "Boleta" : "Factura"}
                      </Button>
                    ))}
                  </div>

                  {tipoComprobante !== "NOTA_VENTA" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {tipoComprobante === "FACTURA" ? "RUC (11 dígitos)" : "DNI (opcional)"}
                        </label>
                        <div className="relative">
                          <Input
                            value={clienteDoc}
                            onChange={(e) => setClienteDoc(e.target.value.replace(/\D/g, ""))}
                            placeholder={tipoComprobante === "FACTURA" ? "20123456789" : "12345678"}
                            maxLength={tipoComprobante === "FACTURA" ? 11 : 8}
                            className="bg-input pr-8"
                          />
                          {isLookingUpCliente && (
                            <Spinner className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          {tipoComprobante === "FACTURA" ? "Razón Social" : "Nombre (opcional)"}
                        </label>
                        <Input
                          value={clienteNombre}
                          onChange={(e) => setClienteNombre(e.target.value)}
                          placeholder={tipoComprobante === "FACTURA" ? "Empresa S.A.C." : "Cliente"}
                          disabled={isLookingUpCliente}
                          className="bg-input"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-muted-foreground">
                          {tipoComprobante === "FACTURA" ? "Dirección Fiscal" : "Dirección (opcional)"}
                        </label>
                        <Input
                          value={clienteDireccion}
                          onChange={(e) => setClienteDireccion(e.target.value)}
                          placeholder={tipoComprobante === "FACTURA" ? "Dirección fiscal" : "Dirección del cliente"}
                          disabled={isLookingUpCliente}
                          className="bg-input"
                        />
                      </div>
                      {tipoComprobante === "FACTURA" && (clienteEstado || clienteCondicion) && (
                        <div className="col-span-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <div>Estado: <span className="font-medium text-foreground">{clienteEstado || "-"}</span></div>
                          <div>Condición: <span className="font-medium text-foreground">{clienteCondicion || "-"}</span></div>
                        </div>
                      )}
                      {clienteLookupMessage && (
                        <div className="col-span-2 text-xs text-muted-foreground">{clienteLookupMessage}</div>
                      )}
                    </div>
                  )}
                </div>

                {comprobanteWarning && (
                  <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{comprobanteWarning}</span>
                  </div>
                )}

                {/* Confirm Payment Button */}
                <Button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full bg-primary hover:bg-primary/90 text-lg py-6 font-bold"
                >
                  {isProcessing ? (
                    <>
                      <Spinner className="h-5 w-5 mr-2 text-current" />
                      Procesando...
                    </>
                  ) : (
                    "Procesar Pago"
                  )}
                </Button>

                {/* Print Receipt Button */}
                <Button
                  onClick={() => {
                    if (!lastProcessedOrder) return
                    const receiptElements = generateOrderReceipt(lastProcessedOrder, currentStore || undefined)
                    const printHtml = generatePrintHTML(receiptElements)
                    
                    if (printSettings?.useThermalPrinter) {
                      const printWindow = window.open("", "_blank")
                      if (printWindow) {
                        printWindow.document.write(printHtml)
                        printWindow.document.close()
                        printWindow.print()
                      }
                    } else {
                      const printWindow = window.open("", "_blank")
                      if (printWindow) {
                        printWindow.document.write(printHtml)
                        printWindow.document.close()
                        printWindow.print()
                      }
                    }
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Reimprimir Ticket
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="p-4 sm:p-6 text-center text-muted-foreground py-8">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                Selecciona un pedido para procesar el pago
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Caja Fuerte y Auditoría */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Caja Fuerte y Auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-sm">Saldo Caja Fuerte</span>
            <span className="font-bold text-amber-600">S/ {(safeBox?.currentBalance || 0).toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => setShowCashMovementModal(true)}>Movimiento de Caja</Button>
            <Button className="flex-1" variant="outline" onClick={() => setShowExpenseModal(true)}>Registrar Gasto</Button>
          </div>
          
          {/* Recent Movements Section */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Últimos movimientos</p>
            <RecentMovements movements={safeMovements} />
          </div>
        </CardContent>
      </Card>

      {/* Daily Sales Section */}
      {cashRegister && <DailySales orders={paidOrders} store={currentStore} />}

      {/* Cash Register History Section */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historial de Cierres de Caja
            </CardTitle>
            {availableMonths.length > 0 && (
              <Select value={selectedMonthFilter} onValueChange={setSelectedMonthFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {availableMonths.map((month) => {
                    const [year, monthNum] = month.split("-")
                    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" })
                    return (
                      <SelectItem key={month} value={month}>
                        {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredClosedRegisters.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Usuario</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Monto Inicial</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Ventas Total</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Efectivo Esperado</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Efectivo Contado</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Diferencia</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClosedRegisters.map((register) => {
                    // Convert to Peru timezone for display
                    const closedDatePeru = register.closedAt ? toPeruDate(register.closedAt) : null
                    const difference = register.difference ?? 0
                    return (
                      <tr key={register.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {closedDatePeru?.toLocaleDateString("es-PE", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {closedDatePeru?.toLocaleTimeString("es-PE", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{register.closedByName || "-"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-medium">
                          S/ {(register.initialAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-primary">
                          S/ {(register.totalSales ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium text-emerald-500">
                          S/ {(register.expectedCash ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium">
                          S/ {(register.countedCash ?? 0).toFixed(2)}
                        </td>
                        <td className={cn(
                          "py-3 px-2 text-right font-bold",
                          difference === 0 
                            ? "text-green-500" 
                            : difference > 0 
                              ? "text-blue-500" 
                              : "text-destructive"
                        )}>
                          <div className="flex items-center justify-end gap-1">
                            {difference !== 0 && (
                              <AlertTriangle className={cn(
                                "h-4 w-4",
                                difference > 0 ? "text-blue-500" : "text-destructive"
                              )} />
                            )}
                            {difference >= 0 ? "+" : ""}S/ {difference.toFixed(2)}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedClosureForSales(register)
                              setShowSalesModal(true)
                            }}
                            className="text-xs"
                          >
                            Ver ventas
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No hay cierres de caja registrados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Cash Register Modal */}
      <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
            <DialogDescription>
              Ingrese el monto inicial de caja para comenzar el turno
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Monto Inicial</label>
              <Input
                type="number"
                placeholder="0.00"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                className="bg-input"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Este es el efectivo con el que inicia el turno
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="h-10" onClick={() => setShowOpenModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOpenCashRegister} className="h-10 bg-primary">
              Abrir Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Cash Register Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
            <DialogDescription>
              Cuente el efectivo y registre el cierre de caja
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Sales Summary */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Efectivo vendido</p>
                <p className="font-semibold text-green-500">S/ {salesBreakdown.cashSales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tarjeta</p>
                <p className="font-semibold text-blue-500">S/ {salesBreakdown.cardSales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Yape</p>
                <p className="font-semibold text-purple-500">S/ {salesBreakdown.yapeSales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Ventas</p>
                <p className="font-semibold text-primary">S/ {salesBreakdown.totalSales.toFixed(2)}</p>
              </div>
            </div>

            {/* Expected vs Counted */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-sm font-medium">Caja Esperada (Efectivo)</span>
                <span className="font-bold text-emerald-500">
                  S/ {salesBreakdown.expectedCash.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                = Monto inicial (S/ {cashRegister?.initialAmount.toFixed(2)}) + Ventas efectivo (S/ {salesBreakdown.cashSales.toFixed(2)})
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Efectivo Contado</label>
              <Input
                type="number"
                placeholder="0.00"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="bg-input"
                autoFocus
              />
            </div>

            {/* Difference Indicator */}
            {countedCash && (
              <div className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                closeDifference === 0 
                  ? "bg-green-500/10 border-green-500/20"
                  : closeDifference > 0
                    ? "bg-blue-500/10 border-blue-500/20"
                    : "bg-destructive/10 border-destructive/20"
              )}>
                <span className="text-sm font-medium flex items-center gap-2">
                  {closeDifference === 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : closeDifference > 0 ? (
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  Diferencia
                </span>
                <span className={cn(
                  "font-bold",
                  closeDifference === 0 
                    ? "text-green-500"
                    : closeDifference > 0
                      ? "text-blue-500"
                      : "text-destructive"
                )}>
                  {closeDifference >= 0 ? "+" : ""}S/ {closeDifference.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="h-10" onClick={() => setShowCloseModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCloseCashRegister} 
              className="h-10 bg-destructive hover:bg-destructive/90"
              disabled={!countedCash}
            >
              Cerrar Caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Modal */}
      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar eliminación
            </DialogTitle>
            <DialogDescription>
              {itemToDelete?.item.quantity === 1 
                ? `¿Deseas eliminar este item del pedido?`
                : `Reducir ${itemToDelete?.item.productName} de ${itemToDelete?.item.quantity}x a 0.`
              }
            </DialogDescription>
          </DialogHeader>
          {itemToDelete && (
            <div className="bg-muted/50 p-3 rounded space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Producto</p>
                <p className="font-medium">{itemToDelete.item.productName}</p>
              </div>
              {itemToDelete.item.variantName && (
                <div>
                  <p className="text-sm text-muted-foreground">Variante</p>
                  <p className="text-sm">{itemToDelete.item.variantName}</p>
                </div>
              )}
              <div className="flex justify-between pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Cantidad</p>
                  <p className="font-medium text-destructive">{itemToDelete.item.quantity}x</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Línea Total</p>
                  <p className="font-medium">S/ {(itemToDelete.item.price * itemToDelete.item.quantity).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="h-10" 
              onClick={() => {
                setShowDeleteConfirmation(false)
                setItemToDelete(null)
              }}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleDeleteItem}
              className="h-10 bg-destructive hover:bg-destructive/90"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Eliminando...
                </>
              ) : (
                "Eliminar Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Comprobante de Venta</DialogTitle>
            <DialogDescription className="text-center">
              Información del comprobante y opciones de impresión
            </DialogDescription>
          </DialogHeader>
          {lastProcessedOrder && (
            <div className="py-4">
              <div className="text-center mb-4">
                <p className="text-lg font-bold">LifeSystemSolution</p>
                <p className="text-sm text-muted-foreground">
                  {toPeruDate(new Date()).toLocaleString("es-PE")}
                </p>
              </div>
              
              <div className="border-t border-dashed border-border py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Mesa</span>
                  <span>{lastProcessedOrder.tableNumber}</span>
                </div>
                {lastProcessedOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.productName}
                      {item.variantName && <span className="text-muted-foreground"> - {item.variantName}</span>}
                    </span>
                    <span>S/ {calculateItemTotal(item.price, item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-dashed border-border pt-3 space-y-2">
                <div className="flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span>S/ {lastProcessedOrder.total.toFixed(2)}</span>
                </div>
                {lastProcessedOrder.payments?.map((payment, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                    <span className="capitalize">
                      {payment.method === "cash" ? "Efectivo" : 
                       payment.method === "card" ? "Tarjeta" : "Yape"}
                    </span>
                    <span>S/ {payment.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <p className="text-center text-xs text-muted-foreground mt-4">
                Gracias por su preferencia
              </p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1 h-10" onClick={() => setShowReceipt(false)}>
              Cerrar
            </Button>
            <Button 
              className="flex-1 h-10 gap-2" 
              onClick={() => {
                if (lastProcessedOrder && printSettings) {
                  const receiptElements = generateOrderReceipt(lastProcessedOrder, currentStore || undefined)
                  const html = generatePrintHTML(receiptElements, currentStore?.name, currentStore?.code)
                  const printWindow = window.open("", "_blank")
                  if (printWindow) {
                    printWindow.document.write(html)
                    printWindow.document.close()
                    setTimeout(() => printWindow.print(), 500)
                  }
                } else {
                  window.print()
                }
              }}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Closure Sales Modal */}
      <ClosureSalesModal
        isOpen={showSalesModal}
        onClose={() => {
          setShowSalesModal(false)
          setSelectedClosureForSales(null)
        }}
        cashClosure={selectedClosureForSales}
      />

      {/* Cash Distribution Modal (Post Closure) */}
      <Dialog open={showDistributionModal} onOpenChange={setShowDistributionModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Distribuir Efectivo de Cierre</DialogTitle>
            <DialogDescription>
              Define cuánto dinero enviar a caja fuerte y cuánto dejar en caja operativa.
            </DialogDescription>
          </DialogHeader>
          {distributionContext && (
            <CashDistribution
              totalCash={distributionContext.totalCash}
              cajaClosureId={distributionContext.closureId}
              onSuccess={() => {
                setShowDistributionModal(false)
                setDistributionContext(null)
              }}
              onError={() => {}}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Registrar Gasto
            </DialogTitle>
            <DialogDescription>
              Descuenta saldo y registra auditoría automáticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <Input
                placeholder="Ej: Café para la cocina"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                maxLength={100}
                className="bg-input"
              />
              <p className="text-xs text-muted-foreground">
                {expenseForm.description.length}/100
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Monto (S/)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                min="0"
                step="0.01"
                max="100000"
                className="bg-input"
              />
              {expenseForm.source === "safe_box" && safeBox && (
                <p className="text-xs text-amber-600">
                  Disponible: S/ {safeBox.currentBalance.toFixed(2)}
                </p>
              )}
            </div>

            {/* Source */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Origen del Gasto</label>
              <Select
                value={expenseForm.source}
                onValueChange={(v) => setExpenseForm((p) => ({ ...p, source: v as any }))}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_register">Caja Operativa</SelectItem>
                  <SelectItem value="safe_box">Caja Fuerte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría (Opcional)</label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) => setExpenseForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="otros">Otros</SelectItem>
                  <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="suministros">Suministros</SelectItem>
                  <SelectItem value="servicios">Servicios</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => setShowExpenseModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterExpense}
              disabled={isProcessing || !expenseForm.description.trim() || !expenseForm.amount}
              className="h-10 bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Guardando...
                </>
              ) : (
                "Guardar Gasto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Movement Modal */}
      <CashMovementModal
        isOpen={showCashMovementModal}
        onClose={() => setShowCashMovementModal(false)}
        isCashOpen={!!cashRegister}
      />
    </div>
  )
}
