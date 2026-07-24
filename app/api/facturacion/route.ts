import { NextRequest, NextResponse } from "next/server"
import type { EmitirComprobanteRequest, ItemComprobanteApi } from "@/lib/models/comprobante"

// Estas variables viven SOLO en el servidor (Railway/Vercel env vars), nunca llegan al navegador.
const BASE_URL = process.env.SUNAT_API_BASE_URL // ej: https://tu-api-sunat.up.railway.app/api/v1
const API_KEY = process.env.SUNAT_API_KEY
const API_SECRET = process.env.SUNAT_API_SECRET

const ENDPOINT_POR_TIPO: Record<string, string> = {
  BOLETA: "boletas",
  FACTURA: "facturas",
  NOTA_VENTA: "notas-venta",
}

export async function POST(req: NextRequest) {
  try {
    if (!BASE_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json(
        { ok: false, mensaje: "Faltan configurar SUNAT_API_BASE_URL / SUNAT_API_KEY / SUNAT_API_SECRET en el servidor" },
        { status: 500 }
      )
    }

    const body: EmitirComprobanteRequest & { items: ItemComprobanteApi[]; fechaEmision?: string } = await req.json()

    if (!body.tipo || !body.items?.length) {
      return NextResponse.json({ ok: false, mensaje: "tipo e items son requeridos" }, { status: 400 })
    }

    const endpoint = ENDPOINT_POR_TIPO[body.tipo]
    if (!endpoint) {
      return NextResponse.json({ ok: false, mensaje: `Tipo de comprobante desconocido: ${body.tipo}` }, { status: 400 })
    }

    const payload = {
      fecha_emision: body.fechaEmision || new Date().toISOString().slice(0, 10),
      tipo_moneda: "PEN",
      forma_pago: "Contado",
      cliente: {
        tipo_doc: body.cliente.tipoDoc,
        num_doc: body.cliente.numDoc,
        razon_social: body.cliente.razonSocial,
        direccion: body.cliente.direccion || undefined,
      },
      items: body.items,
      observacion: body.observacion || undefined,
    }

    const res = await fetch(`${BASE_URL.replace(/\/+$/, "")}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY,
        "X-Api-Secret": API_SECRET,
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json().catch(() => null)

    if (!res.ok || !json || json.estado === "error") {
      const mensaje = json?.mensaje || `Error ${res.status} al emitir ${body.tipo}`
      return NextResponse.json({ ok: false, tipo: body.tipo, mensaje }, { status: res.status || 502 })
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
    const tipo = searchParams.get("tipo") || ""
    const id = searchParams.get("id")
    const endpoint = ENDPOINT_POR_TIPO[tipo]

    if (!endpoint || !id) {
      return NextResponse.json({ ok: false, mensaje: "tipo e id son requeridos" }, { status: 400 })
    }

    const res = await fetch(`${BASE_URL.replace(/\/+$/, "")}/${endpoint}/${id}`, {
      headers: { "X-Api-Key": API_KEY, "X-Api-Secret": API_SECRET },
    })
    const json = await res.json().catch(() => null)

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
