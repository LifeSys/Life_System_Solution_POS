"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GastosDashboard } from "@/components/gastos/dashboard"
import { GastosRegistration } from "@/components/gastos/registration"
import { GastosHistory } from "@/components/gastos/history"
import { ProvidersManagement } from "@/components/gastos/providers"
import { GastosReports } from "@/components/gastos/reports"

export default function GastosPage() {
  const { user, store } = useAuth()
  const [activeTab, setActiveTab] = useState("dashboard")

  if (!user || !store) return null

  const isAdmin = user.role === "admin" || user.role === "admin_global"
  const isCajero = user.role === "cajero"

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="gastos">Registrar Gasto</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          {isAdmin && <TabsTrigger value="proveedores">Proveedores</TabsTrigger>}
          {isAdmin && <TabsTrigger value="reportes">Reportes</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <GastosDashboard />
        </TabsContent>

        <TabsContent value="gastos" className="space-y-4">
          <GastosRegistration />
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <GastosHistory />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="proveedores" className="space-y-4">
            <ProvidersManagement />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="reportes" className="space-y-4">
            <GastosReports />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
