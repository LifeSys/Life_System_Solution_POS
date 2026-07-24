// app/api/facturacion/route.ts
import { NextRequest, NextResponse } from "next/server"
import type { EmitirComprobanteRequest, TipoComprobante, SerieApi } from "@/lib/models/comprobante"

// Estas variables viven SOLO en el servidor (Railway/Vercel env vars), nunca llegan al navegador.
const BASE_URL = process.env.SUNAT_API_BASE_URL // ej: https://tu-api-sunat.up.railway.app/api/v1
const API_KEY = process.env.SUNAT_API_KEY
const API_SECRET = process.env.SUNAT_API_SECRET

const ENDPOINT_POR_TIPO: Record<TipoComprobante, string> = {
  BOLETA: "boletas",
  FACTURA: "facturas",
  NOTA_VENTA: "notas-venta",
}

// Mapea el tipo interno del POS al valor real que devuelve Laravel en el campo "tipo" (minúsculas).
const TIPO_SERIE_ESPERADO: Record<"BOLETA" | "FACTURA", string> = {
  BOLETA: "boleta",
  FACTURA: "factura",
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY as string,
    "X-Api-Secret": API_SECRET as string,
  }
}

// La serie es autoritativa de Laravel (tabla series). Nunca se hardcodea en el POS.
// StoreBoletaRequest exige serie con formato ^B[A-Z0-9]{3}$ y StoreInvoiceRequest ^F[A-Z0-9]{3}$,
// por eso se obtiene la serie activa correspondiente antes de armar el payload.
async function obtenerSerieActiva(tipo: "BOLETA" | "FACTURA"): Promise<string> {
  const res = await fetch(`${BASE_URL!.replace(/\/+$/, "")}/series?tipo=${tipo}`, {
    headers: { "X-Api-Key": API_KEY as string, "X-Api-Secret": API_SECRET as string },
  })
  const text = await res.text()

  console.log("====================================")
  console.log("CONSULTANDO SERIES")
  console.log("TIPO:", tipo)
  console.log("STATUS:", res.status)
  console.log("BODY:", text)
  console.log("====================================")
  let json = null
  try {
    json = JSON.parse(text)
  } catch { }

  if (!res.ok || json?.estado === "error") {
    throw new Error(json?.mensaje || `No se pudo consultar las series para ${tipo}`)
  }

  const series: SerieApi[] = json?.datos || []
  const tipoEsperado = TIPO_SERIE_ESPERADO[tipo]

  const serieValida = series.find(
    (s) => s.tipo === tipoEsperado && s.activo === true
  )

  if (!serieValida?.serie) {
    throw new Error(
      `No se encontró una serie activa de tipo "${tipoEsperado}" para ${tipo}. Verifica /api/v1/series`
    )
  }

  return serieValida.serie
}

export async function POST(req: NextRequest) {
  try {
    if (!BASE_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { ok: false, mensaje: "Faltan configurar SUNAT_API_BASE_URL / SUNAT_API_KEY / SUNAT_API_SECRET en el servidor" },
        { status: 500 }
      )
    }

    const body: EmitirComprobanteRequest = await req.json()

    if (!body.tipo || !body.items?.length) {
      return NextResponse.json({ ok: false, mensaje: "tipo e items son requeridos" }, { status: 400 })
    }

    const endpoint = ENDPOINT_POR_TIPO[body.tipo]
    if (!endpoint) {
      return NextResponse.json({ ok: false, mensaje: `Tipo de comprobante desconocido: ${body.tipo}` }, { status: 400 })
    }

    // Campos required por StoreBoletaRequest / StoreInvoiceRequest / validate() de SaleNoteController
    if (!body.cliente?.tipoDoc || !body.cliente?.numDoc || !body.cliente?.razonSocial) {
      return NextResponse.json(
        { ok: false, mensaje: "cliente.tipoDoc, cliente.numDoc y cliente.razonSocial son requeridos" },
        { status: 400 }
      )
    }

    for (const item of body.items) {
      if (!item.descripcion || !item.unidad || item.cantidad == null || item.precio_unitario == null) {
        return NextResponse.json(
          { ok: false, mensaje: "Cada item requiere descripcion, unidad, cantidad y precio_unitario" },
          { status: 400 }
        )
      }
    }

    const cliente = {
      tipo_doc: body.cliente.tipoDoc,
      num_doc: body.cliente.numDoc,
      razon_social: body.cliente.razonSocial,
      direccion: body.cliente.direccion || undefined,
      email: body.cliente.email || undefined,
      telefono: body.cliente.telefono || undefined,
    }

    let payload: Record<string, unknown>

    if (body.tipo === "NOTA_VENTA") {
      // SaleNoteController valida manualmente solo estos campos, sin serie ni FormRequest.
      payload = {
        fecha_emision: body.fechaEmision || new Date().toISOString().slice(0, 10),
        cliente,
        items: body.items,
      }
    } else {
      // BOLETA / FACTURA -> requieren serie válida obtenida de /series (no se hardcodea)
      const serie = await obtenerSerieActiva(body.tipo)

      payload = {
        serie,
        fecha_emision: body.fechaEmision || new Date().toISOString().slice(0, 10),
        // Todos nullable en el FormRequest: solo se envían si vienen del cliente.
        fecha_vencimiento: body.fechaVencimiento || undefined,
        cod_local: body.codLocal || undefined,
        tipo_operacion: body.tipoOperacion || undefined,
        tipo_moneda: body.tipoMoneda || undefined,
        forma_pago: body.formaPago || undefined,
        cliente,
        items: body.items,
        // correlativo y totales (mto_oper_gravadas, mto_igv, etc.) son nullable y
        // Laravel los calcula/asigna automáticamente: el POS NO los envía.
      }

      // TEMPORAL: verificar que la serie corresponde al tipo antes de enviar.
      console.log("Serie seleccionada:", serie)
      console.log("Payload:", payload)
    }

    const res = await fetch(`${BASE_URL.replace(/\/+$/, "")}/${endpoint}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })

    const text = await res.text()

    console.log("====================================")
    console.log("TIPO:", body.tipo)
    console.log("ENDPOINT:", endpoint)
    console.log("STATUS:", res.status)
    console.log("BODY:", text)
    console.log("====================================")

    let json = null
    try {
      json = JSON.parse(text)
    } catch { }

    if (!res.ok || !json || json.estado === "error") {
      const mensaje = json?.mensaje || `Error ${res.status} al emitir ${body.tipo}`
      return NextResponse.json(
        { ok: false, tipo: body.tipo, mensaje, errores: json?.errores },
        { status: res.status || 502 }
      )
    }

    const datos = json.datos || {}

    return NextResponse.json({
      ok: true,
      tipo: body.tipo,
      externalId: datos.id,
      serie: datos.serie,
      correlativo: datos.correlativo != null ? Number(datos.correlativo) : undefined,
      numeroCompleto: datos.numero_completo,
      sunatStatus: datos.sunat_status,
      sunatCode: datos.sunat_code ?? null,
      sunatDescription: datos.sunat_description ?? null,
      pdfUrl: datos.pdf_url,
      xmlUrl: datos.xml_url,
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, mensaje: error?.message || "Error interno al emitir comprobante" }, { status: 500 })
  }
}

// Permite consultar el estado de un comprobante ya emitido: /api/facturacion?tipo=FACTURA&id=123
export async function GET(req: NextRequest) {
  try {
    if (!BASE_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json({ ok: false, mensaje: "Faltan credenciales en el servidor" }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get("tipo") as TipoComprobante | null
    const id = searchParams.get("id")
    const endpoint = tipo ? ENDPOINT_POR_TIPO[tipo] : undefined

    if (!endpoint || !id) {
      return NextResponse.json({ ok: false, mensaje: "tipo e id son requeridos" }, { status: 400 })
    }

    const res = await fetch(`${BASE_URL.replace(/\/+$/, "")}/${endpoint}/${id}`, {
      headers: { "X-Api-Key": API_KEY, "X-Api-Secret": API_SECRET },
    })
    const text = await res.text()

    console.log("====================================")
    console.log("GET STATUS:", res.status)
    console.log("GET BODY:", text)
    console.log("====================================")

    let json = null
    try {
      json = JSON.parse(text)
    } catch { }

    if (!res.ok || !json?.datos) {
      return NextResponse.json({ ok: false, mensaje: "No se pudo consultar el estado" }, { status: res.status || 502 })
    }

    const datos = json.datos
    return NextResponse.json({
      ok: true,
      sunatStatus: datos.sunat_status,
      sunatCode: datos.sunat_code ?? null,
      sunatDescription: datos.sunat_description ?? null,
      pdfUrl: datos.pdf_url,
      xmlUrl: datos.xml_url,
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, mensaje: error?.message || "Error interno" }, { status: 500 })
  }
}