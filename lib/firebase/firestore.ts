import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  runTransaction,
  onSnapshot,
  addDoc,
  writeBatch,
  type QueryConstraint,
  type Transaction,
  type DocumentSnapshot,
  type DocumentData,
} from "firebase/firestore"
import { db } from "./config"

// Types
export interface Store {
  id?: string
  name: string
  code: string
  active: boolean
  createdAt: Timestamp
  firebaseUid?: string // Firebase UID of admin for this store
  firebaseEmail?: string // Firebase email of admin for this store
}

export interface User {
  id?: string
  name: string
  pin: string
  role: "super_admin" | "admin" | "admin_global" | "cajero" | "mesero" | "cocina"
  storeId?: string // Primary store (for single-store users)
  assignedStores?: string[] // Multi-store access (for admin_global users)
  active: boolean
}

export interface ProductVariant {
  id?: string // Unique variant ID within product - stable reference for inventory
  name: string // e.g., "Personal", "Mediana", "Familiar"
  price: number
}

export interface Product {
  id?: string
  name: string // Flavor name e.g., "Pizza Francesa"
  price?: number // Legacy: for products without variants
  category: string
  storeId: string
  available: boolean
  active: boolean
  image?: string
  variants?: ProductVariant[] // New: array of size variants (for non-pizza products)
  
  // Pizza-specific: price map per size (ONLY for category === 'pizzas')
  priceMap?: {
    [K in PizzaMassType]?: number // e.g., { PERSONAL: 18, FAMILIAR: 42, GIGANTE: 65 }
  }
}

// ========== PIZZA SPECIAL CATEGORY ARCHITECTURE ==========
// Pizzas are a SPECIAL SYSTEM CATEGORY with only 5 operational inventory products.
// Flavors are ONLY metadata, NOT products/inventory/SKUs.

// Pizza Mass Types - the ONLY 5 operational pizza products
export const PIZZA_MASS_TYPES = [
  'PERSONAL',
  'BIPERSONAL',
  'FAMILIAR',
  'GIGANTE',
  'SUPER_GIGANTE'
] as const

export type PizzaMassType = typeof PIZZA_MASS_TYPES[number]

// Pizza inventory codes - unique identifiers for the 5 operational products
export const PIZZA_INVENTORY_CODES: Record<PizzaMassType, string> = {
  'PERSONAL': 'PZ-PER',
  'BIPERSONAL': 'PZ-BIP',
  'FAMILIAR': 'PZ-FAM',
  'GIGANTE': 'PZ-GIG',
  'SUPER_GIGANTE': 'PZ-SGI'
}

// Display labels for pizza sizes
export const PIZZA_SIZE_LABELS: Record<PizzaMassType, string> = {
  'PERSONAL': 'Personal',
  'BIPERSONAL': 'Bipersonal',
  'FAMILIAR': 'Familiar',
  'GIGANTE': 'Gigante',
  'SUPER_GIGANTE': 'Super Gigante'
}

// Pizza Configuration - stored per store in pizza_config collection
// Controls: sizes with prices, available flavors, active status
export interface PizzaConfig {
  id?: string
  storeId: string
  // The 5 operational pizza sizes with their prices
  sizes: {
    [K in PizzaMassType]: {
      price: number
      available: boolean
    }
  }
  // Available flavors (metadata only - NOT inventory products)
  flavors: string[]
  active: boolean
  updatedAt?: Timestamp
}

// Updated OrderItem: Now a top-level document with full status tracking
export interface OrderItem {
  id?: string
  storeId: string
  orderId: string // Reference to parent order
  productId: string
  variantId?: string // Variant ID from product.variants[].id - stable reference for inventory
  productName: string
  category?: string // Product category (e.g., "pizzas", "bebidas") for inventory deduction
  variantName?: string // e.g., "Familiar" - for products with variants (display only)
  
  // Pizza-specific fields (ONLY for category === 'pizzas')
  productType?: 'pizza' // Explicit product type marker
  massType?: PizzaMassType // REQUIRED for pizzas - controls inventory by dough size
  flavor?: string // Secondary metadata for kitchen/UI/receipts (does NOT affect inventory)
  quantity: number
  price: number
  notes?: string
  status: "pending" | "sent_to_kitchen" | "preparing" | "ready" | "delivered"
  cancelled: boolean
  cancelReason?: string
  cancelAcknowledgedAt?: Timestamp
  sentAt?: Timestamp // When this item was sent to kitchen
  sentCount?: number // How many times this item has been prepared
  readyAt?: Timestamp
  deliveredAt?: Timestamp
  createdAt: Timestamp
  createdBy: string
  createdByName: string
  updatedAt?: Timestamp
}

// Updated Order: Simplified, no embedded items
export interface Order {
  id?: string
  storeId: string
  tableId?: string // Optional for takeout
  tableNumber?: number // Optional for takeout
  orderType: "dine_in" | "takeout"
  total: number
  status: "open" | "preparing" | "ready" | "delivered" | "paid" | "cancelled"
  paymentStatus: "pending" | "paid"
  paymentMethod?: PaymentMethod | "mixed"
  payments?: Payment[]
  createdAt: Timestamp
  updatedAt?: Timestamp
  paidAt?: Timestamp
  userId?: string
  userName?: string
  cashRegisterId?: string
  cashClosureId?: string
  notes?: string
  cancelled: boolean
  cancelReason?: string
}

// Audit log for order compliance
export interface OrderAuditLog {
  id?: string
  storeId: string
  orderId: string
  itemId?: string // If action is item-related
  action: "order_created" | "item_added" | "item_removed" | "item_cancelled" | "item_sent_to_kitchen" | "item_ready" | "item_delivered" | "order_paid" | "order_cancelled" | "order_edited" | "item_quantity_changed"
  userId: string
  userName: string
  changes?: Record<string, { before: any; after: any }>
  timestamp: Timestamp
  notes?: string
}

// ========== INVENTORY SYSTEM ==========

// Inventory item: tracks stock for a product variant at a store
export interface InventoryItem {
  id?: string
  storeId: string
  productId: string
  variantId?: string // Variant ID from product.variants[].id - stable reference
  productName: string
  variantName?: string // e.g., "500 ml", "Familiar" - display name
  normalizedVariantName?: string // e.g., "500ml", "familiar" - normalized for lookups (legacy)
  currentStock: number
  lastUpdated: Timestamp
  createdAt: Timestamp
}

// Inventory movement log: track all stock changes
export interface InventoryMovement {
  id?: string
  storeId: string
  productId: string
  productName: string
  variantName?: string
  quantity: number // negative for deductions, positive for additions
  reason: "order_paid" | "manual_addition" | "manual_deduction" | "adjustment"
  orderId?: string // If deducted due to payment
  notes?: string
  userId: string
  userName: string
  timestamp: Timestamp
}

export type PaymentMethod = "cash" | "card" | "yape"

export interface Payment {
  method: PaymentMethod
  amount: number
}



export interface Table {
  id?: string
  storeId: string
  number: number
  status: "available" | "occupied" | "reserved"
  capacity: number
  active: boolean
  currentOrderId?: string
}

export interface CashRegister {
  id?: string
  storeId: string
  initialAmount: number
  countedCash?: number
  expectedCash?: number
  difference?: number
  status: "open" | "closed"
  openedAt: Timestamp
  openedBy: string
  openedByName: string
  closedAt?: Timestamp
  closedBy?: string
  closedByName?: string
  // Sales snapshot saved at closing time
  cashSales?: number
  cardSales?: number
  yapeSales?: number
  totalSales?: number
  ordersCount?: number
}

export interface DailyReport {
  id?: string
  storeId: string
  date: string // YYYY-MM-DD format
  totalSales: number
  ordersCount: number
  cashSales: number
  cardSales: number
}

// ========== FINANCIAL MODULE: PROVIDERS & EXPENSES ==========

export type ExpenseCategory =
  | "supplies"        // Compras/insumos
  | "providers"       // Pagos a proveedores
  | "delivery"        // Entregas/envíos
  | "maintenance"     // Mantenimiento
  | "cleaning"        // Limpieza
  | "services"        // Servicios (internet, teléfono, etc)
  | "utilities"       // Servicios (luz, agua, gas)
  | "salaries"        // Sueldos
  | "transportation"  // Movilidad/combustible
  | "emergency"       // Gastos de emergencia
  | "other"          // Otros gastos

export type CashBoxType = "operational" | "principal" | "strongbox"

export interface Provider {
  id?: string
  storeId: string
  name: string
  contact?: string
  phone?: string
  email?: string
  products?: string[] // List of products/services provided
  balance: number // Amount owed to provider (negative = we owe, positive = they owe us)
  totalPaid: number // Cumulative amount paid
  createdAt: Timestamp
  updatedAt?: Timestamp
  active: boolean
}

export interface Expense {
  id?: string
  storeId: string
  amount: number
  category: ExpenseCategory
  description: string
  cashBoxOrigin: CashBoxType // Which cash box the money came from
  userId: string // User who registered the expense
  userName: string
  providerId?: string // Related provider if applicable
  receipt?: string // Optional receipt/document reference
  notes?: string
  createdAt: Timestamp
  updatedAt?: Timestamp
  isVoid?: boolean // Soft delete flag
  voidReason?: string
  voidedAt?: Timestamp
  voidedBy?: string
}

export interface CashBoxBalance {
  id?: string
  storeId: string
  boxType: CashBoxType
  balance: number // Current balance
  lastUpdated: Timestamp
  history?: Array<{
    amount: number
    operation: "add" | "subtract"
    reason: string
    timestamp: Timestamp
  }>
}

export interface ExpenseReport {
  id?: string
  storeId: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  totalExpenses: number
  expensesByCategory: Record<ExpenseCategory, number>
  expensesByProvider: Record<string, number>
  expensesByBox: Record<CashBoxType, number>
  generatedAt: Timestamp
  generatedBy: string
}

export interface AuditLog {
  id?: string
  storeId: string
  entityType: "expense" | "provider" | "cashbox" | "financial_movement" | "cash_distribution"
  entityId: string
  action: "create" | "update" | "delete" | "void" | "transfer" | "distribute"
  userId: string
  userName: string
  changes: Record<string, { before: any; after: any }>
  timestamp: Timestamp
  notes?: string
}

// Every money movement (immutable, created once)
export interface FinancialMovement {
  id?: string
  storeId: string
  type: "sale" | "expense" | "provider_payment" | "cash_transfer" | "cash_distribution" | "adjustment"
  amount: number
  fromBox?: CashBoxType // Which box money came from
  toBox?: CashBoxType // Which box money went to
  description: string
  category?: ExpenseCategory // If expense
  providerId?: string // If provider payment
  relatedDocId?: string // Link to parent (expense, provider payment, closure)
  userId: string
  userName: string
  timestamp: Timestamp // Server-generated
  archived?: boolean // For archival after 90 days
  archivedAt?: Timestamp
}

// Cash distribution during closure (atomic record)
export interface CashDistribution {
  id?: string
  storeId: string
  cajaClosureId: string // Link to original caja closure
  operationalToPrincipal: number
  operationalToStrongbox: number
  operationalRemaining: number
  principalToStrongbox?: number
  userId: string
  userName: string
  createdAt: Timestamp
  status: "completed" | "cancelled"
}

// Daily financial snapshot (consolidated summary - created at closure)
export interface DailyFinancialSummary {
  id: string // Format: {storeId}_{YYYY-MM-DD}
  storeId: string
  date: string // YYYY-MM-DD
  
  // Revenue
  totalSales: number
  cardSales: number
  cashSales: number
  yapiSales: number
  
  // Expenses
  totalExpenses: number
  expensesByCategory: Record<ExpenseCategory, number>
  
  // Movements
  totalTransfers: number
  providerPayments: number
  providerPaymentCount: number
  
  // Cash boxes (end-of-day balances)
  operationalBalance: number
  principalBalance: number
  strongboxBalance: number
  totalCashBalance: number
  
  // Reconciliation
  expectedCash: number
  actualCash: number
  cashDifference: number
  differenceReason?: string
  
  // Metrics
  orderCount: number
  discountTotal: number
  averageTicket: number
  
  // Metadata
  createdAt: Timestamp
  createdBy: string
  createdByName: string
  cajaClosureId: string // Link to source closure
  status: "final" | "provisional" // Provisional if day not closed, final after closure
}

// Collection references
export const collections = {
  stores: "stores",
  users: "users",
  products: "products",
  orders: "orders",
  orderItems: "order_items", // NEW: Separated from orders
  orderAuditLog: "order_audit_log", // NEW: Order compliance audit trail
  tables: "tables",
  cashRegister: "cash_register",
  dailyReports: "daily_reports",
  pizzaConfig: "pizza_config", // Legacy only: pizza prices now live on products.priceMap
  // Financial module collections
  providers: "providers",
  expenses: "expenses",
  cashBoxBalances: "cash_box_balances",
  expenseReports: "expense_reports",
  auditLogs: "audit_logs",
  financialMovements: "financial_movements",
  safeBox: "safe_box",
  safeBoxMovements: "safe_box_movements",
  auditLogsV2: "audit_logs",
  cashDistributions: "cash_distributions",
  dailyFinancialSummary: "daily_financial_summary",
  // Inventory collections
  inventory: "inventory", // Store inventory by location
  inventoryItems: "inventory_items", // Individual item stocks
  // Archived collections
  financialMovements_archived: "financial_movements_archived",
  expenses_archived: "expenses_archived",
}

export interface SafeBox {
  id?: string
  storeId: string
  currentBalance: number
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
}

export interface SafeBoxMovement {
  id?: string
  storeId: string
  type: "deposit" | "withdrawal" | "expense"
  amount: number
  source: "cash_register" | "safe_box"
  description: string
  cashRegisterId?: string
  userId: string
  userName: string
  createdAt: Timestamp | Date
}

// ========== PRODUCT CACHE ==========
// Simple in-memory cache for products to avoid redundant Firestore calls
interface ProductCache {
  storeId: string
  products: Product[]
  timestamp: number
}

let productCache: ProductCache | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Invalidate cache (call when products are updated)
export function invalidateProductCache(): void {
  productCache = null
}

// Check if cache is valid
function isProductCacheValid(storeId: string): boolean {
  if (!productCache) return false
  if (productCache.storeId !== storeId) return false
  if (Date.now() - productCache.timestamp > CACHE_TTL) return false
  return true
}

// Generic CRUD operations
export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const docRef = doc(db, collectionName, docId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T
  }
  return null
}

export async function getDocuments<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints)
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T))
}

export async function addDocument<T extends DocumentData>(
  collectionName: string,
  data: T
): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const docRef = doc(db, collectionName, docId)
  const sanitizedData = cleanUndefined(data as Record<string, unknown>)
  await updateDoc(docRef, {
    ...sanitizedData,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  const docRef = doc(db, collectionName, docId)
  // Soft delete: set active to false instead of permanently deleting
  await updateDoc(docRef, { active: false })
}

// Hard delete: permanently removes the document from the database

/**
 * Update inventory item stock
 */
export async function updateInventoryStock(
  inventoryId: string,
  newStock: number
): Promise<void> {
  try {
    const invRef = doc(db, collections.inventoryItems, inventoryId)
    await updateDoc(invRef, {
      currentStock: Math.max(0, newStock), // Ensure stock never goes below 0
      lastUpdated: serverTimestamp(),
    })
    console.log(`[Inventory:updated] ${inventoryId} stock updated to ${Math.max(0, newStock)}`)
  } catch (error) {
    console.error("[Inventory:error] Failed to update stock:", error)
    throw error
  }
}

/**
 * Add incoming stock to an inventory item using a transaction so concurrent
 * additions do not overwrite each other.
 */
export async function addInventoryStock(
  inventoryId: string,
  quantityToAdd: number
): Promise<number> {
  if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) {
    throw new Error("La cantidad a ingresar debe ser mayor a 0")
  }

  const sanitizedQuantity = Math.floor(quantityToAdd)
  const invRef = doc(db, collections.inventoryItems, inventoryId)

  return runTransaction(db, async (transaction) => {
    const invDoc = await transaction.get(invRef)

    if (!invDoc.exists()) {
      throw new Error(`Inventario no encontrado: ${inventoryId}`)
    }

    const data = invDoc.data() as InventoryItem
    const currentStock = data?.currentStock

    if (typeof currentStock !== "number" || Number.isNaN(currentStock)) {
      throw new Error(`Stock inválido para inventario ${inventoryId}`)
    }

    const newStock = currentStock + sanitizedQuantity

    transaction.update(invRef, {
      currentStock: newStock,
      lastUpdated: serverTimestamp(),
    })

    console.log("[Inventory:addition]", {
      inventoryId,
      previousStock: currentStock,
      added: sanitizedQuantity,
      newStock,
    })

    return newStock
  })
}
// Only for super_admin use
export async function hardDeleteDocument(collectionName: string, docId: string): Promise<void> {
  const docRef = doc(db, collectionName, docId)
  await deleteDoc(docRef)
}

// Store-specific queries
export async function getStoreByCode(code: string): Promise<Store | null> {
  const stores = await getDocuments<Store>(collections.stores, where("code", "==", code))
  return stores.length > 0 ? stores[0] : null
}

export async function getAllStores(): Promise<Store[]> {
  return getDocuments<Store>(collections.stores, where("active", "==", true))
}

// Get all stores including inactive (for admin only)
export async function getAllStoresIncludingInactive(): Promise<Store[]> {
  return getDocuments<Store>(collections.stores)
}

// Get stores filtered by user's assigned stores or storeId
export async function getStoresByUser(user: User): Promise<Store[]> {
  let storeIds: string[] = []
  
  // For admin_global users, use assignedStores
  if (user.role === "admin_global" && user.assignedStores?.length) {
    storeIds = user.assignedStores
  }
  // For other users, use their primary storeId
  else if (user.storeId) {
    storeIds = [user.storeId]
  }
  
  if (storeIds.length === 0) {
    return []
  }
  
  // Fetch all stores
  const allStores = await getAllStores()
  
  // Filter to only those in storeIds
  return allStores.filter((store) => storeIds.includes(store.id!))
}

// User queries
export async function getUserByPinAndStore(pin: string, storeId: string): Promise<User | null> {
  const users = await getDocuments<User>(
    collections.users,
    where("pin", "==", pin),
    where("storeId", "==", storeId),
    where("active", "==", true)
  )
  return users.length > 0 ? users[0] : null
}

// Get user by PIN only (for super_admin who doesn't have storeId)
export async function getUserByPin(pin: string): Promise<User | null> {
  const users = await getDocuments<User>(
    collections.users,
    where("pin", "==", pin),
    where("active", "==", true)
  )
  return users.length > 0 ? users[0] : null
}

// Get stores accessible by Firebase UID or email
export async function getStoresByFirebaseCredentials(
  firebaseUid?: string,
  firebaseEmail?: string
): Promise<Store[]> {
  if (!firebaseUid && !firebaseEmail) {
    return []
  }

  try {
    const allStores = await getAllStores()
    
    return allStores.filter((store) => {
      if (firebaseUid && store.firebaseUid === firebaseUid) {
        return true
      }
      if (firebaseEmail && store.firebaseEmail === firebaseEmail) {
        return true
      }
      return false
    })
  } catch (error) {
    console.error("Error getting stores by Firebase credentials:", error)
    return []
  }
}

export async function getUsersByStore(storeId: string): Promise<User[]> {
  return getDocuments<User>(
    collections.users,
    where("storeId", "==", storeId)
  )
}

// Product queries
export async function getProductsByStore(storeId: string): Promise<Product[]> {
  // Filter by available=true in query, then active=true client-side
  const products = await getDocuments<Product>(
    collections.products,
    where("storeId", "==", storeId),
    where("available", "==", true)
  )
  return products.filter((product) => product.active === true)
}

export async function getAllProductsByStore(storeId: string): Promise<Product[]> {
  // For admin: return all products regardless of availability for management
  return getDocuments<Product>(
    collections.products,
    where("storeId", "==", storeId)
  )
}

// Order queries
export async function getOrdersByStore(storeId: string): Promise<Order[]> {
  return getDocuments<Order>(
    collections.orders,
    where("storeId", "==", storeId),
    orderBy("createdAt", "desc")
  )
}

export async function getPendingOrdersByStore(storeId: string): Promise<Order[]> {
  return getDocuments<Order>(
    collections.orders,
    where("storeId", "==", storeId),
    where("paymentStatus", "==", "pendiente")
  )
}

// Table queries
export async function getTablesByStore(storeId: string): Promise<Table[]> {
  return getDocuments<Table>(
    collections.tables,
    where("storeId", "==", storeId),
    where("active", "==", true)
  )
}

// Get all tables for admin management (including inactive)
export async function getAllTablesByStore(storeId: string): Promise<Table[]> {
  return getDocuments<Table>(collections.tables, where("storeId", "==", storeId), orderBy("number", "asc"))
}

// Check if table number exists in store
export async function isTableNumberExists(storeId: string, tableNumber: number, excludeTableId?: string): Promise<boolean> {
  const tables = await getDocuments<Table>(
    collections.tables,
    where("storeId", "==", storeId),
    where("number", "==", tableNumber),
    where("active", "==", true)
  )
  if (excludeTableId) {
    return tables.some(t => t.id !== excludeTableId)
  }
  return tables.length > 0
}

// Cash register queries
export async function getOpenCashRegister(storeId: string): Promise<CashRegister | null> {
  const registers = await getDocuments<CashRegister>(
    collections.cashRegister,
    where("storeId", "==", storeId),
    where("status", "==", "open")
  )
  return registers.length > 0 ? registers[0] : null
}

// Subscribe to closed cash registers (history) - sorted by closedAt DESC
// Overload: Get ALL closed registers (for dashboard/reports)
export function subscribeToClosedCashRegisters(
  callback: (registers: CashRegister[]) => void
): () => void
// Overload: Get closed registers for specific store
export function subscribeToClosedCashRegisters(
  storeId: string,
  callback: (registers: CashRegister[]) => void
): () => void
// Implementation
export function subscribeToClosedCashRegisters(
  storeIdOrCallback: string | ((registers: CashRegister[]) => void),
  maybeCallback?: (registers: CashRegister[]) => void
): () => void {
  // Determine if first parameter is storeId or callback
  const isFirstParamCallback = typeof storeIdOrCallback === "function"
  const storeId = isFirstParamCallback ? undefined : storeIdOrCallback
  const callback = isFirstParamCallback ? storeIdOrCallback : maybeCallback

  if (!callback) {
    // Fallback unsubscribe function
    return () => {}
  }

  // Build query constraints.
  // IMPORTANT: keep sorting on the client. Combining `where("storeId", "==", ...)`
  // with `orderBy("closedAt", "desc")` requires a composite Firestore index;
  // when that index is missing the realtime listener fails and the cash closure
  // history appears empty in the UI. Query by filters only, then sort locally.
  const constraints: QueryConstraint[] = [where("status", "==", "closed")]
  if (storeId) {
    constraints.unshift(where("storeId", "==", storeId))
  }

  const q = query(collection(db, collections.cashRegister), ...constraints)

  return onSnapshot(q, (snapshot) => {
    const registers = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as CashRegister))
      .sort((a, b) => {
        const aClosedAt = a.closedAt?.toMillis?.() ?? 0
        const bClosedAt = b.closedAt?.toMillis?.() ?? 0
        return bClosedAt - aClosedAt
      })
    callback(registers)
  }, (error) => {
    console.error("Error subscribing to closed cash registers:", error)
    callback([])
  })
}

// Subscribe to the open cash register for real-time updates
export function subscribeToOpenCashRegister(
  storeId: string,
  callback: (register: CashRegister | null) => void
): () => void {
  const q = query(
    collection(db, collections.cashRegister),
    where("storeId", "==", storeId),
    where("status", "==", "open")
  )
  return onSnapshot(q, (snapshot) => {
    if (snapshot.docs.length > 0) {
      const register = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CashRegister
      callback(register)
    } else {
      callback(null)
    }
  })
}

// Subscribe to paid orders for the current cash register session
export function subscribeToPaidOrders(
  storeId: string,
  cashRegisterId: string,
  callback: (orders: Order[]) => void
): () => void {
  const q = query(
    collection(db, collections.orders),
    where("storeId", "==", storeId),
    where("paymentStatus", "==", "paid"),
    where("cashRegisterId", "==", cashRegisterId)
  )
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Order))
      .sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0
        const timeB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0
        return timeB - timeA
      })
    callback(orders)
  })
}

// Calculate sales breakdown from paid orders
export function calculateSalesFromOrders(orders: Order[]): {
  cashSales: number
  cardSales: number
  yapeSales: number
  totalSales: number
  ordersCount: number
} {
  let cashSales = 0
  let cardSales = 0
  let yapeSales = 0

  for (const order of orders) {
    if (order.payments && order.payments.length > 0) {
      for (const payment of order.payments) {
        switch (payment.method) {
          case "cash":
            cashSales += payment.amount
            break
          case "card":
            cardSales += payment.amount
            break
          case "yape":
            yapeSales += payment.amount
            break
        }
      }
    }
  }

  return {
    cashSales,
    cardSales,
    yapeSales,
    totalSales: cashSales + cardSales + yapeSales,
    ordersCount: orders.length,
  }
}

// ========== PIZZA ANALYTICS - TWO SEPARATE LAYERS ==========

// Type for operational pizza stats (by massType)
export interface PizzaOperationalStats {
  byMassType: Record<PizzaMassType, {
    count: number
    revenue: number
  }>
  totalPizzas: number
  totalPizzaRevenue: number
}

// Type for commercial pizza stats (by flavor)
export interface PizzaCommercialStats {
  byFlavor: Record<string, {
    count: number
    revenue: number
    massTypeBreakdown: Record<PizzaMassType, number>
  }>
  mostPopularFlavors: Array<{ flavor: string; count: number; revenue: number }>
  totalFlavors: number
}

// OPERATIONAL ANALYTICS: Grouped by massType
// Used for: inventory, dough consumption, production metrics
export function calculatePizzaOperationalStats(orders: Order[]): PizzaOperationalStats {
  const stats: PizzaOperationalStats = {
    byMassType: {
      PERSONAL: { count: 0, revenue: 0 },
      BIPERSONAL: { count: 0, revenue: 0 },
      FAMILIAR: { count: 0, revenue: 0 },
      GIGANTE: { count: 0, revenue: 0 },
      SUPER_GIGANTE: { count: 0, revenue: 0 },
    },
    totalPizzas: 0,
    totalPizzaRevenue: 0,
  }

  for (const order of orders) {
    if (!order.items) continue
    
    for (const item of order.items) {
      // Only process pizza items with explicit massType
      const isPizza = item.category?.toLowerCase() === 'pizzas' || item.productType === 'pizza'
      if (!isPizza || !item.massType) continue
      
      const massType = item.massType as PizzaMassType
      if (!PIZZA_MASS_TYPES.includes(massType)) continue
      
      const quantity = item.quantity || 0
      const revenue = (item.price || 0) * quantity
      
      stats.byMassType[massType].count += quantity
      stats.byMassType[massType].revenue += revenue
      stats.totalPizzas += quantity
      stats.totalPizzaRevenue += revenue
    }
  }

  return stats
}

// COMMERCIAL ANALYTICS: Grouped by flavor
// Used for: marketing, popularity, customer preferences
export function calculatePizzaCommercialStats(orders: Order[]): PizzaCommercialStats {
  const flavorMap: Record<string, {
    count: number
    revenue: number
    massTypeBreakdown: Record<PizzaMassType, number>
  }> = {}

  for (const order of orders) {
    if (!order.items) continue
    
    for (const item of order.items) {
      // Only process pizza items
      const isPizza = item.category?.toLowerCase() === 'pizzas' || item.productType === 'pizza'
      if (!isPizza) continue
      
      // Use flavor if available, otherwise fall back to productName
      const flavor = item.flavor || item.productName || 'Unknown'
      const quantity = item.quantity || 0
      const revenue = (item.price || 0) * quantity
      
      if (!flavorMap[flavor]) {
        flavorMap[flavor] = {
          count: 0,
          revenue: 0,
          massTypeBreakdown: {
            PERSONAL: 0,
            BIPERSONAL: 0,
            FAMILIAR: 0,
            GIGANTE: 0,
            SUPER_GIGANTE: 0,
          },
        }
      }
      
      flavorMap[flavor].count += quantity
      flavorMap[flavor].revenue += revenue
      
      // Track massType breakdown per flavor (for detailed analysis)
      if (item.massType && PIZZA_MASS_TYPES.includes(item.massType)) {
        flavorMap[flavor].massTypeBreakdown[item.massType] += quantity
      }
    }
  }

  // Sort by count to get most popular
  const sortedFlavors = Object.entries(flavorMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([flavor, data]) => ({ flavor, count: data.count, revenue: data.revenue }))

  return {
    byFlavor: flavorMap,
    mostPopularFlavors: sortedFlavors.slice(0, 10), // Top 10
    totalFlavors: Object.keys(flavorMap).length,
  }
}

// Real-time listeners
// Limit for orders queries to improve performance
const ORDERS_LIMIT = 50

export function subscribeToOrders(
  storeId: string,
  callback: (orders: Order[]) => void
): () => void {
  // Only fetch pending payment orders for POS (caja needs these)
  const q = query(
    collection(db, collections.orders),
    where("storeId", "==", storeId),
    where("paymentStatus", "==", "pending")
  )
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Order))
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0
        const timeB = b.createdAt?.toMillis?.() || 0
        return timeB - timeA // desc order
      })
    callback(orders)
  })
}

export function subscribeToKitchenOrders(
  storeId: string,
  callback: (orders: Order[]) => void,
  showOnlyUnsent: boolean = true  // Only show items never sent to kitchen
): () => void {
  // Subscribe to all orders for this store and filter client-side
  const q = query(
    collection(db, collections.orders),
    where("storeId", "==", storeId)
  )
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Order))
      .filter((o) => o.paymentStatus === "pending" && (o.status === "open" || o.status === "preparing" || o.status === "ready"))
      .filter((o) => {
        if (!showOnlyUnsent) return true
        const items = o.items || []
        const pendingItems = items.filter((item) => !item.sentAt || (item.cancelled && !item.cancelAcknowledgedAt))
        // Only OPEN orders depend on unsent/new items. PREPARING/READY should stay visible by status.
        if (o.status === "open") return pendingItems.length > 0
        return true
      })
      .map((o) => {
        if (!showOnlyUnsent) return o
        // OPEN: show only unsent/new/cancel-pending-ack items.
        if (o.status === "open" && o.items) {
          return {
            ...o,
            items: o.items.filter((item) => !item.sentAt || (item.cancelled && !item.cancelAcknowledgedAt)),
          }
        }
        // PREPARING/READY: keep full items list to avoid cards disappearing after sendAt.
        return o
      })
      .sort((a, b) => {
        // Sort pending and preparing by createdAt ASC (oldest first)
        // Sort ready by readyAt ASC (order of completion first)
        const statusOrder: Record<string, number> = { open: 0, preparing: 1, ready: 2 }
        const statusA = statusOrder[a.status] || 0
        const statusB = statusOrder[b.status] || 0
        
        if (statusA !== statusB) return statusA - statusB
        
        // Within same status, sort by appropriate timestamp
        if (a.status === "ready") {
          const timeA = a.readyAt?.toMillis() || a.createdAt?.toMillis() || 0
          const timeB = b.readyAt?.toMillis() || b.createdAt?.toMillis() || 0
          return timeA - timeB
        } else {
          const timeA = a.createdAt?.toMillis() || 0
          const timeB = b.createdAt?.toMillis() || 0
          return timeA - timeB
        }
      })
    console.debug("[kitchen:listener]", orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalItems: o.items?.length || 0,
      unsentItems: (o.items || []).filter((item) => !item.sentAt).length,
    })))
    callback(orders)
  })
}

export function subscribeToTables(
  storeId: string,
  callback: (tables: Table[]) => void
): () => void {
  // Subscribe to tables for POS operations (filtering active is done client-side)
  const q = query(
    collection(db, collections.tables),
    where("storeId", "==", storeId)
  )
  return onSnapshot(q, (snapshot) => {
    const tables = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Table))
      .filter((t) => t.active)
      .sort((a, b) => a.number - b.number)
    callback(tables)
  })
}

// Subscribe to all tables for admin management (including inactive)
export function subscribeToAllTables(
  storeId: string,
  callback: (tables: Table[]) => void
): () => void {
  const q = query(
    collection(db, collections.tables),
    where("storeId", "==", storeId)
  )
  return onSnapshot(q, (snapshot) => {
    const tables = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Table))
      .sort((a, b) => a.number - b.number)
    callback(tables)
  })
}

export function subscribeToProducts(
  storeId: string,
  callback: (products: Product[]) => void
): () => void {
  const q = query(
    collection(db, collections.products),
    where("storeId", "==", storeId),
    where("available", "==", true)
  )
  return onSnapshot(q, (snapshot) => {
    // Filter by both available (in query) AND active (client-side)
    const products = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Product))
      .filter((product) => product.active === true)
    
    // Update cache
    productCache = {
      storeId,
      products,
      timestamp: Date.now(),
    }
    
    callback(products)
  })
}

// Initialize store data
export async function initializeStoreData(storeId: string, tableCount: number = 10): Promise<void> {
  const batch = writeBatch(db)
  
  // Check if tables already exist
  const existingTables = await getTablesByStore(storeId)
  if (existingTables.length > 0) return

  // Create tables
  for (let i = 1; i <= tableCount; i++) {
    const tableRef = doc(collection(db, collections.tables))
    batch.set(tableRef, {
      storeId,
      number: i,
      status: "available",
      capacity: 4,
      active: true,
    })
  }

  await batch.commit()

  // Create the 5 operational pizza mass inventory items for this store.
  // Safe for existing stores: existing mass inventory documents are preserved.
  await initializePizzaInventory(storeId)
}

// ========== TRANSACTION-BASED ORDER OPERATIONS ==========

// Helper to clean undefined values from objects (Firestore rejects undefined)
function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T
}

// Clean items array - remove undefined fields from each item
function cleanItems(items: OrderItem[]): OrderItem[] {
  return items.map(item => cleanUndefined(item as unknown as Record<string, unknown>) as unknown as OrderItem)
}

// Helper: Get inventory item ID based on item type
// For pizzas: uses massType-based pattern (storeId_pizzamass_MASSTYPE)
// For all other categories: uses standard pattern (storeId_productId_variantId)
function getInventoryItemId(storeId: string, item: OrderItem): string {
  const isPizza = item.category?.toLowerCase() === 'pizzas' || item.productType === 'pizza'
  
  if (isPizza && item.massType) {
    // PIZZA: Inventory by mass type ONLY (not by flavor)
    // e.g., "store123_pizzamass_FAMILIAR"
    return `${storeId}_pizzamass_${item.massType}`
  }
  
  // NON-PIZZA: Standard behavior (unchanged)
  // e.g., "store123_productId_variantId" or "store123_productId"
  if (item.variantId) {
    return `${storeId}_${item.productId}_${item.variantId}`
  }
  return `${storeId}_${item.productId}`
}

// Helper: Deduct inventory for items within a transaction (for real-time deduction on order creation)
// Uses stable productId + variantId references for inventory lookups (or massType for pizzas)
async function deductInventoryInTransaction(
  transaction: Transaction,
  storeId: string,
  items: OrderItem[]
): Promise<void> {
  console.log("[Inventory:deduct:start]", { storeId, itemsCount: items.length })

  const deductionByInventoryId = new Map<
    string,
    {
      ref: ReturnType<typeof doc>
      quantity: number
      item: OrderItem
    }
  >()

  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      console.warn("[Inventory:deduct:error] Invalid item payload", {
        productId: item.productId,
        quantity: item.quantity,
        item,
      })
      continue
    }

    const isPizza = item.category?.toLowerCase() === 'pizzas' || item.productType === 'pizza'
    if (!isPizza && item.variantName && !item.variantId) {
      console.error("[Inventory:error] Missing variantId for variant item", {
        productId: item.productId,
        productName: item.productName,
        variantName: item.variantName,
        item,
      })
    }

    const invItemId = getInventoryItemId(storeId, item)
    const current = deductionByInventoryId.get(invItemId)

    if (current) {
      current.quantity += item.quantity
    } else {
      deductionByInventoryId.set(invItemId, {
        ref: doc(db, collections.inventoryItems, invItemId),
        quantity: item.quantity,
        item,
      })
    }
  }

  const inventorySnapshots = new Map<string, DocumentSnapshot<DocumentData>>()

  // Firestore transactions require all reads before any writes. Read every
  // inventory document first, then apply the aggregated stock updates below.
  for (const [invItemId, deduction] of deductionByInventoryId) {
    const invDoc: DocumentSnapshot<DocumentData> = await transaction.get(deduction.ref)
    inventorySnapshots.set(invItemId, invDoc)

    console.log("[Inventory:deduct:lookup]", {
      productName: deduction.item.productName,
      variantName: deduction.item.variantName || "default",
      invItemId,
      exists: invDoc.exists(),
    })
  }

  for (const [invItemId, deduction] of deductionByInventoryId) {
    const invDoc = inventorySnapshots.get(invItemId)

    if (!invDoc?.exists()) {
      console.error("[Inventory:deduct:error] Inventory item not found", {
        invItemId,
        productId: deduction.item.productId,
        variantId: deduction.item.variantId,
        storeId,
      })
      throw new Error(`Inventario no encontrado: ${invItemId}`)
    }

    const data = invDoc.data() as InventoryItem
    const currentStock = data?.currentStock

    if (typeof currentStock !== "number" || Number.isNaN(currentStock)) {
      console.error("[Inventory:deduct:error] Invalid currentStock", {
        invItemId,
        currentStock,
        data,
      })
      throw new Error(`Stock inválido para inventario ${invItemId}`)
    }

    const newStock = Math.max(0, currentStock - deduction.quantity)

    console.log("[Inventory:deduct:before]", {
      invItemId,
      productName: deduction.item.productName,
      quantityToDeduct: deduction.quantity,
      currentStock,
    })

    console.log("[Inventory:deduct:after]", {
      invItemId,
      newStock,
    })

    transaction.update(deduction.ref, {
      currentStock: newStock,
      lastUpdated: serverTimestamp(),
    })

    console.log("[Inventory:deduct:success]", {
      invItemId,
      previousStock: currentStock,
      deducted: deduction.quantity,
      newStock,
    })
  }
}

async function restoreInventoryInTransaction(
  transaction: Transaction,
  storeId: string,
  items: OrderItem[]
): Promise<void> {
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) continue
    // Use helper for inventory ID (supports pizza massType pattern)
    const invItemId = getInventoryItemId(storeId, item)
    const invRef = doc(db, collections.inventoryItems, invItemId)
    const invDoc: DocumentSnapshot<DocumentData> = await transaction.get(invRef)
    console.log("[Inventory:lookup]", { mode: "restore", invItemId, itemId: item.id, quantity: item.quantity })
    if (!invDoc.exists()) throw new Error(`Inventario no encontrado para restaurar: ${invItemId}`)
    const data = invDoc.data() as InventoryItem
    const currentStock = data?.currentStock
    if (typeof currentStock !== "number" || Number.isNaN(currentStock)) throw new Error(`Stock inválido para restaurar: ${invItemId}`)
    const newStock = currentStock + item.quantity
    console.log("[Inventory:deduct:before]", { mode: "restore", invItemId, currentStock, quantityToRestore: item.quantity })
    transaction.update(invRef, { currentStock: newStock, lastUpdated: serverTimestamp() })
    console.log("[Inventory:update]", { mode: "restore", invItemId, previousStock: currentStock, newStock })
    console.log("[Inventory:deduct:success]", { mode: "restore", invItemId, restored: item.quantity })
  }
}

// ========== ORDER EDITING WITH AUDIT LOGGING ==========

// Helper: Create consistent audit logs for order edits
async function createOrderAuditLogEntry(
  transaction: Transaction,
  orderId: string,
  storeId: string,
  itemId: string | undefined,
  action: "item_added" | "item_removed" | "item_quantity_changed" | "item_cancelled" | "order_edited",
  userId: string,
  userName: string,
  changes: Record<string, { before: any; after: any }>,
  notes?: string
): Promise<void> {
  const auditRef = doc(collection(db, collections.orderAuditLog))
  transaction.set(auditRef, {
    storeId,
    orderId,
    itemId,
    action,
    userId,
    userName,
    changes,
    timestamp: serverTimestamp(),
    notes,
  } as unknown as OrderAuditLog)
  console.log("[Order:edit:audit]", { action, orderId, itemId, changes })
}

// Main function: Edit order items with full inventory consistency and audit logging
export async function editOrderItemsWithAudit(
  orderId: string,
  updatedItems: OrderItem[],
  userId: string,
  userName: string,
  changeReason: string = "order_item_edit"
): Promise<{ success: boolean; changes: Record<string, any> }> {
  console.log("[Order:edit:start]", { orderId, itemsCount: updatedItems.length })

  return runTransaction(db, async (transaction) => {
    // PHASE 1: FETCH ALL DATA (reads before writes)
    console.log("[Order:edit:validate] Fetching order and items...")
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)

    if (!orderDoc.exists()) {
      throw new Error("Pedido no encontrado")
    }

    const orderData = orderDoc.data() as Order

    // PHASE 2: VALIDATE
    console.log("[Order:edit:validate] Checking payment status...")
    if (orderData.paymentStatus === "paid") {
      throw new Error("No se puede editar un pedido pagado")
    }

    const previousItems = (orderData.items || []) as OrderItem[]
    console.log("[Order:edit:diff] Computing item differences...")

    // Calculate diffs: removed, reduced, increased, added
    const prevById = new Map(previousItems.map((i, idx) => [i.id || `legacy:${idx}`, i]))
    const nextById = new Map(updatedItems.map((i, idx) => [i.id || `legacy:${idx}`, i]))

    const toRestore: OrderItem[] = []
    const toDeduct: OrderItem[] = []
    const auditChanges: Record<string, any> = {}

    // Track items for detailed audit
    const itemsAudit: Array<{
      itemId: string | undefined
      productName: string
      before: { quantity: number; total: number }
      after: { quantity: number; total: number }
      delta: number
    }> = []

    // Process existing items
    for (const [key, prev] of prevById) {
      const next = nextById.get(key)

      if (!next || next.cancelled) {
        // Item removed or cancelled
        console.log("[Order:edit:diff] Item removed or cancelled", {
          itemId: key,
          productName: prev.productName,
          quantity: prev.quantity,
        })
        toRestore.push({ ...prev, quantity: prev.quantity })
        itemsAudit.push({
          itemId: prev.id,
          productName: prev.productName,
          before: { quantity: prev.quantity, total: prev.price * prev.quantity },
          after: { quantity: 0, total: 0 },
          delta: -prev.quantity,
        })
      } else if (next.quantity < prev.quantity) {
        // Quantity reduced
        const quantityDelta = prev.quantity - next.quantity
        console.log("[Order:edit:diff] Item quantity reduced", {
          itemId: key,
          productName: prev.productName,
          before: prev.quantity,
          after: next.quantity,
          delta: quantityDelta,
        })
        toRestore.push({ ...prev, quantity: quantityDelta })
        itemsAudit.push({
          itemId: prev.id,
          productName: prev.productName,
          before: { quantity: prev.quantity, total: prev.price * prev.quantity },
          after: { quantity: next.quantity, total: next.price * next.quantity },
          delta: -quantityDelta,
        })
      } else if (next.quantity > prev.quantity) {
        // Quantity increased
        const quantityDelta = next.quantity - prev.quantity
        console.log("[Order:edit:diff] Item quantity increased", {
          itemId: key,
          productName: prev.productName,
          before: prev.quantity,
          after: next.quantity,
          delta: quantityDelta,
        })
        toDeduct.push({ ...next, quantity: quantityDelta })
        itemsAudit.push({
          itemId: prev.id,
          productName: prev.productName,
          before: { quantity: prev.quantity, total: prev.price * prev.quantity },
          after: { quantity: next.quantity, total: next.price * next.quantity },
          delta: quantityDelta,
        })
      }
    }

    // Process new items
    for (const [key, next] of nextById) {
      if (!prevById.has(key) && !next.cancelled) {
        console.log("[Order:edit:diff] New item added", {
          itemId: key,
          productName: next.productName,
          quantity: next.quantity,
        })
        toDeduct.push(next)
        itemsAudit.push({
          itemId: next.id,
          productName: next.productName,
          before: { quantity: 0, total: 0 },
          after: { quantity: next.quantity, total: next.price * next.quantity },
          delta: next.quantity,
        })
      }
    }

    // PHASE 3: CHECK DELIVERED ITEMS
    console.log("[Order:edit:validate] Checking for delivered items...")
    for (const item of previousItems) {
      if (item.status === "delivered") {
        const nextItem = nextById.get(item.id || `legacy:${previousItems.indexOf(item)}`)
        if (!nextItem || nextItem.cancelled || nextItem.quantity !== item.quantity) {
          throw new Error("No se puede remover o modificar item entregado")
        }
      }
    }

    // PHASE 4: APPLY INVENTORY CHANGES
    console.log("[Order:edit:inventory] Applying inventory changes...")
    if (toRestore.length > 0) {
      await restoreInventoryInTransaction(transaction, orderData.storeId, toRestore)
    }
    if (toDeduct.length > 0) {
      await deductInventoryInTransaction(transaction, orderData.storeId, toDeduct)
    }

    // PHASE 5: RECALCULATE TOTAL
    const normalizedItems = cleanItems(updatedItems)
    const newTotal = normalizedItems
      .filter((i) => !i.cancelled)
      .reduce((sum, i) => sum + i.price * i.quantity, 0)

    console.log("[Order:edit:total]", {
      previousTotal: orderData.total,
      newTotal,
      difference: newTotal - orderData.total,
    })

    // PHASE 6: UPDATE ORDER
    transaction.update(orderRef, {
      items: normalizedItems,
      total: newTotal,
      updatedAt: serverTimestamp(),
    })

    // PHASE 7: CREATE AUDIT LOG
    auditChanges.total = { before: orderData.total, after: newTotal }
    auditChanges.itemCount = { before: previousItems.length, after: normalizedItems.length }
    auditChanges.itemsModified = itemsAudit

    await createOrderAuditLogEntry(
      transaction,
      orderId,
      orderData.storeId,
      undefined,
      "order_edited",
      userId,
      userName,
      auditChanges,
      `Reason: ${changeReason}. ${toRestore.length} items restored, ${toDeduct.length} items deducted`
    )

    console.log("[Order:edit:success]", {
      orderId,
      previousTotal: orderData.total,
      newTotal,
      itemsRestored: toRestore.length,
      itemsDeducted: toDeduct.length,
    })

    return {
      success: true,
      changes: {
        previousTotal: orderData.total,
        newTotal,
        itemsModified: itemsAudit.length,
        itemsRestored: toRestore.length,
        itemsDeducted: toDeduct.length,
      },
    }
  })
}

// Dedicated function: Remove a single order item
export async function removeOrderItem(
  orderId: string,
  itemId: string,
  userId: string,
  userName: string,
  reason: string = "user_request"
): Promise<void> {
  console.log("[Order:remove:start]", { orderId, itemId })

  return runTransaction(db, async (transaction) => {
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)

    if (!orderDoc.exists()) {
      throw new Error("Pedido no encontrado")
    }

    const orderData = orderDoc.data() as Order

    if (orderData.paymentStatus === "paid") {
      throw new Error("No se puede editar un pedido pagado")
    }

    const items = orderData.items || []
    const itemIndex = items.findIndex((i, idx) => (i.id || `legacy:${idx}`) === itemId)

    if (itemIndex === -1) {
      throw new Error("Item no encontrado")
    }

    const itemToRemove = items[itemIndex]

    if (itemToRemove.status === "delivered") {
      throw new Error("No se puede remover item entregado")
    }

    console.log("[Order:remove:restore]", {
      productName: itemToRemove.productName,
      quantity: itemToRemove.quantity,
    })

    // Restore inventory
    await restoreInventoryInTransaction(transaction, orderData.storeId, [itemToRemove])

    // Remove item from array
    const updatedItems = items.map((item, idx) => {
      const cid = item.id || `legacy:${idx}`
      if (cid === itemId && !item.cancelled) {
        return cleanUndefined({
          ...item,
          cancelled: true,
          cancelReason: reason,
          updatedAt: new Date(),
        } as unknown as Record<string, unknown>) as unknown as OrderItem
      }
      return item
    })

    const previousTotal = orderData.total
    const newTotal = updatedItems
      .filter((item) => !item.cancelled)
      .reduce((sum, item) => sum + item.price * item.quantity, 0)

    // Update order
    transaction.update(orderRef, {
      items: updatedItems,
      total: newTotal,
      updatedAt: serverTimestamp(),
    })

    // Create audit log
    await createOrderAuditLogEntry(
      transaction,
      orderId,
      orderData.storeId,
      itemToRemove.id,
      "item_removed",
      userId,
      userName,
      {
        productName: itemToRemove.productName,
        quantity: { before: itemToRemove.quantity, after: 0 },
        lineTotal: {
          before: itemToRemove.price * itemToRemove.quantity,
          after: 0,
        },
        orderTotal: { before: previousTotal, after: newTotal },
      },
      reason
    )

    console.log("[Order:remove:success]", {
      itemId,
      productName: itemToRemove.productName,
      quantityRestored: itemToRemove.quantity,
      totalDelta: newTotal - previousTotal,
    })
  })
}

// Dedicated function: Update quantity of a single order item
export async function updateOrderItemQuantity(
  orderId: string,
  itemId: string,
  newQuantity: number,
  userId: string,
  userName: string,
  reason: string = "user_request"
): Promise<void> {
  console.log("[Order:quantity:start]", { orderId, itemId, newQuantity })

  if (newQuantity <= 0) {
    throw new Error("La cantidad debe ser mayor a 0")
  }

  return runTransaction(db, async (transaction) => {
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)

    if (!orderDoc.exists()) {
      throw new Error("Pedido no encontrado")
    }

    const orderData = orderDoc.data() as Order

    if (orderData.paymentStatus === "paid") {
      throw new Error("No se puede editar un pedido pagado")
    }

    const items = orderData.items || []
    const itemIndex = items.findIndex((i, idx) => (i.id || `legacy:${idx}`) === itemId)

    if (itemIndex === -1) {
      throw new Error("Item no encontrado")
    }

    const itemToUpdate = items[itemIndex]
    const oldQuantity = itemToUpdate.quantity
    const quantityDelta = newQuantity - oldQuantity

    if (itemToUpdate.status === "delivered") {
      throw new Error("No se puede modificar item entregado")
    }

    console.log("[Order:quantity:diff]", {
      productName: itemToUpdate.productName,
      oldQuantity,
      newQuantity,
      delta: quantityDelta,
    })

    // Handle inventory delta
    if (quantityDelta < 0) {
      // Reduce quantity - restore inventory
      const toRestore = { ...itemToUpdate, quantity: Math.abs(quantityDelta) }
      await restoreInventoryInTransaction(transaction, orderData.storeId, [toRestore])
      console.log("[Order:quantity:inventory] Restoring inventory", { quantity: Math.abs(quantityDelta) })
    } else if (quantityDelta > 0) {
      // Increase quantity - deduct inventory
      const toDeduct = { ...itemToUpdate, quantity: quantityDelta }
      await deductInventoryInTransaction(transaction, orderData.storeId, [toDeduct])
      console.log("[Order:quantity:inventory] Deducting inventory", { quantity: quantityDelta })
    }

    // Update item quantity
    const updatedItems = items.map((item, idx) => {
      const cid = item.id || `legacy:${idx}`
      if (cid === itemId) {
        return cleanUndefined({
          ...item,
          quantity: newQuantity,
          updatedAt: new Date(),
        } as unknown as Record<string, unknown>) as unknown as OrderItem
      }
      return item
    })

    const previousTotal = orderData.total
    const newTotal = updatedItems
      .filter((item) => !item.cancelled)
      .reduce((sum, item) => sum + item.price * item.quantity, 0)

    // Update order
    transaction.update(orderRef, {
      items: updatedItems,
      total: newTotal,
      updatedAt: serverTimestamp(),
    })

    // Create audit log
    await createOrderAuditLogEntry(
      transaction,
      orderId,
      orderData.storeId,
      itemToUpdate.id,
      "item_quantity_changed",
      userId,
      userName,
      {
        productName: itemToUpdate.productName,
        quantity: { before: oldQuantity, after: newQuantity },
        lineTotal: {
          before: itemToUpdate.price * oldQuantity,
          after: itemToUpdate.price * newQuantity,
        },
        orderTotal: { before: previousTotal, after: newTotal },
        inventoryDelta: quantityDelta,
      },
      reason
    )

    console.log("[Order:quantity:success]", {
      itemId,
      productName: itemToUpdate.productName,
      quantityChange: quantityDelta,
      totalDelta: newTotal - previousTotal,
    })
  })
}

// Create order with transaction (validates table availability)
export async function createOrderTransaction(
  storeId: string,
  tableId: string,
  tableNumber: number,
  items: OrderItem[],
  total: number,
  userId: string,
  userName: string
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    // 1. Get and validate table
    const tableRef = doc(db, collections.tables, tableId)
    const tableDoc = await transaction.get(tableRef)

    if (!tableDoc.exists()) {
      throw new Error("Mesa no encontrada")
    }

    const tableData = tableDoc.data() as Table
    
    // Check if table already has an active order (is occupied)
    if (tableData.status === "occupied" && tableData.currentOrderId) {
      throw new Error("La mesa ya tiene un pedido activo")
    }

    // 2. Create the order
    const orderRef = doc(collection(db, collections.orders))
    const orderData = {
      storeId,
      tableId,
      tableNumber,
      items: cleanItems(items),
      total,
      status: "open" as const,
      paymentStatus: "pending" as const,
      userId,
      userName,
      createdAt: serverTimestamp(),
    }

    // 3. Deduct inventory BEFORE any writes (reads must be before writes in transaction)
    await deductInventoryInTransaction(transaction, storeId, items)

    // Now do all writes
    transaction.set(orderRef, orderData)

    // 4. Update table status to occupied
    transaction.update(tableRef, {
      status: "occupied",
      currentOrderId: orderRef.id,
      updatedAt: serverTimestamp(),
    })

    return orderRef.id
  })
}

// Add items to existing order
export async function addItemsToOrder(
  orderId: string,
  newItems: OrderItem[],
  newTotal: number
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)

    if (!orderDoc.exists()) {
      throw new Error("Pedido no encontrado")
    }

    const orderData = orderDoc.data() as Order

    if (orderData.paymentStatus === "paid") {
      throw new Error("No se puede modificar un pedido ya pagado")
    }

    // Merge items (clean newItems to remove undefined fields)
    const existingItems = orderData.items || []
    const normalizedNewItems = cleanItems(newItems).map((item) => ({
      ...item,
      id: item.id || doc(collection(db, "_")).id,
    }))
    const updatedItems = [...existingItems, ...normalizedNewItems]
    const updatedTotal = orderData.total + newTotal

    // Deduct inventory BEFORE writes (reads must be before writes in transaction)
    await deductInventoryInTransaction(transaction, orderData.storeId, normalizedNewItems)

    // Now do the write
    transaction.update(orderRef, {
      items: updatedItems,
      total: updatedTotal,
      status: "open",
      updatedAt: serverTimestamp(),
    })
  })
}

export async function updateOpenOrderItems(
  orderId: string,
  updatedItems: OrderItem[],
  userId: string,
  userName: string,
  reason: string = "order_item_edit"
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)
    if (!orderDoc.exists()) throw new Error("Pedido no encontrado")
    const orderData = orderDoc.data() as Order
    if (orderData.paymentStatus === "paid") throw new Error("No se puede editar un pedido pagado")

    const previousItems = (orderData.items || []) as OrderItem[]
    const prevById = new Map(previousItems.map((i, idx) => [i.id || `legacy:${idx}`, i]))
    const nextById = new Map(updatedItems.map((i, idx) => [i.id || `legacy:${idx}`, i]))
    const toRestore: OrderItem[] = []
    const toDeduct: OrderItem[] = []

    for (const [key, prev] of prevById) {
      const next = nextById.get(key)
      if (!next || next.cancelled) toRestore.push({ ...prev, quantity: prev.quantity })
      else if (next.quantity < prev.quantity) toRestore.push({ ...prev, quantity: prev.quantity - next.quantity })
      else if (next.quantity > prev.quantity) toDeduct.push({ ...next, quantity: next.quantity - prev.quantity })
    }
    for (const [key, next] of nextById) if (!prevById.has(key) && !next.cancelled) toDeduct.push(next)

    await restoreInventoryInTransaction(transaction, orderData.storeId, toRestore)
    await deductInventoryInTransaction(transaction, orderData.storeId, toDeduct)

    const normalizedItems = cleanItems(updatedItems)
    const newTotal = normalizedItems.filter((i) => !i.cancelled).reduce((sum, i) => sum + i.price * i.quantity, 0)
    transaction.update(orderRef, { items: normalizedItems, total: newTotal, updatedAt: serverTimestamp() })

    const auditRef = doc(collection(db, collections.orderAuditLog))
    transaction.set(auditRef, {
      storeId: orderData.storeId,
      orderId,
      action: "item_removed",
      userId,
      userName,
      changes: { total: { before: orderData.total, after: newTotal }, itemCount: { before: previousItems.length, after: normalizedItems.length } },
      notes: reason,
      timestamp: serverTimestamp(),
    } as unknown as OrderAuditLog)
  })
}

// Mark specific items as sent to kitchen (Phase 1 fix for duplicate items)
export async function sendItemsToKitchen(
  orderId: string,
  itemIds: string[] // Stable item identifiers (with legacy fallback: legacy:<index>)
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)

    if (!orderDoc.exists()) {
      throw new Error("Pedido no encontrado")
    }

    const orderData = orderDoc.data() as Order

    // Mark specific items as sent with timestamp
    const currentItems = orderData.items || []
    const updatedItems = currentItems.map((item, index) => {
      const legacyId = `legacy:${index}`
      if (itemIds.includes(item.id || "") || itemIds.includes(legacyId)) {
        return cleanUndefined({
          ...item,
          sentAt: item.sentAt || new Date(), // Firestore does not allow serverTimestamp inside arrays
          sentCount: (item.sentCount || 0) + 1,
          cancelAcknowledgedAt: item.cancelled ? (item.cancelAcknowledgedAt || new Date()) : item.cancelAcknowledgedAt,
        } as unknown as Record<string, unknown>) as unknown as OrderItem
      }
      return item
    })

    transaction.update(orderRef, {
      items: updatedItems,
      updatedAt: serverTimestamp(),
    })
  })
}

// Cancel specific items without deleting history
export async function cancelOrderItems(
  orderId: string,
  itemIds: string[],
  reason: string,
  userId: string = "system",
  userName: string = "system"
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)
    if (!orderDoc.exists()) throw new Error("Pedido no encontrado")

    const orderData = orderDoc.data() as Order
    if (orderData.paymentStatus === "paid") throw new Error("No se puede editar/cancelar un pedido pagado")
    const items = orderData.items || []
    const toRestore = items.filter((item, index) => {
      const legacyId = `legacy:${index}`
      const selected = itemIds.includes(item.id || "") || itemIds.includes(legacyId)
      return selected && !item.cancelled
    })

    const updatedItems = items.map((item, index) => {
      const legacyId = `legacy:${index}`
      if (!itemIds.includes(item.id || "") && !itemIds.includes(legacyId)) return item
      if (item.status === "delivered") throw new Error("No se puede cancelar item entregado")
      return cleanUndefined({
        ...item,
        cancelled: true,
        cancelReason: reason,
        updatedAt: new Date(),
      } as unknown as Record<string, unknown>) as unknown as OrderItem
    })

    const updatedTotal = updatedItems
      .filter((item) => !item.cancelled)
      .reduce((sum, item) => sum + item.price * item.quantity, 0)

    await restoreInventoryInTransaction(transaction, orderData.storeId, toRestore)

    transaction.update(orderRef, {
      items: updatedItems,
      total: updatedTotal,
      updatedAt: serverTimestamp(),
    })

    const auditRef = doc(collection(db, collections.orderAuditLog))
    transaction.set(auditRef, {
      storeId: orderData.storeId,
      orderId,
      action: "item_cancelled",
      userId,
      userName,
      changes: {
        itemIds: { before: toRestore.map((i) => i.id || null), after: [] },
        quantities: { before: toRestore.map((i) => i.quantity), after: toRestore.map(() => 0) },
        total: { before: orderData.total, after: updatedTotal },
      },
      notes: reason,
      timestamp: serverTimestamp(),
    } as unknown as OrderAuditLog)
  })
}

// Get only unsent items from an order (for kitchen display)
export function getUnsentItems(order: Order): OrderItem[] {
  if (!order.items) return []
  return order.items.filter((item) => !item.sentAt)
}
export async function processPaymentTransaction(
  orderId: string,
  tableId: string,
  payments: Payment[],
  orderTotal: number,
  cashRegisterId: string,
  storeId?: string // Optional: if provided, updates operational balance
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // PHASE 1: GET ALL DATA (reads must come first)
    
    // 1. Get and validate order
    const orderRef = doc(db, collections.orders, orderId)
    const orderDoc = await transaction.get(orderRef)

    if (!orderDoc.exists()) {
      throw new Error("Pedido no encontrado")
    }

    const orderData = orderDoc.data() as Order
    const actualStoreId = storeId || orderData.storeId

    // 2. Get table
    const tableRef = doc(db, collections.tables, tableId)
    const tableDoc = await transaction.get(tableRef)

    // 3. Get operational balance if cash payment (inventory already deducted at order creation)
    const cashPaymentAmount = payments
      .filter(p => p.method === "cash")
      .reduce((sum, p) => sum + p.amount, 0)

    let opBalanceSnap
    let opBalanceRef
    if (cashPaymentAmount > 0 && actualStoreId) {
      const opBalanceId = `${actualStoreId}_operational`
      opBalanceRef = doc(db, collections.cashBoxBalances, opBalanceId)
      opBalanceSnap = await transaction.get(opBalanceRef)
    }

    // PHASE 2: VALIDATE ALL DATA (after all reads)

    if (orderData.paymentStatus === "paid") {
      throw new Error("Este pedido ya fue pagado")
    }

    // 5. Validate payment amount
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    if (Math.abs(totalPaid - orderTotal) > 0.01) {
      throw new Error(`El monto pagado (${totalPaid.toFixed(2)}) no coincide con el total (${orderTotal.toFixed(2)})`)
    }

    // 6. Determine payment method
    let paymentMethod: PaymentMethod | "mixed" = "cash"
    if (payments.length === 1) {
      paymentMethod = payments[0].method
    } else if (payments.length > 1) {
      paymentMethod = "mixed"
    }

    // PHASE 3: WRITE ALL DATA (after all reads and validations)

    // 7. Update order to paid (link to cash register session)
    transaction.update(orderRef, {
      paymentStatus: "paid",
      status: "paid",
      paymentMethod,
      payments,
      cashRegisterId,
      updatedAt: serverTimestamp(),
    })

    // 8. Update table to available
    transaction.update(tableRef, {
      status: "available",
      currentOrderId: null,
      updatedAt: serverTimestamp(),
    })

    // 9. Update operational balance if cash payment (for cash register tracking)
    if (cashPaymentAmount > 0 && actualStoreId && opBalanceRef && opBalanceSnap) {
      if (opBalanceSnap.exists()) {
        const currentBalance = (opBalanceSnap.data() as CashBoxBalance).balance || 0
        transaction.update(opBalanceRef, {
          balance: currentBalance + cashPaymentAmount,
          lastUpdated: serverTimestamp(),
        })
      } else {
        // Initialize operational balance if it doesn't exist
        transaction.set(opBalanceRef, {
          storeId: actualStoreId,
          type: "operational" as const,
          balance: cashPaymentAmount,
          updatedAt: serverTimestamp(),
        })
      }
    }

    // Inventory is deducted in real-time when order items are created (in createOrderTransaction and addItemsToOrder)
    // No deduction needed here during payment
  })
}

// ========== INVENTORY FUNCTIONS ==========

// Get inventory for a store
export async function getStoreInventory(storeId: string): Promise<InventoryItem[]> {
  return getDocuments<InventoryItem>(
    collections.inventoryItems,
    where("storeId", "==", storeId)
  )
}

// Subscribe to inventory in real-time
export function subscribeToStoreInventory(
  storeId: string,
  callback: (items: InventoryItem[]) => void
): () => void {
  const q = query(
    collection(db, collections.inventoryItems),
    where("storeId", "==", storeId)
  )
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as InventoryItem))
    callback(items)
  })
}

// Update inventory item manually
export async function updateInventoryItem(
  storeId: string,
  productId: string,
  variantName: string | null,
  newStock: number,
  userId: string,
  userName: string
): Promise<void> {
  const invId = `${storeId}_${productId}_${variantName || "default"}`
  const invRef = doc(db, collections.inventoryItems, invId)
  
  await updateDoc(invRef, {
    currentStock: Math.max(0, newStock),
    lastUpdated: serverTimestamp(),
  })
}

// Initialize inventory for a product
export async function initializeInventoryItem(
  storeId: string,
  productId: string,
  productName: string,
  variantName: string | null,
  initialStock: number = 0
): Promise<void> {
  const invId = `${storeId}_${productId}_${variantName || "default"}`
  const invRef = doc(db, collections.inventoryItems, invId)
  
  await setDoc(invRef, {
    storeId,
    productId,
    productName,
    variantName: variantName || null,
    currentStock: initialStock,
    lastUpdated: serverTimestamp(),
    createdAt: serverTimestamp(),
  } as InventoryItem, { merge: true })
}

// Auto-create inventory items for gaseosas when a product is created/updated
// Safe: if creation fails, doesn't block product save
/**
 * Migration function: Delete old inventory items and rebuild from products
 * Call this ONCE when upgrading to the new variant-based system
 */
export async function rebuildInventoryFromProducts(storeId: string): Promise<void> {
  try {
    console.log("[Inventory:migration] Starting rebuild for store:", storeId)

    // Step 1: Delete all old inventory items for this store
    console.log("[Inventory:migration] Deleting old inventory items...")
    const oldInvQuery = query(
      collection(db, collections.inventoryItems),
      where("storeId", "==", storeId)
    )
    const oldInvDocs = await getDocs(oldInvQuery)
    let deletedCount = 0
    for (const oldDoc of oldInvDocs.docs) {
      await deleteDoc(doc(db, collections.inventoryItems, oldDoc.id))
      deletedCount++
    }
    console.log(`[Inventory:migration] Deleted ${deletedCount} old inventory items`)

    // Step 2: Get all products for this store
    console.log("[Inventory:migration] Loading products...")
    const productsQuery = query(
      collection(db, collections.products),
      where("storeId", "==", storeId)
    )
    const productsDocs = await getDocs(productsQuery)
    console.log(`[Inventory:migration] Found ${productsDocs.docs.length} products`)

    // Step 3: Recreate inventory items from products
    let createdCount = 0
    for (const productDoc of productsDocs.docs) {
      const product = productDoc.data() as Product
      try {
        await ensureInventoryItemsForProduct(storeId, product)
        createdCount++
      } catch (err) {
        console.warn("[Inventory:migration] Error processing product:", product.name, err)
      }
    }

    console.log(`[Inventory:migration] Rebuild complete. Created inventory for ${createdCount} products`)
  } catch (error) {
    console.error("[Inventory:migration] Migration failed:", error)
    throw error
  }
}

// ========== PIZZA CONFIG FUNCTIONS ==========

// Get default pizza config with standard prices
export function getDefaultPizzaConfig(storeId: string): PizzaConfig {
  return {
    storeId,
    sizes: {
      PERSONAL: { price: 18, available: true },
      BIPERSONAL: { price: 28, available: true },
      FAMILIAR: { price: 45, available: true },
      GIGANTE: { price: 65, available: true },
      SUPER_GIGANTE: { price: 85, available: true },
    },
    flavors: [
      'Americana',
      'Pepperoni',
      'Hawaiana',
      'Suprema',
      'Vegetariana',
      'Carnes',
      'Pollo BBQ',
      'Cuatro Quesos',
    ],
    active: true,
  }
}

// Legacy pizza config lookup (does not create documents)
export async function getPizzaConfig(storeId: string): Promise<PizzaConfig> {
  const configId = `pizza_config_${storeId}`
  const docRef = doc(db, collections.pizzaConfig, configId)
  const docSnap = await getDoc(docRef)
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as PizzaConfig
  }
  
  // Legacy compatibility only: do not create pizza_config documents.
  // Pizza flavors are products in category "pizzas" and their prices live in Product.priceMap.
  return { id: configId, ...getDefaultPizzaConfig(storeId), active: false }
}

// Legacy pizza config subscription (does not create documents)
export function subscribeToPizzaConfig(
  storeId: string,
  callback: (config: PizzaConfig | null) => void
): () => void {
  const configId = `pizza_config_${storeId}`
  const docRef = doc(db, collections.pizzaConfig, configId)
  
  return onSnapshot(docRef, async (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as PizzaConfig)
    } else {
      // Legacy compatibility only: do not create pizza_config documents.
      callback(null)
    }
  })
}

// Update pizza config (sizes/prices or flavors)
export async function updatePizzaConfig(
  storeId: string,
  updates: Partial<Omit<PizzaConfig, 'id' | 'storeId'>>
): Promise<void> {
  const configId = `pizza_config_${storeId}`
  const docRef = doc(db, collections.pizzaConfig, configId)
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

// Initialize the 5 operational pizza inventory items for a store
// These are the ONLY pizza inventory products: PZ-PER, PZ-BIP, PZ-FAM, PZ-GIG, PZ-SGI
export async function initializePizzaInventory(storeId: string, initialStock: number = 15): Promise<void> {
  const batch = writeBatch(db)
  
  for (const massType of PIZZA_MASS_TYPES) {
    const invCode = PIZZA_INVENTORY_CODES[massType]
    const invItemId = `${storeId}_pizzamass_${massType}`
    const docRef = doc(db, collections.inventoryItems, invItemId)
    
    // Check if already exists
    const existing = await getDoc(docRef)
    if (!existing.exists()) {
      batch.set(docRef, {
        id: invItemId,
        storeId,
        productId: invCode, // Use inventory code as productId
        productName: `Masa ${PIZZA_SIZE_LABELS[massType]}`,
        variantId: massType,
        variantName: PIZZA_SIZE_LABELS[massType],
        category: 'pizzas',
        currentStock: initialStock,
        minStock: 10,
        status: 'normal',
        lastUpdated: serverTimestamp(),
        isActive: true,
        isPizzaMass: true, // Flag to identify pizza mass items
        massType: massType,
        inventoryCode: invCode, // e.g., "PZ-FAM"
      })
      console.log(`[Pizza:inventory] Created ${invCode} for store ${storeId}`)
    }
  }
  
  await batch.commit()
  console.log(`[Pizza:inventory] Initialized 5 pizza inventory items for store ${storeId}`)
}

export async function ensureInventoryItemsForProduct(
  storeId: string,
  product: Product
): Promise<void> {
  try {
    if (!storeId || !product || !product.id) {
      console.warn("[Inventory:create] Missing storeId or product")
      return
    }

    // SPECIAL CASE: Skip pizzas - they use 5 fixed operational inventory products
    // Pizza inventory is managed by initializePizzaInventory(), not per-flavor
    if (product.category?.toLowerCase() === 'pizzas') {
      console.log("[Inventory:create] Skipping pizza flavor - uses fixed operational inventory")
      return
    }

    // If product has variants, create ONE inventory_item PER VARIANT
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        try {
          if (!variant.id || !variant.name) {
            console.warn("[Inventory:create] Variant missing id or name:", variant)
            continue
          }

          // Exact ID format: storeId_productId_variantId
          const inventoryId = `${storeId}_${product.id}_${variant.id}`
          const invRef = doc(db, collections.inventoryItems, inventoryId)

          // Create inventory item for this specific variant
          await setDoc(invRef, {
            storeId,
            productId: product.id,
            variantId: variant.id, // MUST include variantId
            productName: product.name,
            variantName: variant.name, // Display name
            currentStock: 0, // Start at 0, will be updated manually
            lastUpdated: serverTimestamp(),
            createdAt: serverTimestamp(),
          } as InventoryItem, { merge: true })

          console.log("[Inventory:create]", { inventoryId, productId: product.id, variantId: variant.id, productName: product.name, variantName: variant.name })
        } catch (err) {
          console.warn(`[Inventory:error] Failed to create inventory for variant:`, variant?.name, err)
        }
      }
    } else {
      // No variants - create single inventory_item for the product
      if (!product.id) {
        return
      }

      const inventoryId = `${storeId}_${product.id}`
      const invRef = doc(db, collections.inventoryItems, inventoryId)

      await setDoc(invRef, {
        storeId,
        productId: product.id,
        // No variantId for non-variant products
        productName: product.name,
        currentStock: 0,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
      } as InventoryItem, { merge: true })

      console.log("[Inventory:create]", { inventoryId, productId: product.id, variantId: null, productName: product.name })
    }
  } catch (error) {
    console.warn("[Inventory:error] ensureInventoryItemsForProduct failed:", error)
  }
}

// Deduct inventory automatically based on category and variants
// Safe and optional: called AFTER payment transaction completes
// Never blocks or fails payments
export async function deductInventoryForOrderItem(
  storeId: string,
  item: OrderItem
): Promise<void> {
  try {
    // Validate inputs - exit early if missing
    if (!storeId || !item || !db) {
      console.warn("[Inventory] Missing storeId, item, or db")
      return
    }

    // Validate collections object exists
    if (!collections || !collections.inventoryItems) {
      console.warn("[Inventory] Collections not initialized")
      return
    }

    // Build stable inventory lookup ID: storeId_productId_variantId
    // If no variantId (single-variant product), just use storeId_productId
    const invItemId = item.variantId
      ? `${storeId}_${item.productId}_${item.variantId}`
      : `${storeId}_${item.productId}`
    
    // If we determined an inventory item to deduct, try to update it
    // Safe: if inventory doesn't exist, skip and continue
    if (item.quantity && item.quantity > 0) {
      console.log("[Inventory:lookup]", {
        productName: item.productName,
        variantName: item.variantName || "default",
        invItemId,
        productId: item.productId,
        variantId: item.variantId ?? null,
      })
      
      try {
        const invRef = doc(db, collections.inventoryItems, invItemId)
        
        // Try to get the inventory item
        const invDoc = await getDoc(invRef)
        
        // Only update if inventory item exists
        // If it doesn't exist, silently skip - allow payment to continue
        if (invDoc && typeof invDoc.exists === "function" && invDoc.exists()) {
          const data = invDoc.data() as InventoryItem | undefined
          if (data) {
            const currentStock = data.currentStock
            if (typeof currentStock !== "number" || Number.isNaN(currentStock)) {
              console.error("[Inventory:error] Invalid currentStock", { invItemId, currentStock, data })
              return
            }
            const newStock = Math.max(0, currentStock - item.quantity)

            console.log("[Inventory:deduct:before]", { invItemId, currentStock, quantityToDeduct: item.quantity })
            await updateDoc(invRef, {
              currentStock: newStock,
              lastUpdated: serverTimestamp(),
            })
            console.log("[Inventory:update]", { invItemId, previousStock: currentStock, newStock })
            console.log("[Inventory:deduct:after]", { invItemId, newStock })
            console.log("[Inventory:deduct:success]", { invItemId, deducted: item.quantity })
          }
        } else {
          console.error("[Inventory:error] Item not found", { invItemId })
        }
        // If inventory doesn't exist: do nothing, payment already completed
      } catch (docError) {
        // Firestore operation failed - log but don't throw
        console.error("[Inventory:error] Firestore operation error", { productName: item?.productName, error: docError })
      }
    } else {
      console.warn(`[Inventory:warning] No quantity to deduct for: ${item.productName}`)
    }
  } catch (error) {
    // Log error but don't throw - payment already completed successfully
    console.warn("[Inventory] Error deducting inventory for item:", item?.productName, error)
    // Silently continue - inventory is optional
  }
}

export async function getActiveOrderForTable(tableId: string): Promise<Order | null> {
  const orders = await getDocuments<Order>(
    collections.orders,
    where("tableId", "==", tableId),
    where("paymentStatus", "==", "pending")
  )
  const active = orders.find((o) => !o.cancelled && o.status !== "cancelled")
  return active || null
}

// Get daily report
export async function getDailyReport(storeId: string, date: string): Promise<DailyReport | null> {
  const reports = await getDocuments<DailyReport>(
    collections.dailyReports,
    where("storeId", "==", storeId),
    where("date", "==", date)
  )
  return reports.length > 0 ? reports[0] : null
}

// Subscribe to paid orders for reports (real-time)
export function subscribeToPaidOrdersForReports(
  storeId: string,
  callback: (orders: Order[]) => void
): () => void {
  const q = query(
    collection(db, collections.orders),
    where("storeId", "==", storeId),
    where("paymentStatus", "==", "paid")
  )
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Order))
      .sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0
        const timeB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0
        return timeB - timeA
      })
    callback(orders)
  })
}

// Calculate report data from paid orders with date filtering
export function calculateReportFromOrders(
  orders: Order[],
  startDate: Date,
  endDate: Date
): {
  cashSales: number
  cardSales: number
  yapeSales: number
  totalSales: number
  ordersCount: number
  ordersByDay: Map<string, Order[]>
} {
  let cashSales = 0
  let cardSales = 0
  let yapeSales = 0
  const ordersByDay = new Map<string, Order[]>()

  // Filter orders by date range using updatedAt (when payment was made)
  const filteredOrders = orders.filter((order) => {
    const orderDate = order.updatedAt?.toDate?.() || order.createdAt?.toDate?.()
    if (!orderDate) return false
    return orderDate >= startDate && orderDate <= endDate
  })

  for (const order of filteredOrders) {
    // Calculate sales by payment method
    if (order.payments && order.payments.length > 0) {
      for (const payment of order.payments) {
        switch (payment.method) {
          case "cash":
            cashSales += payment.amount
            break
          case "card":
            cardSales += payment.amount
            break
          case "yape":
            yapeSales += payment.amount
            break
        }
      }
    }

    // Group by day using Peru timezone
    const orderDate = order.updatedAt?.toDate?.() || order.createdAt?.toDate?.()
    if (orderDate) {
      // Convert to Peru timezone for grouping
      const peruDate = new Date(orderDate.toLocaleString("en-US", { timeZone: "America/Lima" }))
      const year = peruDate.getFullYear()
      const month = String(peruDate.getMonth() + 1).padStart(2, '0')
      const day = String(peruDate.getDate()).padStart(2, '0')
      const dayKey = `${year}-${month}-${day}`
      if (!ordersByDay.has(dayKey)) {
        ordersByDay.set(dayKey, [])
      }
      ordersByDay.get(dayKey)!.push(order)
    }
  }

  return {
    cashSales,
    cardSales,
    yapeSales,
    totalSales: cashSales + cardSales + yapeSales,
    ordersCount: filteredOrders.length,
    ordersByDay,
  }
}

// Update or create daily report
export async function updateDailyReport(
  storeId: string,
  date: string,
  saleAmount: number,
  paymentMethod: "efectivo" | "tarjeta" | "mixto",
  paymentDetails?: { efectivo?: number; tarjeta?: number }
): Promise<void> {
  const existingReport = await getDailyReport(storeId, date)

  let cashAmount = 0
  let cardAmount = 0

  if (paymentMethod === "efectivo") {
    cashAmount = saleAmount
  } else if (paymentMethod === "tarjeta") {
    cardAmount = saleAmount
  } else if (paymentMethod === "mixto" && paymentDetails) {
    cashAmount = paymentDetails.efectivo || 0
    cardAmount = paymentDetails.tarjeta || 0
  }

  if (existingReport && existingReport.id) {
    await updateDocument(collections.dailyReports, existingReport.id, {
      totalSales: existingReport.totalSales + saleAmount,
      ordersCount: existingReport.ordersCount + 1,
      cashSales: existingReport.cashSales + cashAmount,
      cardSales: existingReport.cardSales + cardAmount,
    })
  } else {
    await addDocument(collections.dailyReports, {
      storeId,
      date,
      totalSales: saleAmount,
      ordersCount: 1,
      cashSales: cashAmount,
      cardSales: cardAmount,
    })
  }
}

// Recalculate and update cash register when an order is deleted
export async function recalculateCashRegisterAfterOrderDeletion(
  cashClosureId: string,
  initialAmount: number
): Promise<void> {
  try {
    // 1. Get the cash register to access countedCash
    const cashRegisterRef = doc(db, collections.cashRegister, cashClosureId)
    const cashRegisterSnap = await getDoc(cashRegisterRef)
    
    if (!cashRegisterSnap.exists()) {
      throw new Error("Cash register not found")
    }
    
    const cashRegisterData = cashRegisterSnap.data() as CashRegister
    const countedCash = cashRegisterData.countedCash || 0

    // 2. Get all REMAINING paid orders linked to this cash closure
    const q = query(
      collection(db, collections.orders),
      where("cashClosureId", "==", cashClosureId),
      where("paymentStatus", "==", "paid")
    )
    const querySnapshot = await getDocs(q)
    const allOrders = querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Order))
      .filter((order) => !order.cancelled)

    // 3. Recalculate sales breakdown from remaining orders
    const { cashSales, cardSales, yapeSales, totalSales, ordersCount } = calculateSalesFromOrders(allOrders)

    // 4. Calculate new expectedCash
    const expectedCash = initialAmount + cashSales

    // 5. Calculate new difference
    const difference = countedCash - expectedCash

    // 6. Update cash register document with ALL recalculated values
    await updateDoc(cashRegisterRef, {
      cashSales,
      cardSales,
      yapeSales,
      totalSales,
      ordersCount,
      expectedCash,
      difference,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error recalculating cash register:", error)
    throw error
  }
}

// Multi-store access functions
export async function getUserAccessibleStores(userId: string): Promise<Store[]> {
  try {
    const userRef = doc(db, collections.users, userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      return []
    }
    
    const userData = userSnap.data() as User
    const storeIds: string[] = []
    
    // For admin_global users, get all assigned stores
    if (userData.role === "admin_global" && userData.assignedStores?.length) {
      storeIds.push(...userData.assignedStores)
    }
    // For other users, get their primary store
    else if (userData.storeId) {
      storeIds.push(userData.storeId)
    }
    
    if (storeIds.length === 0) {
      return []
    }
    
    // Fetch all stores
    const storesRef = collection(db, collections.stores)
    const storesSnap = await getDocs(storesRef)
    const stores = storesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Store))
      .filter((store) => storeIds.includes(store.id!))
    
    return stores
  } catch (error) {
    console.error("Error getting user accessible stores:", error)
    throw error
  }
}

export async function getStoresAccessibleByUser(userId: string): Promise<string[]> {
  try {
    const userRef = doc(db, collections.users, userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      return []
    }
    
    const userData = userSnap.data() as User
    
    // For admin_global users, return assigned stores
    if (userData.role === "admin_global" && userData.assignedStores?.length) {
      return userData.assignedStores
    }
    
    // For other users, return their primary store
    if (userData.storeId) {
      return [userData.storeId]
    }
    
    return []
  } catch (error) {
    console.error("Error getting stores accessible by user:", error)
    throw error
  }
}

export async function queryDocumentsByUserStores<T extends DocumentData>(
  collectionName: string,
  userId: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  try {
    const accessibleStoreIds = await getStoresAccessibleByUser(userId)
    
    if (accessibleStoreIds.length === 0) {
      return []
    }
    
    const q = query(
      collection(db, collectionName),
      where("storeId", "in", accessibleStoreIds),
      ...constraints
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T))
  } catch (error) {
    console.error("Error querying documents by user stores:", error)
    throw error
  }
}

export async function canUserAccessStore(userId: string, storeId: string): Promise<boolean> {
  try {
    const accessibleStoreIds = await getStoresAccessibleByUser(userId)
    return accessibleStoreIds.includes(storeId)
  } catch (error) {
    console.error("Error checking user store access:", error)
    return false
  }
}

// ========== FINANCIAL MODULE: EXPENSE MANAGEMENT ==========

/**
 * Register a new expense with automatic cash box deduction
 * Uses transaction to ensure atomicity
 */
export async function registerExpense(
  storeId: string,
  expense: Omit<Expense, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    // 1. Create expense document
    const expenseRef = doc(collection(db, collections.expenses))
    transaction.set(expenseRef, {
      ...expense,
      storeId,
      createdAt: serverTimestamp(),
      isVoid: false,
    })

    // 2. Update cash box balance
    const balanceRef = doc(
      db,
      collections.cashBoxBalances,
      `${storeId}_${expense.cashBoxOrigin}`
    )
    const balanceDoc = await transaction.get(balanceRef)

    if (balanceDoc.exists()) {
      const currentBalance = (balanceDoc.data() as CashBoxBalance).balance
      transaction.update(balanceRef, {
        balance: currentBalance - expense.amount,
        lastUpdated: serverTimestamp(),
      })
    } else {
      // Create new balance if doesn't exist
      transaction.set(balanceRef, {
        storeId,
        boxType: expense.cashBoxOrigin,
        balance: -expense.amount,
        lastUpdated: serverTimestamp(),
      })
    }

    // 3. Log audit entry
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "expense",
      entityId: expenseRef.id,
      action: "create",
      userId: expense.userId,
      userName: expense.userName,
      changes: { created: { amount: expense.amount, category: expense.category } },
      timestamp: serverTimestamp(),
    })

    return expenseRef.id
  })
}

/**
 * Register a provider and initialize their balance
 */
export async function registerProvider(
  storeId: string,
  provider: Omit<Provider, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return addDocument<Omit<Provider, "id">>(collections.providers, {
    ...provider,
    storeId,
    balance: 0,
    totalPaid: 0,
    active: true,
  })
}

/**
 * Register a payment to a provider
 */
export async function payProvider(
  storeId: string,
  providerId: string,
  amount: number,
  cashBoxOrigin: CashBoxType,
  userId: string,
  userName: string,
  notes?: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // 1. Update provider balance
    const providerRef = doc(db, collections.providers, providerId)
    const providerDoc = await transaction.get(providerRef)

    if (!providerDoc.exists()) {
      throw new Error("Proveedor no encontrado")
    }

    const provider = providerDoc.data() as Provider
    transaction.update(providerRef, {
      balance: provider.balance - amount,
      totalPaid: provider.totalPaid + amount,
      updatedAt: serverTimestamp(),
    })

    // 2. Register as expense
    const expenseRef = doc(collection(db, collections.expenses))
    transaction.set(expenseRef, {
      storeId,
      amount,
      category: "providers",
      description: `Pago a proveedor: ${provider.name}`,
      cashBoxOrigin,
      userId,
      userName,
      providerId,
      notes: notes || `Pago total: S/ ${amount.toFixed(2)}`,
      createdAt: serverTimestamp(),
      isVoid: false,
    })

    // 3. Update cash box balance
    const balanceRef = doc(db, collections.cashBoxBalances, `${storeId}_${cashBoxOrigin}`)
    const balanceDoc = await transaction.get(balanceRef)

    if (balanceDoc.exists()) {
      const currentBalance = (balanceDoc.data() as CashBoxBalance).balance
      transaction.update(balanceRef, {
        balance: currentBalance - amount,
        lastUpdated: serverTimestamp(),
      })
    } else {
      transaction.set(balanceRef, {
        storeId,
        boxType: cashBoxOrigin,
        balance: -amount,
        lastUpdated: serverTimestamp(),
      })
    }

    // 4. Audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "expense",
      entityId: expenseRef.id,
      action: "create",
      userId,
      userName,
      changes: {
        provider: { providerId, amount },
      },
      timestamp: serverTimestamp(),
      notes: `Pago a proveedor ${provider.name}`,
    })
  })
}

/**
 * Void an expense (soft delete with audit trail)
 */
export async function voidExpense(
  expenseId: string,
  userId: string,
  userName: string,
  reason: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // 1. Get expense
    const expenseRef = doc(db, collections.expenses, expenseId)
    const expenseDoc = await transaction.get(expenseRef)

    if (!expenseDoc.exists()) {
      throw new Error("Gasto no encontrado")
    }

    const expense = expenseDoc.data() as Expense

    if (expense.isVoid) {
      throw new Error("Este gasto ya fue anulado")
    }

    // 2. Mark as void
    transaction.update(expenseRef, {
      isVoid: true,
      voidReason: reason,
      voidedAt: serverTimestamp(),
      voidedBy: userId,
      updatedAt: serverTimestamp(),
    })

    // 3. Reverse cash box balance
    const balanceRef = doc(
      db,
      collections.cashBoxBalances,
      `${expense.storeId}_${expense.cashBoxOrigin}`
    )
    const balanceDoc = await transaction.get(balanceRef)

    if (balanceDoc.exists()) {
      const currentBalance = (balanceDoc.data() as CashBoxBalance).balance
      transaction.update(balanceRef, {
        balance: currentBalance + expense.amount, // Add back the amount
        lastUpdated: serverTimestamp(),
      })
    }

    // 4. Audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId: expense.storeId,
      entityType: "expense",
      entityId: expenseId,
      action: "void",
      userId,
      userName,
      changes: { voidReason: reason },
      timestamp: serverTimestamp(),
      notes: `Gasto anulado: ${expense.description}`,
    })
  })
}

/**
 * Get cash box balance for a store
 */
export async function getCashBoxBalance(
  storeId: string,
  boxType: CashBoxType
): Promise<number> {
  const balances = await getDocuments<CashBoxBalance>(
    collections.cashBoxBalances,
    where("storeId", "==", storeId),
    where("boxType", "==", boxType)
  )

  if (balances.length === 0) {
    return 0
  }

  return balances[0].balance
}

/**
 * Get all expenses for a store with filtering
 */
export async function getExpenses(
  storeId: string,
  filters?: {
    category?: ExpenseCategory
    cashBox?: CashBoxType
    providerId?: string
    startDate?: Date
    endDate?: Date
    excludeVoid?: boolean
  }
): Promise<Expense[]> {
  const constraints: QueryConstraint[] = [where("storeId", "==", storeId)]

  if (filters?.category) {
    constraints.push(where("category", "==", filters.category))
  }

  if (filters?.cashBox) {
    constraints.push(where("cashBoxOrigin", "==", filters.cashBox))
  }

  if (filters?.providerId) {
    constraints.push(where("providerId", "==", filters.providerId))
  }

  if (filters?.excludeVoid !== false) {
    constraints.push(where("isVoid", "==", false))
  }

  const expenses = await getDocuments<Expense>(collections.expenses, ...constraints)

  // Filter by date client-side (Firestore doesn't support date range queries easily)
  if (filters?.startDate || filters?.endDate) {
    return expenses.filter((exp) => {
      const expDate = exp.createdAt.toDate()
      if (filters.startDate && expDate < filters.startDate) return false
      if (filters.endDate && expDate > filters.endDate) return false
      return true
    })
  }

  return expenses
}

/**
 * Get providers for a store
 */
export async function getProviders(storeId: string): Promise<Provider[]> {
  return getDocuments<Provider>(
    collections.providers,
    where("storeId", "==", storeId),
    where("active", "==", true)
  )
}

/**
 * Subscribe to real-time cash box balance
 */
export function subscribeToCashBoxBalance(
  storeId: string,
  boxType: CashBoxType,
  callback: (balance: number) => void
): () => void {
  const docId = `${storeId}_${boxType}`
  return onSnapshot(doc(db, collections.cashBoxBalances, docId), (docSnap) => {
    if (docSnap.exists()) {
      const balance = (docSnap.data() as CashBoxBalance).balance
      callback(balance)
    } else {
      callback(0)
    }
  })
}

/**
 * Subscribe to recent expenses (realtime for active monitoring)
 */
export function subscribeToRecentExpenses(
  storeId: string,
  callback: (expenses: Expense[]) => void,
  limitCount: number = 20
): () => void {
  const q = query(
    collection(db, collections.expenses),
    where("storeId", "==", storeId),
    where("isVoid", "==", false),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  )

  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Expense))
    callback(expenses)
  })
}

// ========== PHASE 2: FIRESTORE TRANSACTIONS (ALL MONEY OPERATIONS) ==========

/**
 * Register an expense with automatic cash box deduction (TRANSACTIONAL)
 * Atomically: creates expense + creates financial movement + updates balance + audits
 */
export async function registerExpenseTransaction(
  storeId: string,
  expense: Omit<Expense, "id" | "createdAt" | "isVoid">,
  userId: string,
  userName: string
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    // 1. Get current cash box balance
    const balanceDocId = `${storeId}_${expense.cashBoxOrigin}`
    const balanceRef = doc(db, collections.cashBoxBalances, balanceDocId)
    const balanceSnap = await transaction.get(balanceRef)

    let currentBalance = 0
    if (balanceSnap.exists()) {
      currentBalance = (balanceSnap.data() as CashBoxBalance).balance
    }

    // 2. Verify sufficient funds
    if (currentBalance < expense.amount) {
      throw new Error(`Insufficient funds in ${expense.cashBoxOrigin}. Available: ${currentBalance}, Required: ${expense.amount}`)
    }

    // 3. Create expense document
    const expenseRef = doc(collection(db, collections.expenses))
    transaction.set(expenseRef, {
      ...expense,
      storeId,
      createdAt: serverTimestamp(),
      isVoid: false,
    })

    // 4. Create financial movement
    const movementRef = doc(collection(db, collections.financialMovements))
    transaction.set(movementRef, {
      storeId,
      type: "expense",
      amount: expense.amount,
      fromBox: expense.cashBoxOrigin,
      description: expense.description,
      category: expense.category,
      relatedDocId: expenseRef.id,
      userId,
      userName,
      timestamp: serverTimestamp(),
      archived: false,
    })

    // 5. Update cash box balance
    const newBalance = currentBalance - expense.amount
    transaction.update(balanceRef, {
      balance: newBalance,
      lastUpdated: serverTimestamp(),
      lastMovementId: movementRef.id,
    })

    // 6. Create audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "expense",
      entityId: expenseRef.id,
      action: "create",
      userId,
      userName,
      changes: { created: { amount: expense.amount, category: expense.category } },
      timestamp: serverTimestamp(),
      notes: `Expense registered: ${expense.description}`,
    })

    return expenseRef.id
  })
}

/**
 * Distribute cash during closure (TRANSACTIONAL)
 * Atomically: creates distribution + creates movements + updates all balances + audits
 */
export async function distributeCashOnClosureTransaction(
  storeId: string,
  cajaClosureId: string,
  distribution: {
    toPrincipal: number
    toStrongbox: number
    remaining: number
  },
  userId: string,
  userName: string
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    // PHASE 1: READ ALL DOCUMENTS FIRST (Before any writes)
    
    // Get operational balance
    const opBalanceId = `${storeId}_operational`
    const opBalanceRef = doc(db, collections.cashBoxBalances, opBalanceId)
    const opBalanceSnap = await transaction.get(opBalanceRef)

    if (!opBalanceSnap.exists()) {
      throw new Error("Operational cash box not found")
    }

    const operationalBalance = (opBalanceSnap.data() as CashBoxBalance).balance

    // Get principal balance if needed
    let prinBalanceRef: any = null
    let prinBalanceSnap: any = null
    if (distribution.toPrincipal > 0) {
      const prinBalanceId = `${storeId}_principal`
      prinBalanceRef = doc(db, collections.cashBoxBalances, prinBalanceId)
      prinBalanceSnap = await transaction.get(prinBalanceRef)
    }

    // Get strongbox balance if needed
    let strongBalanceRef: any = null
    let strongBalanceSnap: any = null
    if (distribution.toStrongbox > 0) {
      const strongBalanceId = `${storeId}_strongbox`
      strongBalanceRef = doc(db, collections.cashBoxBalances, strongBalanceId)
      strongBalanceSnap = await transaction.get(strongBalanceRef)
    }

    // PHASE 2: VALIDATE DATA
    
    const totalDistributed = distribution.toPrincipal + distribution.toStrongbox + distribution.remaining
    if (Math.abs(totalDistributed - operationalBalance) > 0.01) {
      throw new Error(
        `Distribution mismatch. Balance: ${operationalBalance}, Distribution: ${totalDistributed}`
      )
    }

    // PHASE 3: WRITE ALL DOCUMENTS
    
    // Create distribution record
    const distributionRef = doc(collection(db, collections.cashDistributions))
    transaction.set(distributionRef, {
      storeId,
      cajaClosureId,
      operationalToPrincipal: distribution.toPrincipal,
      operationalToStrongbox: distribution.toStrongbox,
      operationalRemaining: distribution.remaining,
      userId,
      userName,
      createdAt: serverTimestamp(),
      status: "completed",
    })

    // Create financial movements
    if (distribution.toPrincipal > 0) {
      const movementRef = doc(collection(db, collections.financialMovements))
      transaction.set(movementRef, {
        storeId,
        type: "cash_distribution",
        amount: distribution.toPrincipal,
        fromBox: "operational",
        toBox: "principal",
        description: "Distribution to principal cash box",
        relatedDocId: distributionRef.id,
        userId,
        userName,
        timestamp: serverTimestamp(),
        archived: false,
      })
    }

    if (distribution.toStrongbox > 0) {
      const movementRef = doc(collection(db, collections.financialMovements))
      transaction.set(movementRef, {
        storeId,
        type: "cash_distribution",
        amount: distribution.toStrongbox,
        fromBox: "operational",
        toBox: "strongbox",
        description: "Distribution to strongbox",
        relatedDocId: distributionRef.id,
        userId,
        userName,
        timestamp: serverTimestamp(),
        archived: false,
      })
    }

    // Update operational balance
    transaction.update(opBalanceRef, {
      balance: distribution.remaining,
      lastUpdated: serverTimestamp(),
    })

    // Update principal balance if distribution exists
    if (distribution.toPrincipal > 0 && prinBalanceRef) {
      const prinBalance = prinBalanceSnap.exists()
        ? (prinBalanceSnap.data() as CashBoxBalance).balance
        : 0
      transaction.set(
        prinBalanceRef,
        {
          storeId,
          boxType: "principal",
          balance: prinBalance + distribution.toPrincipal,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      )
    }

    // Update strongbox balance if distribution exists
    if (distribution.toStrongbox > 0 && strongBalanceRef) {
      const strongBalance = strongBalanceSnap.exists()
        ? (strongBalanceSnap.data() as CashBoxBalance).balance
        : 0
      transaction.set(
        strongBalanceRef,
        {
          storeId,
          boxType: "strongbox",
          balance: strongBalance + distribution.toStrongbox,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      )
    }

    // Create audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "cash_distribution",
      entityId: distributionRef.id,
      action: "distribute",
      userId,
      userName,
      changes: {
        distribution: {
          toPrincipal: distribution.toPrincipal,
          toStrongbox: distribution.toStrongbox,
          remaining: distribution.remaining,
        },
      },
      timestamp: serverTimestamp(),
      notes: `Cash distributed from operational. Closure: ${cajaClosureId}`,
    })

    return distributionRef.id
  })
}

/**
 * Transfer cash between principal and strongbox (TRANSACTIONAL)
 */
export async function transferCashTransaction(
  storeId: string,
  fromBox: "principal" | "strongbox",
  toBox: "principal" | "strongbox",
  amount: number,
  reason: string,
  userId: string,
  userName: string
): Promise<string> {
  if (fromBox === toBox) {
    throw new Error("Cannot transfer to the same box")
  }

  return runTransaction(db, async (transaction) => {
    // 1. Get both balances
    const fromBalanceId = `${storeId}_${fromBox}`
    const toBalanceId = `${storeId}_${toBox}`
    const fromRef = doc(db, collections.cashBoxBalances, fromBalanceId)
    const toRef = doc(db, collections.cashBoxBalances, toBalanceId)

    const fromSnap = await transaction.get(fromRef)
    const toSnap = await transaction.get(toRef)

    if (!fromSnap.exists()) {
      throw new Error(`Source cash box (${fromBox}) not found`)
    }

    const fromBalance = (fromSnap.data() as CashBoxBalance).balance

    // 2. Verify sufficient funds
    if (fromBalance < amount) {
      throw new Error(`Insufficient funds in ${fromBox}. Available: ${fromBalance}, Required: ${amount}`)
    }

    // 3. Create financial movement
    const movementRef = doc(collection(db, collections.financialMovements))
    transaction.set(movementRef, {
      storeId,
      type: "cash_transfer",
      amount,
      fromBox,
      toBox,
      description: `Transfer from ${fromBox} to ${toBox}: ${reason}`,
      userId,
      userName,
      timestamp: serverTimestamp(),
      archived: false,
    })

    // 4. Update balances
    transaction.update(fromRef, {
      balance: fromBalance - amount,
      lastUpdated: serverTimestamp(),
    })

    const toBalance = toSnap.exists() ? (toSnap.data() as CashBoxBalance).balance : 0
    transaction.set(
      toRef,
      {
        storeId,
        boxType: toBox,
        balance: toBalance + amount,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    )

    // 5. Create audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "financial_movement",
      entityId: movementRef.id,
      action: "transfer",
      userId,
      userName,
      changes: {
        transfer: { fromBox, toBox, amount },
      },
      timestamp: serverTimestamp(),
      notes: reason,
    })

    return movementRef.id
  })
}

/**
 * Record manual cash adjustment (cash addition to operational box)
 * Used for: fondo sencillo, dinero del dueño, reposición, etc.
 */
export async function recordCashAdjustmentTransaction(
  storeId: string,
  amount: number,
  reason: "fondo_sencillo" | "dinero_dueno" | "reposicion" | "ajuste" | "otro",
  description: string,
  userId: string,
  userName: string
): Promise<string> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0")
  }

  return runTransaction(db, async (transaction) => {
    // 1. Get operational balance
    const opBalanceId = `${storeId}_operational`
    const opRef = doc(db, collections.cashBoxBalances, opBalanceId)
    const opSnap = await transaction.get(opRef)

    const currentBalance = opSnap.exists() ? (opSnap.data() as CashBoxBalance).balance : 0

    // 2. Create financial movement for audit trail
    const movementRef = doc(collection(db, collections.financialMovements))
    transaction.set(movementRef, {
      storeId,
      type: "cash_adjustment",
      subtype: reason,
      amount,
      description: description || `Cash adjustment: ${reason}`,
      userId,
      userName,
      timestamp: serverTimestamp(),
      archived: false,
    })

    // 3. Update operational balance
    const newBalance = currentBalance + amount
    transaction.update(opRef, {
      balance: newBalance,
      lastUpdated: serverTimestamp(),
    })

    // 4. Create audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "financial_movement",
      entityId: movementRef.id,
      action: "cash_adjustment",
      userId,
      userName,
      changes: {
        cashAdjustment: {
          reason,
          amount,
          previousBalance: currentBalance,
          newBalance,
          description,
        },
      },
      timestamp: serverTimestamp(),
      notes: `Cash adjustment: ${reason}. Amount: ${amount}`,
    })

    return movementRef.id
  })
}

/**
 * Record comprehensive cash movement (entrada/salida)
 * Handles all types of cash movements in restaurant operations:
 * - ENTRADA: fondo_sencillo, dinero_dueno, reposicion, propina_tienda, propina_mozo, otro
 * - SALIDA: pago_proveedor, retiro_dueno, ajuste_arqueo, otro
 */
export async function recordCashMovementTransaction(
  storeId: string,
  type: "entrada" | "salida",
  category: 
    | "fondo_sencillo"
    | "dinero_dueno"
    | "reposicion"
    | "propina_tienda"
    | "propina_mozo"
    | "pago_proveedor"
    | "retiro_dueno"
    | "ajuste_arqueo"
    | "otro",
  amount: number,
  description: string,
  userId: string,
  userName: string,
  origin: "caja_operativa" | "caja_fuerte" = "caja_operativa"
): Promise<string> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0")
  }

  return runTransaction(db, async (transaction) => {
    // PHASE 1: READ ALL DATA (Determine which balance to use based on origin)
    
    // Determine balance source based on origin parameter
    // ENTRADA: use specified origin (can go to operational OR safe_box)
    // SALIDA: use specified origin (must withdraw from operational OR safe_box)
    const balanceSource = origin
    
    let balanceRef
    let balanceSnap
    let currentBalance = 0

    if (balanceSource === "caja_operativa") {
      // Read from balances/{storeId}_operational
      const balanceDocId = `${storeId}_operational`
      balanceRef = doc(db, collections.cashBoxBalances, balanceDocId)
      balanceSnap = await transaction.get(balanceRef)
      currentBalance = balanceSnap.exists() ? (balanceSnap.data() as CashBoxBalance).balance : 0
    } else {
      // Read from safe_box/{storeId} (caja_fuerte)
      balanceRef = doc(db, collections.safeBox, storeId)
      balanceSnap = await transaction.get(balanceRef)
      currentBalance = balanceSnap.exists() ? (balanceSnap.data().currentBalance || 0) : 0
    }

    // PHASE 2: VALIDATE ALL DATA
    
    // 2. Calculate new balance based on type
    const balanceChange = type === "entrada" ? amount : -amount
    const newBalance = currentBalance + balanceChange

    // Prevent negative balance (unless it's an adjustment)
    if (newBalance < 0 && type === "salida" && category !== "ajuste_arqueo") {
      throw new Error(`Insufficient cash in ${balanceSource}. Current: ${currentBalance}, Requested: ${amount}`)
    }

    // PHASE 3: WRITE ALL DATA
    
    // 3. Create financial movement for audit trail
    const movementRef = doc(collection(db, collections.financialMovements))
    transaction.set(movementRef, {
      storeId,
      type: "cash_movement",
      movementType: type,
      category,
      amount,
      description: description || `Cash movement: ${category}`,
      origin: balanceSource,
      userId,
      userName,
      timestamp: serverTimestamp(),
      archived: false,
    })

    // 4. Update the correct balance (operational or safe_box)
    if (balanceSource === "caja_operativa") {
      // Update balance field in cashBoxBalances
      transaction.update(balanceRef, {
        balance: newBalance,
        lastUpdated: serverTimestamp(),
      })
    } else {
      // Update currentBalance field in safeBox
      if (!balanceSnap.exists()) {
        transaction.set(balanceRef, {
          storeId,
          currentBalance: newBalance,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        transaction.update(balanceRef, {
          currentBalance: newBalance,
          updatedAt: serverTimestamp(),
        })
      }
    }

    // 5. Create audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "financial_movement",
      entityId: movementRef.id,
      action: "cash_movement",
      userId,
      userName,
      changes: {
        cashMovement: {
          type,
          category,
          amount,
          origin: balanceSource,
          previousBalance: currentBalance,
          newBalance,
          description,
        },
      },
      timestamp: serverTimestamp(),
      notes: `Cash ${type}: ${category}. Amount: ${amount}. From: ${balanceSource}. Balance: ${currentBalance} → ${newBalance}`,
    })

    return movementRef.id
  })
}

/**
 * Pay a provider (TRANSACTIONAL)
 * Atomically: creates expense + creates movement + updates provider balance + updates cash box + audits
 */
export async function payProviderTransaction(
  storeId: string,
  providerId: string,
  amount: number,
  boxSource: "principal" | "strongbox",
  reason: string,
  userId: string,
  userName: string
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    // 1. Get provider
    const providerRef = doc(db, collections.providers, providerId)
    const providerSnap = await transaction.get(providerRef)

    if (!providerSnap.exists()) {
      throw new Error("Provider not found")
    }

    const provider = providerSnap.data() as Provider

    // 2. Get cash box balance
    const balanceDocId = `${storeId}_${boxSource}`
    const balanceRef = doc(db, collections.cashBoxBalances, balanceDocId)
    const balanceSnap = await transaction.get(balanceRef)

    let currentBalance = 0
    if (balanceSnap.exists()) {
      currentBalance = (balanceSnap.data() as CashBoxBalance).balance
    }

    // 3. Verify sufficient funds
    if (currentBalance < amount) {
      throw new Error(`Insufficient funds in ${boxSource}. Available: ${currentBalance}, Required: ${amount}`)
    }

    // 4. Create expense record (category: providers)
    const expenseRef = doc(collection(db, collections.expenses))
    transaction.set(expenseRef, {
      storeId,
      amount,
      category: "providers",
      description: `Payment to provider: ${provider.name}`,
      cashBoxOrigin: boxSource,
      userId,
      userName,
      providerId,
      notes: reason,
      createdAt: serverTimestamp(),
      isVoid: false,
    })

    // 5. Create financial movement
    const movementRef = doc(collection(db, collections.financialMovements))
    transaction.set(movementRef, {
      storeId,
      type: "provider_payment",
      amount,
      fromBox: boxSource,
      description: `Payment to provider: ${provider.name}`,
      providerId,
      relatedDocId: expenseRef.id,
      userId,
      userName,
      timestamp: serverTimestamp(),
      archived: false,
    })

    // 6. Update provider balance
    transaction.update(providerRef, {
      balance: provider.balance - amount,
      totalPaid: provider.totalPaid + amount,
      updatedAt: serverTimestamp(),
    })

    // 7. Update cash box balance
    transaction.update(balanceRef, {
      balance: currentBalance - amount,
      lastUpdated: serverTimestamp(),
    })

    // 8. Create audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "provider_payment",
      entityId: expenseRef.id,
      action: "create",
      userId,
      userName,
      changes: {
        payment: { provider: provider.name, amount, box: boxSource },
      },
      timestamp: serverTimestamp(),
      notes: reason,
    })

    return expenseRef.id
  })
}

/**
 * Cancel an expense (soft delete with reversal - TRANSACTIONAL)
 */
export async function cancelExpenseTransaction(
  storeId: string,
  expenseId: string,
  reason: string,
  userId: string,
  userName: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // PHASE 1: GET ALL DATA (reads must come first)
    
    // 1. Get expense
    const expenseRef = doc(db, collections.expenses, expenseId)
    const expenseSnap = await transaction.get(expenseRef)

    if (!expenseSnap.exists()) {
      throw new Error("Expense not found")
    }

    const expense = expenseSnap.data() as Expense

    // 2. Get cash box balance for reversal
    const balanceDocId = `${storeId}_${expense.cashBoxOrigin}`
    const balanceRef = doc(db, collections.cashBoxBalances, balanceDocId)
    const balanceSnap = await transaction.get(balanceRef)

    // PHASE 2: VALIDATE ALL DATA (after all reads)

    if (expense.isVoid) {
      throw new Error("This expense is already cancelled")
    }

    // PHASE 3: WRITE ALL DATA (after all reads and validations)

    // 3. Mark expense as void
    transaction.update(expenseRef, {
      isVoid: true,
      voidReason: reason,
      voidedAt: serverTimestamp(),
      voidedBy: userId,
      updatedAt: serverTimestamp(),
    })

    // 4. Reverse cash box balance
    if (balanceSnap.exists()) {
      const currentBalance = (balanceSnap.data() as CashBoxBalance).balance
      transaction.update(balanceRef, {
        balance: currentBalance + expense.amount, // Add back the amount
        lastUpdated: serverTimestamp(),
      })
    }

    // 5. Create reversal movement
    const reversalRef = doc(collection(db, collections.financialMovements))
    transaction.set(reversalRef, {
      storeId,
      type: "expense",
      amount: -expense.amount, // Negative to indicate reversal
      fromBox: expense.cashBoxOrigin,
      description: `Reversal of: ${expense.description}`,
      relatedDocId: expenseId,
      userId,
      userName,
      timestamp: serverTimestamp(),
      archived: false,
    })

    // 6. Create audit log
    const auditRef = doc(collection(db, collections.auditLogs))
    transaction.set(auditRef, {
      storeId,
      entityType: "expense",
      entityId: expenseId,
      action: "void",
      userId,
      userName,
      changes: { voidReason: reason },
      timestamp: serverTimestamp(),
      notes: `Cancelled: ${expense.description}`,
    })
  })
}

// ========== PHASE 3: QUERY FUNCTIONS (NO TRANSACTIONS, LOAD-BASED) ==========

/**
 * Get all cash box balances for a store
 */
export async function getAllCashBoxBalances(
  storeId: string
): Promise<Record<CashBoxType, number>> {
  const q = query(
    collection(db, collections.cashBoxBalances),
    where("storeId", "==", storeId)
  )

  const querySnap = await getDocs(q)
  const balances: Record<CashBoxType, number> = {
    operational: 0,
    principal: 0,
    strongbox: 0,
  }

  querySnap.docs.forEach((doc) => {
    const data = doc.data() as CashBoxBalance
    balances[data.boxType] = data.balance
  })

  return balances
}


/**
 * Get recent expenses (active collection only)
 */
export async function getRecentExpenses(
  storeId: string,
  daysBack: number = 30,
  limit_val: number = 100,
  offset: number = 0
): Promise<Expense[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)

  const q = query(
    collection(db, collections.expenses),
    where("storeId", "==", storeId),
    where("isVoid", "==", false),
    where("createdAt", ">=", cutoffDate),
    orderBy("createdAt", "desc"),
    limit(limit_val + offset)
  )

  const querySnap = await getDocs(q)
  const expenses = querySnap.docs
    .slice(offset)
    .map((doc) => ({ id: doc.id, ...doc.data() } as Expense))

  return expenses
}

/**
 * Get financial movements with smart active/archived routing
 */
export async function getFinancialMovements(
  storeId: string,
  startDate: Date,
  endDate: Date,
  limit_val: number = 100
): Promise<FinancialMovement[]> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // If date range is within active period (< 90 days), query active collection
  if (startDate > ninetyDaysAgo) {
    const q = query(
      collection(db, collections.financialMovements),
      where("storeId", "==", storeId),
      where("timestamp", ">=", startDate),
      where("timestamp", "<=", endDate),
      orderBy("timestamp", "desc"),
      limit(limit_val)
    )

    const querySnap = await getDocs(q)
    return querySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FinancialMovement))
  }

  // If date range includes old data, query archived collection
  const q = query(
    collection(db, collections.financialMovements_archived),
    where("storeId", "==", storeId),
    where("timestamp", ">=", startDate),
    where("timestamp", "<=", endDate),
    orderBy("timestamp", "desc"),
    limit(limit_val)
  )

  const querySnap = await getDocs(q)
  return querySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FinancialMovement))
}

/**
 * Get historical report from snapshots (MOST EFFICIENT)
 */
export async function getHistoricalReportFromSnapshots(
  storeId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<{
  totalSales: number
  totalExpenses: number
  snapshots: DailyFinancialSummary[]
}> {
  const q = query(
    collection(db, collections.dailyFinancialSummary),
    where("storeId", "==", storeId),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date", "desc")
  )

  const querySnap = await getDocs(q)
  const snapshots = querySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DailyFinancialSummary))

  let totalSales = 0
  let totalExpenses = 0

  snapshots.forEach((snapshot) => {
    totalSales += snapshot.totalSales
    totalExpenses += snapshot.totalExpenses
  })

  return { totalSales, totalExpenses, snapshots }
}

/**
 * Get today's financial snapshot
 */
export async function getTodaysFinancialSnapshot(storeId: string): Promise<DailyFinancialSummary | null> {
  const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD
  const docId = `${storeId}_${today}`
  const snapshotRef = doc(db, collections.dailyFinancialSummary, docId)
  const snapshotSnap = await getDoc(snapshotRef)

  if (snapshotSnap.exists()) {
    return { id: snapshotSnap.id, ...snapshotSnap.data() } as DailyFinancialSummary
  }
  return null
}

/**
 * Get archival health status
 */
export async function getArchivalStatus(storeId: string): Promise<{
  activeMovementCount: number
  archivedMovementCount: number
  oldestActiveRecord: Date | null
  newestArchivedRecord: Date | null
}> {
  // Count active
  const activeQ = query(
    collection(db, collections.financialMovements),
    where("storeId", "==", storeId)
  )
  const activeSnap = await getDocs(activeQ)

  // Count archived
  const archivedQ = query(
    collection(db, collections.financialMovements_archived),
    where("storeId", "==", storeId)
  )
  const archivedSnap = await getDocs(archivedQ)

  let oldestActive: Date | null = null
  let newestArchived: Date | null = null

  activeSnap.docs.forEach((doc) => {
    const timestamp = (doc.data().timestamp as Timestamp).toDate()
    if (!oldestActive || timestamp < oldestActive) {
      oldestActive = timestamp
    }
  })

  archivedSnap.docs.forEach((doc) => {
    const timestamp = (doc.data().timestamp as Timestamp).toDate()
    if (!newestArchived || timestamp > newestArchived) {
      newestArchived = timestamp
    }
  })

  return {
    activeMovementCount: activeSnap.size,
    archivedMovementCount: archivedSnap.size,
    oldestActiveRecord: oldestActive,
    newestArchivedRecord: newestArchived,
  }
}


// ========== PHASE 4: SUBSCRIPTION FUNCTIONS (REAL-TIME, CRITICAL DATA ONLY) ==========

/**
 * Subscribe to current cash box balances (REAL-TIME)
 * Only for: operational, principal, strongbox
 */
export function subscribeToCashBoxBalances(
  storeId: string,
  callback: (balances: Record<CashBoxType, number>) => void
): () => void {
  const q = query(
    collection(db, collections.cashBoxBalances),
    where("storeId", "==", storeId)
  )

  return onSnapshot(q, (snapshot) => {
    const balances: Record<CashBoxType, number> = {
      operational: 0,
      principal: 0,
      strongbox: 0,
    }

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CashBoxBalance
      balances[data.boxType] = data.balance
    })

    callback(balances)
  })
}

/**
 * Subscribe to recent movements (REAL-TIME, last 24 hours only)
 */
export function subscribeToRecentMovements(
  storeId: string,
  callback: (movements: FinancialMovement[]) => void,
  hoursBack: number = 24
): () => void {
  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - hoursBack)

  const q = query(
    collection(db, collections.financialMovements),
    where("storeId", "==", storeId),
    where("timestamp", ">=", cutoffTime),
    orderBy("timestamp", "desc"),
    limit(50)
  )

  return onSnapshot(q, (snapshot) => {
    const movements = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FinancialMovement))
    callback(movements)
  })
}

/**
 * Subscribe to critical alerts (low balance warnings)
 */
export function subscribeToCriticalAlerts(
  storeId: string,
  callback: (alerts: Array<{ type: string; message: string; severity: "warning" | "critical" }>) => void,
  thresholds?: { operational?: number; principal?: number; strongbox?: number }
): () => void {
  const defaultThresholds = {
    operational: 1000,
    principal: 5000,
    strongbox: 10000,
    ...thresholds,
  }

  return subscribeToCashBoxBalances(storeId, (balances) => {
    const alerts: Array<{ type: string; message: string; severity: "warning" | "critical" }> = []

    if (balances.operational < defaultThresholds.operational) {
      alerts.push({
        type: "low_operational",
        message: `Operational cash low: ${balances.operational}`,
        severity: balances.operational < defaultThresholds.operational / 2 ? "critical" : "warning",
      })
    }

    if (balances.principal < defaultThresholds.principal) {
      alerts.push({
        type: "low_principal",
        message: `Principal cash low: ${balances.principal}`,
        severity: balances.principal < defaultThresholds.principal / 2 ? "critical" : "warning",
      })
    }

    if (balances.strongbox < defaultThresholds.strongbox) {
      alerts.push({
        type: "low_strongbox",
        message: `Strongbox cash low: ${balances.strongbox}`,
        severity: balances.strongbox < defaultThresholds.strongbox / 2 ? "critical" : "warning",
      })
    }

    callback(alerts)
  })
}

// ========== SAFE BOX (INCREMENTAL V2) ==========
export async function ensureSafeBox(storeId: string): Promise<void> {
  const ref = doc(db, collections.safeBox, storeId)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { storeId, currentBalance: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }
}

export function subscribeToSafeBox(storeId: string, callback: (safeBox: SafeBox) => void): () => void {
  const ref = doc(db, collections.safeBox, storeId)
  return onSnapshot(ref, async (snap) => {
    if (!snap.exists()) {
      try {
        await ensureSafeBox(storeId)
        callback({ storeId, currentBalance: 0, createdAt: new Date(), updatedAt: new Date() })
      } catch (error) {
        console.error("[safeBox] Error ensuring safe box:", error)
        // Return default safe box on error
        callback({ storeId, currentBalance: 0, createdAt: new Date(), updatedAt: new Date() })
      }
      return
    }
    callback({ id: snap.id, ...snap.data() } as SafeBox)
  }, (error) => {
    console.error("[safeBox] Subscription error:", error.message)
    // Return default safe box on error
    callback({ storeId, currentBalance: 0, createdAt: new Date(), updatedAt: new Date() })
  })
}

export function subscribeToSafeBoxMovements(storeId: string, callback: (movements: SafeBoxMovement[]) => void): () => void {
  const q = query(collection(db, collections.safeBoxMovements), where("storeId", "==", storeId), orderBy("createdAt", "desc"), limit(30))
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SafeBoxMovement))), (error) => {
    // Log the error but don't crash - Firestore will suggest creating the index
    console.error("[safeBoxMovements] Query error:", error.message)
    // Return empty array on error
    callback([])
  })
}

/**
 * Subscribe to unified financial movements (real-time)
 * Shows ALL financial movements: cash movements, expenses, payments, etc
 */
export function subscribeToFinancialMovements(
  storeId: string,
  callback: (movements: any[]) => void,
  limit_val: number = 30
): () => void {
  const q = query(
    collection(db, collections.financialMovements),
    where("storeId", "==", storeId),
    orderBy("timestamp", "desc"),
    limit(limit_val)
  )
  return onSnapshot(q, (snapshot) => {
    const movements = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))
    callback(movements)
  }, (error) => {
    console.error("[financialMovements] Query error:", error.message)
    callback([])
  })
}

export async function depositToSafeBoxFromClosure(
  storeId: string, amount: number, cashRegisterId: string, userId: string, userName: string, description = "Depósito desde cierre de caja"
): Promise<void> {
  if (amount <= 0) return
  await runTransaction(db, async (transaction) => {
    const safeRef = doc(db, collections.safeBox, storeId)
    const safeSnap = await transaction.get(safeRef)
    const currentBalance = safeSnap.exists() ? (safeSnap.data().currentBalance || 0) : 0
    if (!safeSnap.exists()) transaction.set(safeRef, { storeId, currentBalance: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    transaction.update(safeRef, { currentBalance: currentBalance + amount, updatedAt: serverTimestamp() })
    const movRef = doc(collection(db, collections.safeBoxMovements))
    transaction.set(movRef, { storeId, type: "deposit", amount, source: "cash_register", description, cashRegisterId, userId, userName, createdAt: serverTimestamp() })
    const logRef = doc(collection(db, collections.auditLogsV2))
    transaction.set(logRef, { storeId, action: "safe_box_deposit", targetType: "safe_box", targetId: storeId, metadata: { amount, cashRegisterId, description }, userId, userName, createdAt: serverTimestamp() })
  })
}

export async function registerInternalExpenseV2(
  storeId: string,
  expense: { description: string; amount: number; source: "cash_register" | "safe_box"; category: string },
  userId: string,
  userName: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    if (expense.amount <= 0) throw new Error("Monto inválido")

    // PHASE 1: READ all balances first
    let operationalBalanceRef: any = null
    let operationalBalanceSnap: any = null
    let safeBoxRef: any = null
    let safeBoxSnap: any = null

    if (expense.source === "cash_register") {
      const opBalanceId = `${storeId}_operational`
      operationalBalanceRef = doc(db, collections.cashBoxBalances, opBalanceId)
      operationalBalanceSnap = await transaction.get(operationalBalanceRef)
    } else if (expense.source === "safe_box") {
      safeBoxRef = doc(db, collections.safeBox, storeId)
      safeBoxSnap = await transaction.get(safeBoxRef)
    }

    // PHASE 2: VALIDATE funds
    if (expense.source === "cash_register") {
      const balance = operationalBalanceSnap.exists() ? (operationalBalanceSnap.data() as CashBoxBalance).balance : 0
      if (balance < expense.amount) {
        throw new Error(`Saldo insuficiente en caja operativa. Disponible: ${balance}, Requerido: ${expense.amount}`)
      }
    } else if (expense.source === "safe_box") {
      const balance = safeBoxSnap.exists() ? (safeBoxSnap.data().currentBalance || 0) : 0
      if (balance < expense.amount) {
        throw new Error(`Saldo insuficiente en caja fuerte. Disponible: ${balance}, Requerido: ${expense.amount}`)
      }
    }

    // PHASE 3: WRITE all changes
    // Create expense document
    const expenseRef = doc(collection(db, collections.expenses))
    transaction.set(expenseRef, {
      storeId,
      ...expense,
      userId,
      userName,
      createdAt: serverTimestamp(),
      status: "completed",
    })

    // Create financial movement
    const movRef = doc(collection(db, collections.safeBoxMovements))
    transaction.set(movRef, {
      storeId,
      type: "expense",
      amount: expense.amount,
      source: expense.source,
      category: expense.category,
      description: expense.description,
      relatedDocId: expenseRef.id,
      userId,
      userName,
      createdAt: serverTimestamp(),
      archived: false,
    })

    // Update balance (operational or safe box)
    if (expense.source === "cash_register") {
      const currentBalance = operationalBalanceSnap.exists() ? (operationalBalanceSnap.data() as CashBoxBalance).balance : 0
      const newBalance = currentBalance - expense.amount
      transaction.update(operationalBalanceRef, {
        balance: newBalance,
        lastUpdated: serverTimestamp(),
      })
    } else if (expense.source === "safe_box") {
      const currentBalance = safeBoxSnap.exists() ? (safeBoxSnap.data().currentBalance || 0) : 0
      const newBalance = currentBalance - expense.amount
      if (!safeBoxSnap.exists()) {
        transaction.set(safeBoxRef, {
          storeId,
          currentBalance: newBalance,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        transaction.update(safeBoxRef, {
          currentBalance: newBalance,
          updatedAt: serverTimestamp(),
        })
      }
    }

    // Create audit log
    const logRef = doc(collection(db, collections.auditLogsV2))
    transaction.set(logRef, {
      storeId,
      action: "expense_registered",
      targetType: "expense",
      targetId: expenseRef.id,
      metadata: {
        ...expense,
        balanceAfter: expense.source === "cash_register"
          ? ((operationalBalanceSnap.exists() ? (operationalBalanceSnap.data() as CashBoxBalance).balance : 0) - expense.amount)
          : ((safeBoxSnap.exists() ? (safeBoxSnap.data().currentBalance || 0) : 0) - expense.amount),
      },
      userId,
      userName,
      createdAt: serverTimestamp(),
    })
  })
}
