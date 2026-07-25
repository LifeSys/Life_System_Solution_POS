import { NextRequest, NextResponse } from "next/server"

const BASE_URL = process.env.SUNAT_API_BASE_URL
const API_KEY = process.env.SUNAT_API_KEY
const API_SECRET = process.env.SUNAT_API_SECRET

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY as string,
    "X-Api-Secret": API_SECRET as string,
  }
}

function normalizarFuente(json: any): "cache" | "proveedor" | undefined {
  const fuente = String(json?.fuente || json?.source || json?.origen || json?.datos?.fuente || json?.datos?.source || "").toLowerCase()
  if (fuente.includes("cache")) return "cache"
  if (fuente.includes("provider") || fuente.includes("proveedor") || fuente.includes("apiperu") || fuente.includes("api_peru")) return "proveedor"
  return undefined
}

function normalizarDatos(tipo: "dni" | "ruc", numero: string, json: any) {
  const datos = json?.datos || json?.data || json?.persona || json?.empresa || json

  if (tipo === "dni") {
    const nombres = datos?.nombres || datos?.nombre || ""
    const apellidoPaterno = datos?.apellido_paterno || datos?.apellidoPaterno || datos?.paterno || ""
    const apellidoMaterno = datos?.apellido_materno || datos?.apellidoMaterno || datos?.materno || ""
    const nombreCompleto = datos?.nombre_completo || datos?.nombreCompleto || datos?.razon_social || [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ")

    return nombreCompleto
      ? {
          tipoDocumento: "1",
          numeroDocumento: numero,
          razonSocial: nombreCompleto,
          nombreCompleto,
          nombres,
          apellidoPaterno,
          apellidoMaterno,
        }
      : null
  }

  const razonSocial = datos?.razon_social || datos?.razonSocial || datos?.nombre_o_razon_social || datos?.nombre || ""
  return razonSocial
    ? {
        tipoDocumento: "6",
        numeroDocumento: numero,
        razonSocial,
        direccion: datos?.direccion || datos?.direccion_fiscal || datos?.direccionFiscal || "",
        estado: datos?.estado || "",
        condicion: datos?.condicion || "",
      }
    : null
}

async function consultar(endpoint: string, signal: AbortSignal) {
  const res = await fetch(endpoint, { headers: authHeaders(), signal })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch { }
  return { res, json }
}

export async function GET(req: NextRequest) {
  try {
    if (!BASE_URL || !API_KEY || !API_SECRET) {
      return NextResponse.json({ ok: false, mensaje: "Faltan credenciales de la API SUNAT" }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const tipo = searchParams.get("tipo") as "dni" | "ruc" | null
    const numero = searchParams.get("numero") || ""

    if ((tipo !== "dni" && tipo !== "ruc") || !/^\d+$/.test(numero)) {
      return NextResponse.json({ ok: false, mensaje: "tipo y numero son requeridos" }, { status: 400 })
    }

    if ((tipo === "dni" && numero.length !== 8) || (tipo === "ruc" && numero.length !== 11)) {
      return NextResponse.json({ ok: false, mensaje: "Longitud de documento inválida" }, { status: 400 })
    }

    const base = BASE_URL.replace(/\/+$/, "")
    const endpoints = [
      `${base}/consultas/${tipo}/${numero}`,
      `${base}/consultas/${tipo}?numero=${numero}`,
      `${base}/consulta/${tipo}/${numero}`,
    ]

    let lastStatus = 502
    for (const endpoint of endpoints) {
      const { res, json } = await consultar(endpoint, req.signal)
      lastStatus = res.status
      if (!res.ok || !json || json?.estado === "error" || json?.success === false) continue

      const datos = normalizarDatos(tipo, numero, json)
      if (!datos) continue

      return NextResponse.json({
        ok: true,
        fuente: normalizarFuente(json) || "proveedor",
        datos,
      })
    }

    return NextResponse.json({ ok: false, mensaje: "No se encontraron datos para el documento" }, { status: lastStatus === 404 ? 404 : 502 })
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return NextResponse.json({ ok: false, mensaje: "Consulta cancelada" }, { status: 499 })
    }
    return NextResponse.json({ ok: false, mensaje: error?.message || "Error al consultar el documento" }, { status: 500 })
  }
}
