"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { useAuth } from "./auth-context"
import {
  subscribeToOrders,
  subscribeToTables,
  subscribeToProducts,
  subscribeToPaidOrders,
  subscribeToOpenCashRegister,
  calculateSalesFromOrders,
  type Order,
  type Table,
  type Product,
  type ProductVariant,
  type OrderItem,
  type Payment,
  type PaymentMethod,
  type PizzaMassType,
  PIZZA_SIZE_LABELS,
  PIZZA_INVENTORY_CODES,
  initializePizzaInventory,
  addDocument,
  updateDocument,
  collections,
  getOpenCashRegister,
  type CashRegister,
  createOrderTransaction,
  addItemsToOrder,
  processPaymentTransaction,
  getActiveOrderForTable,
  recordCashAdjustmentTransaction,
  recordCashMovementTransaction,
} from "@/lib/firebase/firestore"
import { Timestamp, serverTimestamp, doc, setDoc, collection, runTransaction, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase/config"

interface CartItem extends OrderItem {
  tempId: string
  variantName?: string // For products with variants
}

interface SalesBreakdown {
  cashSales: number
  cardSales: number
  yapeSales: number
  totalSales: number
  ordersCount: number
  expectedCash: number
}

interface POSContextType {
  orders: Order[]
  tables: Table[]
  products: Product[]
  cart: CartItem[]
  selectedTable: Table | null
  cashRegister: CashRegister | null
  paidOrders: Order[]
  readyOrders: Order[]
  salesBreakdown: SalesBreakdown
  operationalBalance: number
  isLoading: boolean
  // Cart actions
  // For pizzas: pizzaOptions.massType and price are REQUIRED; flavor is secondary metadata
  addToCart: (product: Product, quantity?: number, notes?: string, variant?: ProductVariant, pizzaOptions?: { massType: PizzaMassType; flavor?: string; price: number }) => void
  removeFromCart: (tempId: string) => void
  updateCartItemQuantity: (tempId: string, quantity: number) => void
  clearCart: () => void
  getCartTotal: () => number
  
  // Table actions
  selectTable: (table: Table) => void
  clearSelectedTable: () => void
  
  // Order actions
  createOrder: () => Promise<string | null>
  updateOrderStatus: (orderId: string, status: Order["status"]) => Promise<void>
  processPayment: (
    orderId: string,
    payments: Payment[]
  ) => Promise<void>
  
  // Cash register actions
  openCashRegister: (initialAmount: number) => Promise<void>
  closeCashRegister: (countedCash: number) => Promise<void>
  addCashIncome: (amount: number, reason: "fondo_sencillo" | "dinero_dueno" | "reposicion" | "ajuste" | "otro", description: string) => Promise<void>
  recordCashMovement: (
    type: "entrada" | "salida",
    category: "fondo_sencillo" | "dinero_dueno" | "reposicion" | "propina_tienda" | "propina_mozo" | "pago_proveedor" | "retiro_dueno" | "ajuste_arqueo" | "otro",
    amount: number,
    description: string,
    origin?: "caja_operativa" | "caja_fuerte"
  ) => Promise<void>
  refreshCashRegister: () => Promise<void>
}

const POSContext = createContext<POSContextType | undefined>(undefined)

export function POSProvider({ children }: { children: ReactNode }) {
  const { user, currentStoreId } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [paidOrders, setPaidOrders] = useState<Order[]>([])
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [salesBreakdown, setSalesBreakdown] = useState<SalesBreakdown>({
    cashSales: 0,
    cardSales: 0,
    yapeSales: 0,
    totalSales: 0,
    ordersCount: 0,
    expectedCash: 0,
  })
  const [operationalBalance, setOperationalBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  // Subscribe to real-time data using currentStoreId
  useEffect(() => {
    if (!currentStoreId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const unsubOrders = subscribeToOrders(currentStoreId, setOrders)
    const unsubTables = subscribeToTables(currentStoreId, setTables)
    const unsubProducts = subscribeToProducts(currentStoreId, setProducts)
    void initializePizzaInventory(currentStoreId)

    // Subscribe to ready orders for waiter display
    const unsubReadyOrders = subscribeToOrders(currentStoreId, (orders) => {
      const ready = orders.filter((o) => o.status === "ready")
      setReadyOrders(ready)
    })

    // Subscribe to the open cash register for real-time updates
    const unsubCashRegister = subscribeToOpenCashRegister(currentStoreId, setCashRegister)

    // Subscribe to operational balance (single source of truth for cash state)
    const unsubOpBalance = onSnapshot(
      doc(db, collections.cashBoxBalances, `${currentStoreId}_operational`),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as any
          setOperationalBalance(data.balance || 0)
        } else {
          setOperationalBalance(0)
        }
      },
      (error) => {
        console.error("Error subscribing to operational balance:", error)
        setOperationalBalance(0)
      }
    )

    setIsLoading(false)

    return () => {
      unsubOrders()
      unsubTables()
      unsubProducts()
      unsubReadyOrders()
      unsubCashRegister()
      unsubOpBalance()
    }
  }, [currentStoreId])

  // Subscribe to paid orders when cash register is open
  useEffect(() => {
    if (!currentStoreId || !cashRegister?.id) {
      setPaidOrders([])
      setSalesBreakdown({
        cashSales: 0,
        cardSales: 0,
        yapeSales: 0,
        totalSales: 0,
        ordersCount: 0,
        expectedCash: operationalBalance,
      })
      return
    }

    const unsubPaidOrders = subscribeToPaidOrders(
      currentStoreId,
      cashRegister.id,
      (orders) => {
        setPaidOrders(orders)
        const breakdown = calculateSalesFromOrders(orders)
        setSalesBreakdown({
          ...breakdown,
          // expectedCash is now the REAL operational balance (single source of truth)
          // It already includes: initialAmount - expenses + sales collections
          expectedCash: operationalBalance,
        })
      }
    )

    return () => {
      unsubPaidOrders()
    }
  }, [currentStoreId, cashRegister?.id, operationalBalance])

  // Self-healing sync: reconcile table occupancy from active orders in realtime
  useEffect(() => {
    if (!currentStoreId || tables.length === 0) return

    const activeOrderTableIds = new Set(
      orders
        .filter((o) => o.paymentStatus === "pending" && !o.cancelled && o.status !== "cancelled")
        .map((o) => o.tableId)
        .filter((id): id is string => Boolean(id))
    )

    tables.forEach((table) => {
      if (!table.id) return
      const shouldBeOccupied = activeOrderTableIds.has(table.id)

      if (table.status === "occupied" && !shouldBeOccupied) {
        updateDocument(collections.tables, table.id, {
          status: "available",
          currentOrderId: null,
        }).catch((error) => console.error("Error reconciling table to available:", error))
      }

      if (table.status === "available" && shouldBeOccupied) {
        const activeOrder = orders.find(
          (o) => o.tableId === table.id && o.paymentStatus === "pending" && !o.cancelled && o.status !== "cancelled"
        )
        updateDocument(collections.tables, table.id, {
          status: "occupied",
          currentOrderId: activeOrder?.id || null,
        }).catch((error) => console.error("Error reconciling table to occupied:", error))
      }
    })
  }, [currentStoreId, tables, orders])

  // Cart actions
  // For pizzas: massType and price are REQUIRED; flavor is secondary metadata
  const addToCart = useCallback((
    product: Product, 
    quantity = 1, 
    notes?: string, 
    variant?: ProductVariant,
    pizzaOptions?: { massType: PizzaMassType; flavor?: string; price: number }
  ) => {
    if (!product.id || !product.name) {
      return
    }

    // Check if this is a pizza - special handling
    const isPizza = product.category?.toLowerCase() === 'pizzas'
    
    // For pizzas: massType and price from the flavor priceMap are REQUIRED
    if (isPizza) {
      if (!pizzaOptions?.massType || pizzaOptions.price === undefined) {
        console.error("[POS] Pizza item requires explicit massType and price from the flavor priceMap")
        return
      }
    }

    // Determine price: 
    // - For pizzas: use price from pizzaOptions (from product.priceMap)
    // - For variants: use variant price
    // - Otherwise: use legacy product price
    let price: number
    if (isPizza && pizzaOptions) {
      price = pizzaOptions.price
    } else if (variant) {
      price = variant.price
    } else {
      price = product.price ?? 0
    }
    
    if (price === 0 && !variant && !isPizza) {
      // Product requires a variant but none was selected
      return
    }

    // Normalize variantName: use "default" if null/undefined/empty
    // For pizzas: use the size label as variantName
    const normalizedVariantName = isPizza && pizzaOptions?.massType
      ? PIZZA_SIZE_LABELS[pizzaOptions.massType]
      : (variant?.name ? variant.name : "default")

    setCart((prev) => {
      // For pizzas: use massType + flavor as part of the unique key
      // This allows same flavor in different sizes to be separate items
      const uniqueKey = isPizza && pizzaOptions?.massType
        ? `${product.id}:${pizzaOptions.massType}:${pizzaOptions.flavor || product.name}`
        : `${product.id}:${normalizedVariantName}`

      // Check if item with same key already exists
      const existingIndex = prev.findIndex((item) => item.tempId === uniqueKey)

      if (existingIndex !== -1) {
        // Item exists - increase quantity only
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        }
        return updated
      }

      // Item doesn't exist - add new item
      const tempId = uniqueKey
      
      // For pizzas: use the inventory code as productId for proper inventory tracking
      // For others: use variant ID directly from the variant parameter
      const productIdForItem = isPizza && pizzaOptions?.massType
        ? PIZZA_INVENTORY_CODES[pizzaOptions.massType]
        : product.id!
      const variantId = variant?.id
      
      const newItem = {
        tempId,
        productId: productIdForItem,
        variantId, // Add stable variant ID reference
        productName: isPizza ? `${pizzaOptions?.flavor || product.name} - ${PIZZA_SIZE_LABELS[pizzaOptions!.massType]}` : product.name,
        category: product.category, // Include category for inventory tracking
        variantName: normalizedVariantName === "default" ? "" : normalizedVariantName,
        quantity,
        price,
        notes,
        // Pizza-specific fields (ONLY set for category === 'pizzas')
        ...(isPizza && pizzaOptions ? {
          productType: 'pizza' as const,
          massType: pizzaOptions.massType,
          flavor: pizzaOptions.flavor || product.name, // Flavor is metadata only
        } : {}),
      } as CartItem
      return [...prev, newItem]
    })
  }, [])

  const removeFromCart = useCallback((tempId: string) => {
    setCart((prev) => prev.filter((item) => item.tempId !== tempId))
  }, [])

  const updateCartItemQuantity = useCallback((tempId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(tempId)
      return
    }
    setCart((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, quantity } : item))
    )
  }, [removeFromCart])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  // Memoize cart total calculation to avoid recalculating on every render
  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }, [cart])

  const getCartTotal = useCallback(() => {
    return cartTotal
  }, [cartTotal])

  // Table actions
  const selectTable = useCallback((table: Table) => {
    setSelectedTable(table)
  }, [])

  const clearSelectedTable = useCallback(() => {
    setSelectedTable(null)
    setCart([])
  }, [])

  // Order actions
  const createOrder = useCallback(async (): Promise<string | null> => {
    if (!currentStoreId || !selectedTable?.id || !cart || cart.length === 0 || !user) {
      return null
    }

    try {
      const invalidItems = cart.filter(
        (item) => !item.productId || !item.productName || item.price === undefined || !item.quantity
      )
      if (invalidItems.length > 0) {
        return null
      }

      const orderItems = cart.map((item) => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}), // Add stable variant ID reference
        productName: item.productName,
        category: item.category, // Include category for automatic inventory deduction
        ...(item.variantName ? { variantName: item.variantName } : {}),
        quantity: item.quantity,
        price: item.price,
        ...(item.notes ? { notes: item.notes } : {}),
        ...(item.productType ? { productType: item.productType } : {}),
        ...(item.massType ? { massType: item.massType } : {}),
        ...(item.flavor ? { flavor: item.flavor } : {}),
      })) as OrderItem[]
      const total = getCartTotal()

      const existingOrder = await getActiveOrderForTable(selectedTable.id)

      if (existingOrder?.id) {
        await addItemsToOrder(existingOrder.id, orderItems, total)
        clearCart()
        clearSelectedTable()
        return existingOrder.id
      }

      const orderId = await createOrderTransaction(
        currentStoreId,
        selectedTable.id,
        selectedTable.number,
        orderItems,
        total,
        user.id!,
        user.name
      )

      clearCart()
      clearSelectedTable()
      return orderId
    } catch (error) {
      console.error("Error creating order:", error)
      return null
    }
  }, [currentStoreId, selectedTable, cart, user, getCartTotal, clearCart, clearSelectedTable])

  const updateOrderStatus = useCallback(
    async (orderId: string, status: Order["status"]) => {
      try {
        await updateDocument(collections.orders, orderId, { status })
      } catch (error) {
        console.error("Error updating order status:", error)
      }
    },
    []
  )

  const processPayment = useCallback(
    async (orderId: string, payments: Payment[]) => {
      if (!currentStoreId || !cashRegister?.id) {
        throw new Error("No hay caja abierta")
      }

      const order = orders.find((o) => o.id === orderId)
      if (!order) {
        throw new Error("Pedido no encontrado")
      }

      if (!order.tableId) {
        throw new Error("El pedido no tiene mesa asociada")
      }

      // Use transaction to process payment (links to cash register session)
      const orderItems = await processPaymentTransaction(
        orderId,
        order.tableId,
        payments,
        order.total,
        cashRegister.id,
        currentStoreId // Pass storeId to update operational balance
      )

      // Inventory is deducted in real-time when order items are created (createOrderTransaction/addItemsToOrder)
      // No need to deduct here during payment
    },
    [currentStoreId, orders, cashRegister?.id]
  )

  // Cash register actions
  const openCashRegister = useCallback(
    async (initialAmount: number) => {
      if (!currentStoreId || !user) return

      try {
        // 1. Create/update operational cash box balance
        const operationalBalanceId = `${currentStoreId}_operational`
        const operationalBalanceRef = doc(db, collections.cashBoxBalances, operationalBalanceId)
        
        await setDoc(operationalBalanceRef, {
          storeId: currentStoreId,
          type: "operational" as const,
          balance: initialAmount,
          updatedAt: serverTimestamp(),
          updatedBy: user.id,
        }, { merge: true })

        // 2. Create cash register
        const id = await addDocument(collections.cashRegister, {
          storeId: currentStoreId,
          initialAmount,
          status: "open",
          openedAt: serverTimestamp(),
          openedBy: user.id,
          openedByName: user.name,
        })

        setCashRegister({
          id,
          storeId: currentStoreId,
          initialAmount,
          status: "open",
          openedAt: Timestamp.now(),
          openedBy: user.id!,
          openedByName: user.name,
        })
      } catch (error) {
        console.error("Error opening cash register:", error)
        throw error
      }
    },
    [currentStoreId, user]
  )

  const closeCashRegister = useCallback(
    async (countedCash: number) => {
      if (!cashRegister?.id || !user) return

      try {
        const expectedCash = salesBreakdown.expectedCash
        const difference = countedCash - expectedCash

        // Save complete snapshot at closing time
        await updateDocument(collections.cashRegister, cashRegister.id, {
          countedCash,
          expectedCash,
          difference,
          status: "closed",
          closedAt: serverTimestamp(),
          closedBy: user.id,
          closedByName: user.name,
          // Sales snapshot
          cashSales: salesBreakdown.cashSales,
          cardSales: salesBreakdown.cardSales,
          yapeSales: salesBreakdown.yapeSales,
          totalSales: salesBreakdown.totalSales,
          ordersCount: salesBreakdown.ordersCount,
        })
        
        // Update all paid orders from this session to include cashClosureId
        if (paidOrders.length > 0) {
          for (const order of paidOrders) {
            if (order.id && !order.cashClosureId) {
              await updateDocument(collections.orders, order.id, {
                cashClosureId: cashRegister.id,
              })
            }
          }
        }
        
        setCashRegister(null)
        setPaidOrders([])
        setSalesBreakdown({
          cashSales: 0,
          cardSales: 0,
          yapeSales: 0,
          totalSales: 0,
          ordersCount: 0,
          expectedCash: 0,
        })
      } catch (error) {
        console.error("Error closing cash register:", error)
        throw error
      }
    },
    [cashRegister?.id, user, salesBreakdown, paidOrders]
  )

  const refreshCashRegister = useCallback(async () => {
    if (!currentStoreId) return
    const register = await getOpenCashRegister(currentStoreId)
    setCashRegister(register)
  }, [currentStoreId])

  const addCashIncome = useCallback(
    async (
      amount: number,
      reason: "fondo_sencillo" | "dinero_dueno" | "reposicion" | "ajuste" | "otro",
      description: string
    ) => {
      if (!user || !currentStoreId) return

      try {
        await recordCashAdjustmentTransaction(
          currentStoreId,
          amount,
          reason,
          description,
          user.id!,
          user.name
        )

        // Refresh cash register to show updated balance
        await refreshCashRegister()
      } catch (error) {
        console.error("Error adding cash income:", error)
        throw error
      }
    },
    [user, currentStoreId, refreshCashRegister]
  )

  const recordCashMovement = useCallback(
    async (
      type: "entrada" | "salida",
      category: "fondo_sencillo" | "dinero_dueno" | "reposicion" | "propina_tienda" | "propina_mozo" | "pago_proveedor" | "retiro_dueno" | "ajuste_arqueo" | "otro",
      amount: number,
      description: string,
      origin: "caja_operativa" | "caja_fuerte" = "caja_operativa"
    ) => {
      if (!user || !currentStoreId) return

      try {
        await recordCashMovementTransaction(
          currentStoreId,
          type,
          category,
          amount,
          description,
          user.id!,
          user.name,
          origin
        )

        // Refresh cash register to show updated balance
        await refreshCashRegister()
      } catch (error) {
        console.error("Error recording cash movement:", error)
        throw error
      }
    },
    [user, currentStoreId, refreshCashRegister]
  )

  // Memoize context value to prevent unnecessary re-renders in consumers
  const value: POSContextType = useMemo(() => ({
    orders,
    tables,
    products,
    cart,
    selectedTable,
    cashRegister,
    paidOrders,
    readyOrders,
    salesBreakdown,
    operationalBalance,
    isLoading,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    getCartTotal,
    selectTable,
    clearSelectedTable,
    createOrder,
    updateOrderStatus,
    processPayment,
    openCashRegister,
    closeCashRegister,
    addCashIncome,
    recordCashMovement,
    refreshCashRegister,
  }), [
    orders,
    tables,
    products,
    cart,
    selectedTable,
    cashRegister,
    paidOrders,
    readyOrders,
    salesBreakdown,
    operationalBalance,
    isLoading,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    getCartTotal,
    selectTable,
    clearSelectedTable,
    createOrder,
    updateOrderStatus,
    processPayment,
    openCashRegister,
    closeCashRegister,
    addCashIncome,
    recordCashMovement,
    refreshCashRegister,
  ])

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>
}

export function usePOS() {
  const context = useContext(POSContext)
  if (context === undefined) {
    throw new Error("usePOS must be used within a POSProvider")
  }
  return context
}
