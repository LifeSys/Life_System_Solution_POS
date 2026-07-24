"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Receipt, FileText, FileCode, RefreshCw, Search, X } from "lucide-react"
import { toPeruDate, formatCurrency } from "@/lib/utils"
import FacturacionService from "@/lib/services/facturacion-service"
import type { ComprobanteRegistro, TipoComprobante } from "@/lib/models/comprobante"

const TIPO_LABEL: Record<TipoComprobante, string> = {
  NOTA_VENTA: "Nota de Venta",
  BOLETA: "Boleta",
  FACTURA: "Factura",
}

function EstadoBadge({ estado, tipo }: { estado?: string; tipo: TipoComprobante }) {
  if (tipo === "NOTA_VENTA") {
    return <Badge variant="secondary">Interno</Badge>
  }
  switch (estado) {
    case "aceptado":
      return <Badge className="bg-green-600 hover:bg-green-600">Aceptado</Badge>
    case "rechazado":
      return <Badge variant="destructive">Rechazado</Badge>
    case "enviado":
    case "pendiente":
      return <Badge className="bg-amber-500 hover:bg-amber-500">Pendiente</Badge>
    case "anulado":
      return <Badge variant="outline">Anulado</Badge>
    default:
      return <Badge variant="outline">{estado || "Sin estado"}</Badge>
  }
}

export default function ComprobantesPage() {
  const { currentStoreId } = useAuth()
  const { toast } = useToast()

  const [comprobantes, setComprobantes] = useState<ComprobanteRegistro[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refrescandoId, setRefrescandoId] = useState<string | null>(null)

  const [tipoFilter, setTipoFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (!currentStoreId) {
      setIsLoading(false)
      return
    }
    let cancelado = false

    async function cargar() {
      setIsLoading(true)
      try {
        const data = await FacturacionService.listar(currentStoreId!)
        if (!cancelado) setComprobantes(data)
      } catch (e) {
        console.error("Error cargando comprobantes:", e)
        toast({ title: "Error", description: "No se pudieron cargar los comprobantes", variant: "destructive" })
      } finally {
        if (!cancelado) setIsLoading(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoreId])

  const filtrados = useMemo(() => {
    return comprobantes.filter((c) => {
      if (tipoFilter !== "all" && c.tipo !== tipoFilter) return false

      if (startDate || endDate) {
        const fecha = c.createdAt ? toPeruDate(c.createdAt).toISOString().split("T")[0] : ""
        if (startDate && fecha < startDate) return false
        if (endDate && fecha > endDate) return false
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const enNumero = c.numeroCompleto?.toLowerCase().includes(q)
        const enCliente = c.cliente?.razonSocial?.toLowerCase().includes(q) || c.cliente?.numDoc?.includes(q)
        if (!enNumero && !enCliente) return false
      }

      return true
    })
  }, [comprobantes, tipoFilter, search, startDate, endDate])

  const resumen = useMemo(() => {
    return filtrados.reduce(
      (acc, c) => {
        acc.total += c.total || 0
        acc.cantidad += 1
        acc.porTipo[c.tipo] = (acc.porTipo[c.tipo] || 0) + 1
        return acc
      },
      { total: 0, cantidad: 0, porTipo: {} as Record<string, number> }
    )
  }, [filtrados])

  const handleRefrescar = async (c: ComprobanteRegistro) => {
    if (!c.id) return
    setRefrescandoId(c.id)
    try {
      const actualizado = await FacturacionService.refrescarEstado(c)
      setComprobantes((prev) => prev.map((x) => (x.id === c.id ? actualizado : x)))
    } catch (e) {
      toast({ title: "Error", description: "No se pudo consultar el estado en SUNAT", variant: "destructive" })
    } finally {
      setRefrescandoId(null)
    }
  }

  const limpiarFiltros = () => {
    setTipoFilter("all")
    setSearch("")
    setStartDate("")
    setEndDate("")
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-10 w-10 text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="h-6 w-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">Comprobantes</h1>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total emitido</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(resumen.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Comprobantes</p>
            <p className="text-xl font-bold">{resumen.cantidad}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Boletas</p>
            <p className="text-xl font-bold">{resumen.porTipo["BOLETA"] || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Facturas</p>
            <p className="text-xl font-bold">{resumen.porTipo["FACTURA"] || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="NOTA_VENTA">Nota de Venta</SelectItem>
              <SelectItem value="BOLETA">Boleta</SelectItem>
              <SelectItem value="FACTURA">Factura</SelectItem>
            </SelectContent>
          </Select>

          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <div className="relative sm:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por número, cliente o RUC/DNI"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {(tipoFilter !== "all" || search || startDate || endDate) && (
            <Button variant="ghost" size="sm" className="gap-1 justify-self-start" onClick={limpiarFiltros}>
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado SUNAT</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay comprobantes que coincidan con los filtros
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {c.createdAt ? toPeruDate(c.createdAt).toLocaleString("es-PE") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TIPO_LABEL[c.tipo]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{c.numeroCompleto || "-"}</TableCell>
                    <TableCell className="text-sm">
                      <div>{c.cliente?.razonSocial || "Cliente Varios"}</div>
                      {c.cliente?.numDoc && c.cliente.numDoc !== "00000000" && (
                        <div className="text-xs text-muted-foreground">{c.cliente.numDoc}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(c.total)}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={c.sunatStatus} tipo={c.tipo} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {c.tipo !== "NOTA_VENTA" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Actualizar estado SUNAT"
                            onClick={() => handleRefrescar(c)}
                            disabled={refrescandoId === c.id}
                          >
                            {refrescandoId === c.id ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {c.pdfUrl && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver PDF" asChild>
                            <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {c.xmlUrl && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver XML" asChild>
                            <a href={c.xmlUrl} target="_blank" rel="noopener noreferrer">
                              <FileCode className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
