"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getProviders, registerProvider } from "@/lib/firebase/firestore"
import { Plus, Building2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export function ProvidersManagement() {
  const { store } = useAuth()
  const { toast } = useToast()
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
  })

  if (!store) return null

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await getProviders(store.id!)
        setProviders(data)
      } catch (error) {
        console.error("Error loading providers:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los proveedores",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadProviders()
  }, [store.id, toast])

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast({
        title: "Error",
        description: "Ingresa el nombre del proveedor",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const newProviderId = await registerProvider(store.id!, {
        storeId: store.id!,
        name: formData.name,
        contact: formData.contact,
        phone: formData.phone,
        email: formData.email,
        balance: 0,
        totalPaid: 0,
        active: true,
      })

      setProviders([
        ...providers,
        {
          id: newProviderId,
          ...formData,
          balance: 0,
          totalPaid: 0,
          active: true,
        },
      ])

      toast({
        title: "Éxito",
        description: "Proveedor agregado correctamente",
      })

      setFormData({ name: "", contact: "", phone: "", email: "" })
      setShowForm(false)
    } catch (error) {
      console.error("Error adding provider:", error)
      toast({
        title: "Error",
        description: "No se pudo agregar el proveedor",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Proveedores
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <form onSubmit={handleAddProvider} className="p-4 border rounded-lg space-y-3">
              <Input
                placeholder="Nombre del proveedor"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <Input
                placeholder="Contacto"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              />
              <Input
                placeholder="Teléfono"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {loading && !showForm ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay proveedores registrados</p>
          ) : (
            <div className="space-y-2">
              {providers.map((provider) => (
                <div key={provider.id} className="p-3 border rounded-lg">
                  <p className="font-medium">{provider.name}</p>
                  {provider.contact && (
                    <p className="text-xs text-muted-foreground">{provider.contact}</p>
                  )}
                  <p className="text-sm text-amber-600 mt-1">
                    Deuda: {formatCurrency(Math.abs(provider.balance))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
