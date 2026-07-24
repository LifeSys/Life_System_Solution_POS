"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import {
  getAllProductsByStore,
  getUsersByStore,
  getAllStores,
  getAllStoresIncludingInactive,
  getAllTablesByStore,
  isTableNumberExists,
  addDocument,
  updateDocument,
  deleteDocument,
  hardDeleteDocument,
  collections,
  initializeStoreData,
  subscribeToAllTables,
  invalidateProductCache,
  ensureInventoryItemsForProduct,
  PIZZA_MASS_TYPES,
  PIZZA_SIZE_LABELS,
  type Product,
  type ProductVariant,
  type User,
  type Store,
  type Table,
} from "@/lib/firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Plus, Pencil, Trash2, ToggleLeft, Store as StoreIcon, Users, Package, LayoutGrid, AlertCircle, Pizza } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminPage() {
  const { store, currentStoreId, isSuperAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState("products")
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [productError, setProductError] = useState<string | null>(null)

  // Form states
  const [productForm, setProductForm] = useState({
    name: "",
    price: "", // Legacy: for products without variants
    category: "",
    available: true,
    variants: [] as ProductVariant[],
    priceMap: {} as Record<string, string>, // Pizza: { "PERSONAL": "18", "FAMILIAR": "42", ... }
  })
  const [isNewCategory, setIsNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  
  // Extract unique categories from existing products
  const existingCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort()
  const [userForm, setUserForm] = useState({
    name: "",
    pin: "",
    role: "mesero" as User["role"],
    active: true,
  })
  const [storeForm, setStoreForm] = useState({
    name: "",
    code: "",
    active: true,
  })
  const [tableForm, setTableForm] = useState({
    number: "",
    capacity: "4",
    active: true,
  })

  useEffect(() => {
    loadData()
  }, [currentStoreId])

  // Real-time subscription for tables
  useEffect(() => {
    if (!currentStoreId) return

    const unsubscribe = subscribeToAllTables(currentStoreId, (tablesData) => {
      setTables(tablesData)
    })

    return () => unsubscribe()
  }, [currentStoreId])

  const loadData = async () => {
    if (!currentStoreId) return
    setIsLoading(true)

    try {
      const [productsData, usersData] = await Promise.all([
        getAllProductsByStore(currentStoreId),
        getUsersByStore(currentStoreId),
      ])
      setProducts(productsData)
      setUsers(usersData)

      if (isSuperAdmin) {
        // Fetch all stores including inactive for admin view
        const storesData = await getAllStoresIncludingInactive()
        setStores(storesData)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Product handlers
  const handleOpenProductModal = (product?: Product) => {
    setProductError(null)
    if (product) {
      setEditingProduct(product)
      setProductForm({
        name: product.name,
        price: product.price?.toString() || "",
        category: product.category,
        available: product.available,
        variants: product.variants || [],
        priceMap: product.category?.toLowerCase() === 'pizzas' && product.priceMap 
          ? Object.entries(product.priceMap).reduce((acc, [key, val]) => {
              acc[key] = val?.toString() || ''
              return acc
            }, {} as Record<string, string>)
          : {}
      })
    } else {
      setEditingProduct(null)
      setProductForm({ name: "", price: "", category: "", available: true, variants: [], priceMap: {} })
    }
    setIsNewCategory(false)
    setNewCategoryName("")
    setShowProductModal(true)
  }

  const handleAddVariant = () => {
    const newVariant = { name: "", price: 0 }
    setProductForm({
      ...productForm,
      variants: [...productForm.variants, newVariant],
    })
  }

  const handleRemoveVariant = (index: number) => {
    setProductForm({
      ...productForm,
      variants: productForm.variants.filter((_, i) => i !== index),
    })
  }

  const handleUpdateVariant = (index: number, field: "name" | "price", value: string) => {
    const newVariants = [...productForm.variants]
    if (field === "price") {
      newVariants[index] = { ...newVariants[index], price: parseFloat(value) || 0 }
    } else {
      newVariants[index] = { ...newVariants[index], name: value }
    }
    setProductForm({ ...productForm, variants: newVariants })
  }

  const handleSaveProduct = async () => {
    setProductError(null)
    
    // Basic validation
    if (!currentStoreId) {
      setProductError("No hay tienda seleccionada")
      return
    }
    if (!productForm.name.trim()) {
      setProductError("El nombre del producto es requerido")
      return
    }
    if (!productForm.category.trim()) {
      setProductError("La categoria es requerida")
      return
    }
    
    // SPECIAL CASE: Pizza flavors have priceMap per tamaño
    // Prices are per sabor+tamaño, inventory is global by tamaño only
    const isPizzaFlavor = productForm.category.toLowerCase() === 'pizzas'
    const validVariants = isPizzaFlavor
      ? []
      : productForm.variants.filter(v => v.name.trim() && v.price > 0)
    const hasValidVariants = validVariants.length > 0
    const hasPrice = !!(productForm.price && parseFloat(productForm.price) > 0)
    
    if (isPizzaFlavor) {
      // Pizza: require at least one price in priceMap
      const hasPriceMap = Object.values(productForm.priceMap).some(p => p && parseFloat(p as string) > 0)
      if (!hasPriceMap) {
        setProductError("Define al menos un precio por tamaño")
        return
      }
    } else {
      // Check for incomplete variants (have name but no price or vice versa)
      const incompleteVariants = productForm.variants.filter(v => 
        (v.name.trim() && v.price <= 0) || (!v.name.trim() && v.price > 0)
      )
      
      if (incompleteVariants.length > 0) {
        setProductError("Hay variantes incompletas. Cada variante debe tener nombre y precio mayor a 0")
        return
      }
      
      if (!hasValidVariants && !hasPrice) {
        setProductError("Debe agregar al menos una variante con nombre y precio, o un precio base")
        return
      }
    }

    try {
      // Build clean product data object - NO undefined values allowed in Firestore
      const productData: Record<string, unknown> = {
        name: productForm.name.trim(),
        category: productForm.category.trim(),
        storeId: currentStoreId,
        available: productForm.available,
        active: true, // Set active to true for new products
      }

      if (isPizzaFlavor) {
        // Pizza: save priceMap (precios por tamaño: { PERSONAL: 18, FAMILIAR: 42, ... })
        // Convert priceMap strings to numbers and remove empty entries
        const cleanedPriceMap: Record<string, number> = {}
        for (const [massType, price] of Object.entries(productForm.priceMap)) {
          if (price && parseFloat(price as string) > 0) {
            cleanedPriceMap[massType] = parseFloat(price as string)
          }
        }
        productData.priceMap = cleanedPriceMap
      } else {
        // Non-pizza: handle variants or legacy price
        const cleanedVariants = validVariants.map(v => ({
          ...v,
          name: v.name.trim(),
          price: Number(v.price),
          id: v.id || crypto.randomUUID(),
        }))

        if (hasValidVariants) {
          productData.variants = cleanedVariants
        } else if (hasPrice) {
          productData.price = parseFloat(productForm.price)
        }
      }

      // Add createdAt for new products
      if (!editingProduct?.id) {
        productData.createdAt = new Date()
      }

      if (editingProduct?.id) {
        // For updates, we need to handle removing old fields
        // If switching from price to variants, remove price
        // If switching from variants to price, remove variants
        const updateData = { ...productData }
        
        if (hasValidVariants && editingProduct.price !== undefined) {
          // Switching to variants - need to remove price field
          // Firestore requires deleteField() for this, but our updateDocument may not support it
          // So we set price to null which is allowed
          updateData.price = null
        }
        if (!hasValidVariants && editingProduct.variants && editingProduct.variants.length > 0) {
          // Switching to price - need to remove variants field
          updateData.variants = null
        }
        
        await updateDocument(collections.products, editingProduct.id, updateData as Partial<Product>)
        
        // Auto-create inventory items for gaseosas (safe: won't block if it fails)
        try {
          const updatedProduct = {
            ...editingProduct,
            ...updateData,
          } as Product
          await ensureInventoryItemsForProduct(currentStoreId, updatedProduct)
        } catch (err) {
          console.warn("[Admin] Error creating inventory items during update:", err)
          // Don't throw - product was saved successfully
        }
      } else {
        const newProduct = await addDocument(collections.products, productData as unknown as Product)
        
        // Auto-create inventory items for gaseosas (safe: won't block if it fails)
        try {
          const savedProduct = {
            id: newProduct,
            ...productData,
          } as Product
          await ensureInventoryItemsForProduct(currentStoreId, savedProduct)
        } catch (err) {
          console.warn("[Admin] Error creating inventory items during creation:", err)
          // Don't throw - product was saved successfully
        }
      }
      
      // Invalidate product cache so other views get fresh data
      invalidateProductCache()
      setShowProductModal(false)
      loadData()
    } catch (error) {
      console.error("Error saving product:", error)
      setProductError("Error al guardar el producto: " + (error instanceof Error ? error.message : String(error)))
    }
  }

  // Deactivate product (admin only) - soft delete
  const handleDeactivateProduct = async (productId: string) => {
    if (!confirm("¿Está seguro de desactivar este producto?")) return
    
    console.log("Desactivando producto:", productId)
    
    try {
      await updateDocument(collections.products, productId, {
        active: false,
        available: false,
        updatedAt: new Date(),
      })
      
      console.log("Producto desactivado correctamente")
      
      invalidateProductCache()
      await loadData()
    } catch (error) {
      console.error("Error al desactivar producto:", error)
    }
  }

  // Delete product permanently (super_admin only)
  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("¿Está seguro de ELIMINAR PERMANENTEMENTE este producto? Esta acción no se puede deshacer.")) return
    
    console.log("Eliminando producto permanentemente:", productId)
    
    try {
      await hardDeleteDocument(collections.products, productId)
      
      console.log("Producto eliminado permanentemente")
      
      invalidateProductCache()
      await loadData()
    } catch (error) {
      console.error("Error al eliminar producto:", error)
    }
  }

  // User handlers
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setUserForm({
        name: user.name,
        pin: user.pin,
        role: user.role,
        active: user.active,
      })
    } else {
      setEditingUser(null)
      setUserForm({ name: "", pin: "", role: "mesero", active: true })
    }
    setShowUserModal(true)
  }

  const handleSaveUser = async () => {
    if (!currentStoreId || !userForm.name || !userForm.pin) return

    try {
      // For super_admin users, storeId can be empty (they can access all stores)
      const userData = {
        name: userForm.name,
        pin: userForm.pin,
        role: userForm.role,
        storeId: userForm.role === "super_admin" ? "" : currentStoreId,
        active: userForm.active,
      }

      if (editingUser?.id) {
        await updateDocument(collections.users, editingUser.id, userData)
      } else {
        await addDocument(collections.users, userData)
      }

      setShowUserModal(false)
      loadData()
    } catch (error) {
      console.error("Error saving user:", error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("¿Está seguro de eliminar este usuario?")) return
    try {
      await deleteDocument(collections.users, userId)
      loadData()
    } catch (error) {
      console.error("Error deleting user:", error)
    }
  }

  // Store handlers (super_admin only)
  const handleOpenStoreModal = (storeItem?: Store) => {
    if (storeItem) {
      setEditingStore(storeItem)
      setStoreForm({
        name: storeItem.name,
        code: storeItem.code,
        active: storeItem.active,
      })
    } else {
      setEditingStore(null)
      setStoreForm({ name: "", code: "", active: true })
    }
    setShowStoreModal(true)
  }

  const handleSaveStore = async () => {
    if (!storeForm.name || !storeForm.code) return

    try {
      const storeData = {
        name: storeForm.name,
        code: storeForm.code.toUpperCase(),
        active: !!storeForm.active, // Ensure boolean value
      }

      if (editingStore?.id) {
        await updateDocument(collections.stores, editingStore.id, storeData)
      } else {
        const newStoreId = await addDocument(collections.stores, storeData)
        // Initialize tables for new store
        await initializeStoreData(newStoreId, 10)
      }

      setShowStoreModal(false)
      loadData()
    } catch (error) {
      console.error("Error saving store:", error)
    }
  }

  // Table handlers
  const handleOpenTableModal = useCallback((table?: Table) => {
    setTableError(null)
    if (table) {
      setEditingTable(table)
      setTableForm({
        number: table.number.toString(),
        capacity: table.capacity.toString(),
        active: table.active,
      })
    } else {
      setEditingTable(null)
      setTableForm({ number: "", capacity: "4", active: true })
    }
    setShowTableModal(true)
  }, [])

  const handleSaveTable = async () => {
    // Role check: only super_admin can manage tables
    if (!isSuperAdmin) {
      setTableError("No tienes permisos para gestionar mesas")
      return
    }
    
    setTableError("")

    if (!currentStoreId) {
      setTableError("No hay tienda seleccionada")
      return
    }

    const tableNumber = parseInt(tableForm.number)
    const capacity = parseInt(tableForm.capacity)

    // Validations
    if (!tableForm.number || isNaN(tableNumber) || tableNumber <= 0) {
      setTableError("El numero de mesa debe ser un numero positivo")
      return
    }
    if (!tableForm.capacity || isNaN(capacity) || capacity <= 0) {
      setTableError("La capacidad debe ser mayor a 0")
      return
    }

    try {
      // Check if table number already exists
      const exists = await isTableNumberExists(
        currentStoreId,
        tableNumber,
        editingTable?.id
      )

      if (exists) {
        setTableError(`Ya existe una mesa con el numero ${tableNumber} en este local`)
        return
      }

      const tableData = {
        number: tableNumber,
        capacity: capacity,
        storeId: currentStoreId,
        active: tableForm.active,
      }

      if (editingTable?.id) {
        await updateDocument(collections.tables, editingTable.id, tableData)
      } else {
        await addDocument(collections.tables, {
          ...tableData,
          status: "available" as const,
        })
      }

      setShowTableModal(false)
      setEditingTable(null)
    } catch (error) {
      console.error("Error saving table:", error)
      setTableError("Error al guardar la mesa")
    }
  }

  const handleDeleteTable = async (tableId: string) => {
    // Role check: only super_admin can delete tables
    if (!isSuperAdmin) {
      console.error("Sin permisos para eliminar mesas")
      return
    }
    
    if (!confirm("Esta seguro de eliminar esta mesa?")) return
    try {
      await deleteDocument(collections.tables, tableId)
    } catch (error) {
      console.error("Error deleting table:", error)
    }
  }

  const handleToggleTableActive = async (table: Table) => {
    // Role check: only super_admin can toggle table status
    if (!isSuperAdmin) {
      console.error("Sin permisos para modificar mesas")
      return
    }
    
    if (!table.id) return
    try {
      await updateDocument(collections.tables, table.id, {
        active: !table.active,
      })
    } catch (error) {
      console.error("Error toggling table status:", error)
    }
  }

  const getStatusLabel = (status: Table["status"]) => {
    switch (status) {
      case "available":
        return "Disponible"
      case "occupied":
        return "Ocupada"
      case "reserved":
        return "Reservada"
      default:
        return status
    }
  }

  const getStatusColor = (status: Table["status"]) => {
    switch (status) {
      case "available":
        return "text-green-500"
      case "occupied":
        return "text-orange-500"
      case "reserved":
        return "text-blue-500"
      default:
        return "text-muted-foreground"
    }
  }

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = []
    }
    acc[product.category].push(product)
    return acc
  }, {} as Record<string, Product[]>)

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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-grid overflow-x-auto flex-nowrap">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Productos</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Usuarios</span>
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="tables" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Mesas</span>
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="stores" className="gap-2">
              <StoreIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Locales</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-base sm:text-lg font-semibold">Gestión de Productos</h2>
            <Button onClick={() => handleOpenProductModal()} className="gap-2 w-full sm:w-auto h-10">
              <Plus className="h-4 w-4" />
              Nuevo Producto
            </Button>
          </div>

          {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoryProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{product.name}</p>
                        {/* Show variants or legacy price */}
                        {product.variants && product.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {product.variants.map((variant, idx) => (
                              <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {variant.name}: S/ {variant.price.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        ) : product.price ? (
                          <p className="text-sm text-primary font-semibold">
                            S/ {product.price.toFixed(2)}
                          </p>
                        ) : null}
                        {!product.available && (
                          <span className="text-xs text-destructive">No disponible</span>
                        )}
                      </div>
<div className="flex gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 sm:h-8 sm:w-8"
                                          onClick={() => handleOpenProductModal(product)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        {isSuperAdmin ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 sm:h-8 sm:w-8 text-destructive"
                            onClick={() => handleDeleteProduct(product.id!)}
                            title="Eliminar permanentemente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 sm:h-8 sm:w-8 text-amber-600"
                            onClick={() => handleDeactivateProduct(product.id!)}
                            title="Desactivar producto"
                          >
                            <ToggleLeft className="h-4 w-4" />
                          </Button>
                        )}
                                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {products.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No hay productos registrados</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-base sm:text-lg font-semibold">Gestión de Usuarios</h2>
            <Button onClick={() => handleOpenUserModal()} className="gap-2 w-full sm:w-auto h-10">
              <Plus className="h-4 w-4" />
              Nuevo Usuario
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 sm:p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{user.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground capitalize">
                        {user.role.replace("_", " ")} • PIN: {user.pin}
                      </p>
                      {!user.active && (
                        <span className="text-xs text-destructive">Inactivo</span>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-8 sm:w-8"
                        onClick={() => handleOpenUserModal(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-8 sm:w-8 text-destructive"
                        onClick={() => handleDeleteUser(user.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No hay usuarios registrados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tables Tab (super_admin only) */}
        <TabsContent value="tables" className="space-y-4">
          {!isSuperAdmin ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sin permisos</h3>
                <p className="text-muted-foreground">
                  No tienes permisos para acceder a la gestión de mesas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base sm:text-lg font-semibold">Gestion de Mesas</h2>
                <Button onClick={() => handleOpenTableModal()} className="gap-2 w-full sm:w-auto h-10">
                  <Plus className="h-4 w-4" />
                  Nueva Mesa
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tables.map((table) => (
                  <Card
                    key={table.id}
                    className={`${!table.active ? "opacity-60" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-lg">Mesa {table.number}</p>
                          <p className="text-sm text-muted-foreground">
                            Capacidad: {table.capacity} personas
                          </p>
                          <p className={`text-sm ${getStatusColor(table.status)}`}>
                            {getStatusLabel(table.status)}
                          </p>
                          {!table.active && (
                            <span className="text-xs text-destructive">Inactiva</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenTableModal(table)}
                            title="Editar mesa"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDeleteTable(table.id!)}
                            title="Eliminar mesa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {tables.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No hay mesas registradas</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Stores Tab (super_admin only) */}
        {isSuperAdmin && (
          <TabsContent value="stores" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-base sm:text-lg font-semibold">Gestión de Locales</h2>
              <Button onClick={() => handleOpenStoreModal()} className="gap-2 w-full sm:w-auto h-10">
                <Plus className="h-4 w-4" />
                Nuevo Local
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map((storeItem) => (
                <Card key={storeItem.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{storeItem.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Código: {storeItem.code}
                        </p>
                        <span
                          className={`text-xs ${
                            storeItem.active ? "text-green-500" : "text-destructive"
                          }`}
                        >
                          {storeItem.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenStoreModal(storeItem)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Product Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {productForm.category?.toLowerCase() === 'pizzas' && (
                <Pizza className="h-5 w-5 text-orange-500" />
              )}
              {productForm.category?.toLowerCase() === 'pizzas' 
                ? (editingProduct ? "Editar Sabor de Pizza" : "Nuevo Sabor de Pizza")
                : (editingProduct ? "Editar Producto" : "Nuevo Producto")
              }
            </DialogTitle>
            {productForm.category?.toLowerCase() === 'pizzas' && (
              <p className="text-xs text-muted-foreground mt-1">
                Los sabores de pizza no requieren variantes ni precios - se configuran globalmente
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            {productError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{productError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {productForm.category?.toLowerCase() === 'pizzas' 
                  ? "Nombre del Sabor" 
                  : "Nombre del Producto"}
              </label>
              <Input
                value={productForm.name}
                onChange={(e) =>
                  setProductForm({ ...productForm, name: e.target.value })
                }
                placeholder={productForm.category?.toLowerCase() === 'pizzas' 
                  ? "Ej: Americana, Pepperoni, Hawaiana" 
                  : "Ej: Hamburguesa, Gaseosa, Combo"}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría</label>
              {isNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value)
                      setProductForm({ ...productForm, category: e.target.value })
                    }}
                    placeholder="Nombre de nueva categoría"
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsNewCategory(false)
                      setNewCategoryName("")
                      setProductForm({ ...productForm, category: "" })
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select
                  value={productForm.category}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setIsNewCategory(true)
                      setProductForm({ ...productForm, category: "" })
                    } else {
                      setProductForm({ ...productForm, category: value })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary font-medium">
                      + Crear nueva categoría
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* PIZZA MODE: Tabla de precios por tamaño */}
            {productForm.category?.toLowerCase() === 'pizzas' ? (
              <div className="space-y-4">
                {/* Explicación */}
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Inventario global por tamaño:</strong> El stock se maneja solo por PZ-PER, PZ-BIP, PZ-FAM, PZ-GIG, PZ-SGI.
                    <br />
                    <strong>Precios por sabor + tamaño:</strong> Define el precio de {productForm.name || 'este sabor'} en cada tamaño.
                  </p>
                </div>

                {/* Tabla de Precios */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Precios por Tamaño</label>
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                    {PIZZA_MASS_TYPES.map((massType) => (
                      <div key={massType} className="flex items-center gap-3 p-2 bg-background rounded border">
                        <div className="w-28 text-sm font-medium text-muted-foreground">
                          {PIZZA_SIZE_LABELS[massType]}
                        </div>
                        <div className="flex-1 flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">S/</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={productForm.priceMap[massType] || ''}
                            onChange={(e) => {
                              setProductForm({
                                ...productForm,
                                priceMap: {
                                  ...productForm.priceMap,
                                  [massType]: e.target.value
                                }
                              })
                            }}
                            placeholder="0.00"
                            className="w-24"
                          />
                        </div>
                        <div className="w-16 text-right text-xs text-muted-foreground">
                          {productForm.priceMap[massType] ? `S/ ${productForm.priceMap[massType]}` : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pizza Inventory Codes Reference */}
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">Códigos de Inventario (Stock Global):</p>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    <div className="bg-background rounded px-1 py-1.5 border text-[10px]">
                      <div className="font-mono font-bold">PZ-PER</div>
                    </div>
                    <div className="bg-background rounded px-1 py-1.5 border text-[10px]">
                      <div className="font-mono font-bold">PZ-BIP</div>
                    </div>
                    <div className="bg-background rounded px-1 py-1.5 border text-[10px]">
                      <div className="font-mono font-bold">PZ-FAM</div>
                    </div>
                    <div className="bg-background rounded px-1 py-1.5 border text-[10px]">
                      <div className="font-mono font-bold">PZ-GIG</div>
                    </div>
                    <div className="bg-background rounded px-1 py-1.5 border text-[10px]">
                      <div className="font-mono font-bold">PZ-SGI</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Variants Section - NON-PIZZA products only */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Variantes (Tamanos)</label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddVariant}>
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  
                  {productForm.variants.length > 0 ? (
                    <div className="space-y-2">
                      {productForm.variants.map((variant, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                          <Input
                            value={variant.name}
                            onChange={(e) => handleUpdateVariant(index, "name", e.target.value)}
                            placeholder="Nombre (Ej: Personal, Familiar)"
                            className="flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">S/</span>
                            <Input
                              type="number"
                              value={variant.price || ""}
                              onChange={(e) => handleUpdateVariant(index, "price", e.target.value)}
                              placeholder="0.00"
                              className="w-full sm:w-24"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive flex-shrink-0"
                              onClick={() => handleRemoveVariant(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sin variantes. Agrega tamanos como Personal, Mediana, Familiar, etc.
                    </p>
                  )}
                </div>

                {/* Legacy price - only show if no variants and NOT pizza */}
                {productForm.variants.length === 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Precio Base (S/) - Sin variantes</label>
                    <Input
                      type="number"
                      value={productForm.price}
                      onChange={(e) =>
                        setProductForm({ ...productForm, price: e.target.value })
                      }
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Usa este campo solo si el producto no tiene variantes de tamano.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="available"
                checked={productForm.available}
                onChange={(e) =>
                  setProductForm({ ...productForm, available: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="available" className="text-sm">
                Disponible para venta
              </label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="h-10" onClick={() => setShowProductModal(false)}>
              Cancelar
            </Button>
            <Button className="h-10" onClick={handleSaveProduct}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Modal */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={userForm.name}
                onChange={(e) =>
                  setUserForm({ ...userForm, name: e.target.value })
                }
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">PIN (4-6 dígitos)</label>
              <Input
                value={userForm.pin}
                onChange={(e) =>
                  setUserForm({ ...userForm, pin: e.target.value })
                }
                placeholder="****"
                maxLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rol</label>
              <Select
                value={userForm.role}
                onValueChange={(value: User["role"]) =>
                  setUserForm({ ...userForm, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mesero">Mesero</SelectItem>
                  <SelectItem value="cocina">Cocina</SelectItem>
                  <SelectItem value="cajero">Cajero</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={userForm.active}
                onChange={(e) =>
                  setUserForm({ ...userForm, active: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="active" className="text-sm">
                Usuario activo
              </label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="h-10" onClick={() => setShowUserModal(false)}>
              Cancelar
            </Button>
            <Button className="h-10" onClick={handleSaveUser}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Modal */}
      <Dialog open={showStoreModal} onOpenChange={setShowStoreModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStore ? "Editar Local" : "Nuevo Local"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del Local</label>
              <Input
                value={storeForm.name}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, name: e.target.value })
                }
                placeholder="Ej: LifeSystemSolution Jesus Maria"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Código (3-4 letras)</label>
              <Input
                value={storeForm.code}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, code: e.target.value.toUpperCase() })
                }
                placeholder="Ej: MSF"
                maxLength={4}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="storeActive"
                checked={storeForm.active}
                onChange={(e) =>
                  setStoreForm({ ...storeForm, active: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="storeActive" className="text-sm">
                Local activo
              </label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="h-10" onClick={() => setShowStoreModal(false)}>
              Cancelar
            </Button>
            <Button className="h-10" onClick={handleSaveStore}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Modal */}
      <Dialog open={showTableModal} onOpenChange={setShowTableModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTable ? "Editar Mesa" : "Nueva Mesa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {tableError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{tableError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Numero de Mesa</label>
              <Input
                type="number"
                value={tableForm.number}
                onChange={(e) =>
                  setTableForm({ ...tableForm, number: e.target.value })
                }
                placeholder="Ej: 1"
                min={1}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Capacidad (personas)</label>
              <Input
                type="number"
                value={tableForm.capacity}
                onChange={(e) =>
                  setTableForm({ ...tableForm, capacity: e.target.value })
                }
                placeholder="Ej: 4"
                min={1}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tableActive"
                checked={tableForm.active}
                onChange={(e) =>
                  setTableForm({ ...tableForm, active: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="tableActive" className="text-sm">
                Mesa activa
              </label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="h-10" onClick={() => setShowTableModal(false)}>
              Cancelar
            </Button>
            <Button className="h-10" onClick={handleSaveTable}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
