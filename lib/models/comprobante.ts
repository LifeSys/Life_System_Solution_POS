// lib/models/comprobante.ts
export type TipoComprobante = "BOLETA" | "FACTURA" | "NOTA_VENTA"

export interface ClienteComprobante {
  tipoDoc: string
  numDoc: string
  razonSocial: string
  direccion?: string
  email?: string
  telefono?: string
}

// Coincide exactamente con items.* de StoreBoletaRequest / StoreInvoiceRequest.
// Requeridos: descripcion, unidad, cantidad, precio_unitario. El resto es nullable.
export interface ItemComprobanteApi {
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number

  codigo?: string
  cod_producto_sunat?: string
  porcentaje_igv?: number
  tip_afe_igv?: string
  igv?: number
  isc?: number
  porcentaje_isc?: number
  tip_sis_isc?: string
  icbper?: number
  factor_icbper?: number
  mto_valor_unitario?: number
  mto_valor_venta?: number
  mto_base_igv?: number
  total_impuestos?: number
  descuentos?: number
}

export interface EmitirComprobanteRequest {
  tipo: TipoComprobante
  cliente: ClienteComprobante
  items: ItemComprobanteApi[]

  fechaEmision?: string
  // Solo aplican a BOLETA / FACTURA (nullable en el FormRequest, NOTA_VENTA no los usa)
  fechaVencimiento?: string
  codLocal?: string
  tipoOperacion?: string
  tipoMoneda?: string
  formaPago?: string
}

// Forma de cada elemento devuelto por GET /v1/series
export interface SerieApi {
  id: number | string
  tipo_documento: string
  serie: string
  correlativo: number
  sucursal?: string
  is_active: boolean
}