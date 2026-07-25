import { useEffect, useMemo, useRef, useState } from "react"
import ClientesService, { type ClienteLocal, type TipoDocumentoCliente } from "@/lib/services/clientes-service"
import type { TipoComprobante } from "@/lib/models/comprobante"

export interface DocumentLookupData {
  tipoDocumento: TipoDocumentoCliente
  numeroDocumento: string
  razonSocial: string
  nombreCompleto?: string
  nombres?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  direccion?: string
  estado?: string
  condicion?: string
}

type LookupSource = "local" | "cache" | "proveedor"

interface UseDocumentLookupParams {
  tipoComprobante: TipoComprobante
  documento: string
  tenantId?: string | null
  onCompleted: (cliente: ClienteLocal, source: LookupSource) => void
  onMessage?: (message: string, variant?: "default" | "destructive") => void
}

const MENSAJES: Record<LookupSource, string> = {
  local: "Cliente encontrado",
  cache: "Datos obtenidos desde cache",
  proveedor: "Cliente consultado correctamente",
}

function getLookupConfig(tipoComprobante: TipoComprobante) {
  if (tipoComprobante === "BOLETA") return { length: 8, tipoDocumento: "1" as TipoDocumentoCliente, tipoConsulta: "dni" }
  if (tipoComprobante === "FACTURA") return { length: 11, tipoDocumento: "6" as TipoDocumentoCliente, tipoConsulta: "ruc" }
  return null
}

function mapApiDataToCliente(data: DocumentLookupData, tenantId: string): Parameters<typeof ClientesService.guardarDesdeConsulta>[0] {
  return {
    tenantId,
    storeId: tenantId,
    tipo_documento: data.tipoDocumento,
    numero_documento: data.numeroDocumento,
    razon_social: data.razonSocial || data.nombreCompleto || "",
    nombre_completo: data.nombreCompleto || data.razonSocial || "",
    nombres: data.nombres || "",
    apellido_paterno: data.apellidoPaterno || "",
    apellido_materno: data.apellidoMaterno || "",
    direccion: data.direccion || "",
    estado: data.estado || "",
    condicion: data.condicion || "",
  }
}

export function useDocumentLookup({ tipoComprobante, documento, tenantId, onCompleted, onMessage }: UseDocumentLookupParams) {
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const config = useMemo(() => getLookupConfig(tipoComprobante), [tipoComprobante])
  const normalizedDocument = documento.replace(/\D/g, "")

  useEffect(() => {
    abortRef.current?.abort()
    setStatusMessage(null)

    if (!config || !tenantId || normalizedDocument.length !== config.length) {
      setIsLookingUp(false)
      return
    }

    const requestId = ++requestRef.current
    const controller = new AbortController()
    abortRef.current = controller

    const timeout = window.setTimeout(async () => {
      setIsLookingUp(true)

      try {
        const local = await ClientesService.buscarPorDocumento(tenantId, config.tipoDocumento, normalizedDocument)
        if (requestRef.current !== requestId || controller.signal.aborted) return

        if (local) {
          setStatusMessage(MENSAJES.local)
          onMessage?.(MENSAJES.local)
          onCompleted(local, "local")
          return
        }

        const res = await fetch(`/api/consultas/documento?tipo=${config.tipoConsulta}&numero=${normalizedDocument}`, {
          signal: controller.signal,
        })
        const json = await res.json()
        if (requestRef.current !== requestId || controller.signal.aborted) return

        if (!res.ok || !json?.ok || !json?.datos) {
          throw new Error(json?.mensaje || "No se pudo consultar el documento")
        }

        const source: LookupSource = json.fuente === "cache" ? "cache" : "proveedor"
        const cliente = await ClientesService.guardarDesdeConsulta(mapApiDataToCliente(json.datos, tenantId))
        if (requestRef.current !== requestId || controller.signal.aborted) return

        setStatusMessage(MENSAJES[source])
        onMessage?.(MENSAJES[source])
        onCompleted(cliente, source)
      } catch (error: any) {
        if (error?.name === "AbortError") return
        const message = "No se pudo consultar el documento. Puede completar los datos manualmente."
        setStatusMessage(message)
        onMessage?.(message, "destructive")
      } finally {
        if (requestRef.current === requestId && !controller.signal.aborted) {
          setIsLookingUp(false)
        }
      }
    }, 400)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [config, normalizedDocument, onCompleted, onMessage, tenantId])

  return { isLookingUp, statusMessage }
}
