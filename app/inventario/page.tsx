"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { subscribeToStoreInventory, updateInventoryStock, addInventoryStock, type InventoryItem, type Product, getDocuments, collections } from "@/lib/firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Package, PackagePlus, Search, Edit2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface ProductInfo {
  id: string
  name: string
  category: string
}

export default function InventarioPage() {
  const { store } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Map<string, ProductInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [editingStock, setEditingStock] = useState<string>("")
  const [incomingStockByItem, setIncomingStockByItem] = useState<Record<string, string>>({})
  const [savingIncomingId, setSavingIncomingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Load products on mount
  useEffect(() => {
    if (!store?.id) return

    const loadProducts = async () => {
      try {
        const allProducts = await getDocuments<Product>(
          collections.products,
          // firestore where for storeId
        )
        const productMap = new Map<string, ProductInfo>()
        allProducts.forEach(p => {
          productMap.set(p.id || "", {
            id: p.id || "",
            name: p.name,
            category: p.category,
          })
        })
        setProducts(productMap)
      } catch (err) {
        console.error("Error loading products:", err)
      }
    }

    loadProducts()
  }, [store?.id])

  // Subscribe to inventory in real-time
  useEffect(() => {
    if (!store?.id) return

    const unsubscribe = subscribeToStoreInventory(store.id, (items) => {
      setInventory(items)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [store?.id])

  // Filter and search inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const product = products.get(item.productId)
      const matchesSearch = 
        item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.variantName?.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategory = categoryFilter === "all" || product?.category === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [inventory, products, searchQuery, categoryFilter])

  const categories = Array.from(new Set(Array.from(products.values()).map(p => p.category)))

  // Handle edit dialog open
  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item)
    setEditingStock(String(item.currentStock))
  }

  // Handle edit dialog close
  const handleCloseDialog = () => {
    setEditingItem(null)
    setEditingStock("")
  }

  // Handle save stock
  const handleSaveStock = async () => {
    if (!editingItem?.id) return
    
    const newStock = parseInt(editingStock, 10)
    if (isNaN(newStock) || newStock < 0) {
      alert("Por favor ingresa un número válido mayor o igual a 0")
      return
    }

    try {
      setIsSaving(true)
      await updateInventoryStock(editingItem.id, newStock)
      handleCloseDialog()
    } catch (error) {
      console.error("Error al actualizar stock:", error)
      alert("Error al actualizar el stock")
    } finally {
      setIsSaving(false)
    }
  }

  const handleIncomingStockChange = (itemId: string, value: string) => {
    setIncomingStockByItem((current) => ({
      ...current,
      [itemId]: value,
    }))
  }

  const handleAddIncomingStock = async (item: InventoryItem) => {
    const itemId = item.id
    if (!itemId) return

    const incomingStock = parseInt(incomingStockByItem[itemId] || "", 10)
    if (isNaN(incomingStock) || incomingStock <= 0) {
      alert("Por favor ingresa cuántos productos llegaron. Debe ser mayor a 0")
      return
    }

    try {
      setSavingIncomingId(itemId)
      await addInventoryStock(itemId, incomingStock)
      setIncomingStockByItem((current) => ({
        ...current,
        [itemId]: "",
      }))
    } catch (error) {
      console.error("Error al ingresar stock:", error)
      alert("Error al ingresar el stock")
    } finally {
      setSavingIncomingId(null)
    }
  }

  // Calculate summary
  const summary = useMemo(() => {
    const totalItems = filteredInventory.length
    const lowStockCount = filteredInventory.filter(i => i.currentStock > 0 && i.currentStock < 10).length
    const outOfStockCount = filteredInventory.filter(i => i.currentStock === 0).length
    
    return {
      totalItems,
      lowStockCount,
      outOfStockCount,
    }
  }, [filteredInventory])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Productos</p>
            <p className="text-2xl font-bold">{summary.totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Bajo Stock</p>
            <p className="text-2xl font-bold text-orange-600">{summary.lowStockCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Productos Agotados</p>
            <p className="text-2xl font-bold text-destructive">{summary.outOfStockCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Search */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Inventory Table */}
            {filteredInventory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium">Producto</th>
                      <th className="text-left py-2 px-2 font-medium">Variante</th>
                      <th className="text-right py-2 px-2 font-medium">Stock</th>
                      <th className="text-center py-2 px-2 font-medium">Estado</th>
                      <th className="text-left py-2 px-2 font-medium">Ingreso</th>
                      <th className="text-center py-2 px-2 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map(item => (
                      <tr key={item.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <span className="font-medium">{item.productName}</span>
                        </td>
                        <td className="py-3 px-2">
                          {item.variantName ? (
                            <span className="text-muted-foreground">{item.variantName}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold">
                          {item.currentStock}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {item.currentStock === 0 ? (
                            <Badge variant="destructive">Agotado</Badge>
                          ) : item.currentStock < 10 ? (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-200">Bajo</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">OK</Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex min-w-[180px] items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={incomingStockByItem[item.id || ""] || ""}
                              onChange={(e) => item.id && handleIncomingStockChange(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddIncomingStock(item)
                              }}
                              className="h-8 w-24"
                              placeholder="Ej. 15"
                              disabled={savingIncomingId === item.id}
                              aria-label={`Cantidad que ingresa para ${item.productName}`}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => handleAddIncomingStock(item)}
                              disabled={savingIncomingId === item.id}
                            >
                              <PackagePlus className="mr-1 h-4 w-4" />
                              {savingIncomingId === item.id ? "Sumando..." : "Sumar"}
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditClick(item)}
                            aria-label={`Editar stock de ${item.productName}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay productos en el inventario
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Stock Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Stock</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Producto</p>
                <p className="font-medium">{editingItem.productName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Variante</p>
                <p className="font-medium">{editingItem.variantName || "Sin variante"}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Stock Actual</label>
                <Input
                  type="number"
                  min="0"
                  value={editingStock}
                  onChange={(e) => setEditingStock(e.target.value)}
                  className="mt-1"
                  placeholder="Ingresa la cantidad"
                  disabled={isSaving}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveStock}
              disabled={isSaving}
            >
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
