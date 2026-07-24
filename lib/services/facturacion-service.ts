import type { Order, OrderItem } from "@/lib/firebase/firestore"
import { addDocument, getDocuments, updateDocument, collections } from "@/lib/firebase/firestore"
import { db } from "@/lib/firebase/config"
import { where, orderBy, query, collection, onSnapshot } from "firebase/firestore"
import type {
  ClienteComprobante,
  ComprobanteRegistro,
  ComprobanteResultado,
  ItemComprobanteApi,
  TipoComprobante,
} from "@/lib/models/comprobante"

// El tipo Order declarado en firestore.ts no incluye `items`, pero el documento real en
// Firestore sí lo trae embebido (asi lo usa el resto del POS, ej. app/caja/page.tsx).
type OrderConItems = Order & { id: string; items?: OrderItem[] }

// Firestore rechaza cualquier campo con valor `undefined` (addDoc/updateDoc lanzan
// FirebaseError: "Unsupported field value: undefined"). Los campos que vienen de la
// respuesta de la API (sunatStatus, sunatCode, sunatDescription, pdfUrl, xmlUrl, etc.)
// pueden no venir en la respuesta, así que se limpian antes de escribir en Firestore.
function limpiarUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

function construirItems(order: OrderConItems): ItemComprobanteApi[] {
  return (order.items || [])
    .filter((i) => !i.cancelled)
    .map((i) => ({
      codigo: i.productId,
      descripcion: i.variantName ? `${i.productName} - ${i.variantName}` : i.productName,
      unidad: "NIU",
      cantidad: i.quantity,
      precio_unitario: i.price,
      tip_afe_igv: "10",
    }))
}

export const ClienteVarios: ClienteComprobante = {
  tipoDoc: "0",
  numDoc: "00000000",
  razonSocial: "CLIENTE VARIOS",
}

export const FacturacionService = {
  /**
   * Emite el comprobante (nota de venta, boleta o factura) llamando a la API externa
   * a traves de nuestra ruta interna /api/facturacion, y guarda el resultado en Firestore
   * (coleccion "comprobantes") para poder listarlo despues en la seccion Comprobantes.
   */
  async emitir(params: {
    tipo: TipoComprobante
    order: OrderConItems
    cliente: ClienteComprobante
    userId?: string
    userName?: string
  }): Promise<ComprobanteResultado> {
    const { tipo, order, cliente, userId, userName } = params

    const items = construirItems(order)
    if (items.length === 0) {
      return { tipo, ok: false, mensaje: "El pedido no tiene items validos para facturar" }
    }

    const res = await fetch("/api/facturacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        orderId: order.id,
        storeId: order.storeId,
        cliente,
        items,
        observacion: order.notes || undefined,
      }),
    })

    const resultado: ComprobanteResultado = await res.json()

    if (!resultado.ok) {
      return resultado
    }

    // Guardamos copia local (no bloqueante: si esto falla, el comprobante ya existe en la API/SUNAT)
    try {
      const igv = Number((order.total - order.total / 1.18).toFixed(2))
      const subtotal = Number((order.total - igv).toFixed(2))

      const documento = limpiarUndefined({
        storeId: order.storeId,
        orderId: order.id,
        tipo,
        cliente,
        subtotal,
        igv,
        total: order.total,
        externalId: resultado.externalId,
        serie: resultado.serie,
        correlativo: resultado.correlativo,
        numeroCompleto: resultado.numeroCompleto,
        sunatStatus: resultado.sunatStatus,
        sunatCode: resultado.sunatCode,
        sunatDescription: resultado.sunatDescription,
        pdfUrl: resultado.pdfUrl,
        xmlUrl: resultado.xmlUrl,
        userId,
        userName,
      })

      await addDocument<Omit<ComprobanteRegistro, "id">>(
        collections.comprobantes,
        documento as Omit<ComprobanteRegistro, "id">
      )
    } catch (e) {
      console.error("No se pudo guardar el comprobante localmente (ya fue emitido en la API):", e)
    }

    return resultado
  },

  /** Lista los comprobantes emitidos para la seccion "Comprobantes" */
  async listar(storeId: string): Promise<ComprobanteRegistro[]> {
    return getDocuments<ComprobanteRegistro>(
      collections.comprobantes,
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc")
    )
  },

  /** Suscripcion en tiempo real, para Dashboard/Reportes y la seccion Comprobantes */
  subscribir(storeId: string, callback: (comprobantes: ComprobanteRegistro[]) => void): () => void {
    const q = query(
      collection(db, collections.comprobantes),
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc")
    )
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ComprobanteRegistro))
      callback(data)
    })
  },

  /** Vuelve a consultar el estado ante SUNAT de un comprobante y actualiza la copia local */
  async refrescarEstado(comprobante: ComprobanteRegistro): Promise<ComprobanteRegistro> {
    if (!comprobante.id || !comprobante.externalId || comprobante.tipo === "NOTA_VENTA") {
      return comprobante
    }

    const res = await fetch(`/api/facturacion?tipo=${comprobante.tipo}&id=${comprobante.externalId}`)
    const json = await res.json()

    if (!json.ok) return comprobante

    const actualizado: ComprobanteRegistro = {
      ...comprobante,
      sunatStatus: json.sunatStatus,
      sunatCode: json.sunatCode,
      sunatDescription: json.sunatDescription,
      pdfUrl: json.pdfUrl || comprobante.pdfUrl,
      xmlUrl: json.xmlUrl || comprobante.xmlUrl,
    }

    try {
      const cambios = limpiarUndefined({
        sunatStatus: actualizado.sunatStatus,
        sunatCode: actualizado.sunatCode,
        sunatDescription: actualizado.sunatDescription,
        pdfUrl: actualizado.pdfUrl,
        xmlUrl: actualizado.xmlUrl,
      })

      await updateDocument(collections.comprobantes, comprobante.id, cambios)
    } catch (e) {
      console.error("No se pudo guardar el estado actualizado localmente:", e)
    }

    return actualizado
  },
}

export default FacturacionService