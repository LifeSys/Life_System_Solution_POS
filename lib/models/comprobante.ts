// Tipos para la integracion con la API de facturacion electronica (LifeSystemSolution-API-SUNAT)

export type TipoComprobante = "NOTA_VENTA" | "BOLETA" | "FACTURA"

export interface ClienteComprobante {
  tipoDoc: "1" | "6" | "0" // 1=DNI, 6=RUC, 0=Sin documento (varios)
  numDoc: string
  razonSocial: string
  direccion?: string
}

// Item tal como lo espera la API SUNAT (ver documentacion/04-Facturas.md del repo API)
export interface ItemComprobanteApi {
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  tip_afe_igv: string
}

export interface EmitirComprobanteRequest {
  tipo: TipoComprobante
  orderId: string
  storeId: string
  cliente: ClienteComprobante
  observacion?: string
}

// Respuesta normalizada que devuelve nuestra ruta /api/facturacion
export interface ComprobanteResultado {
  tipo: TipoComprobante
  ok: boolean
  externalId?: number | string
  serie?: string
  correlativo?: number
  numeroCompleto?: string
  sunatStatus?: string
  sunatCode?: string | null
  sunatDescription?: string | null
  pdfUrl?: string
  xmlUrl?: string
  mensaje?: string // presente cuando ok=false
}

// Documento que guardamos en Firestore (coleccion "comprobantes") como cache/listado local.
// La fuente de verdad legal (numeracion, estado ante SUNAT) vive en la API externa.
export interface ComprobanteRegistro {
  id?: string
  storeId: string
  orderId: string
  tipo: TipoComprobante
  cliente: ClienteComprobante
  subtotal: number
  igv: number
  total: number
  externalId?: number | string
  serie?: string
  correlativo?: number
  numeroCompleto?: string
  sunatStatus?: string
  pdfUrl?: string
  xmlUrl?: string
  userId?: string
  userName?: string
  createdAt?: any
}
