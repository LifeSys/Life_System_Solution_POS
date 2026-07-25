import { addDocument, collections, getDocuments, updateDocument } from "@/lib/firebase/firestore"
import { where, limit } from "firebase/firestore"

export type TipoDocumentoCliente = "1" | "6"

export interface ClienteLocal {
  id?: string
  tenantId: string
  storeId: string
  tipo_documento: TipoDocumentoCliente
  numero_documento: string
  razon_social: string
  nombre_completo?: string
  nombres?: string
  apellido_paterno?: string
  apellido_materno?: string
  direccion?: string
  estado?: string
  condicion?: string
  telefono?: string
  correo?: string
  observaciones?: string
}

export type ClienteUpsertInput = Omit<ClienteLocal, "id" | "tenantId" | "storeId"> & {
  tenantId: string
  storeId?: string
}

export const ClientesService = {
  async buscarPorDocumento(tenantId: string, tipoDocumento: TipoDocumentoCliente, numeroDocumento: string): Promise<ClienteLocal | null> {
    const clientes = await getDocuments<ClienteLocal>(
      collections.clientes,
      where("tenantId", "==", tenantId),
      where("tipo_documento", "==", tipoDocumento),
      where("numero_documento", "==", numeroDocumento),
      limit(1)
    )

    return clientes[0] || null
  },

  async guardarDesdeConsulta(input: ClienteUpsertInput): Promise<ClienteLocal> {
    const existente = await this.buscarPorDocumento(input.tenantId, input.tipo_documento, input.numero_documento)

    const cambios = {
      razon_social: input.razon_social,
      nombre_completo: input.nombre_completo || input.razon_social,
      nombres: input.nombres || "",
      apellido_paterno: input.apellido_paterno || "",
      apellido_materno: input.apellido_materno || "",
      direccion: input.direccion || "",
      estado: input.estado || "",
      condicion: input.condicion || "",
    }

    if (existente?.id) {
      await updateDocument(collections.clientes, existente.id, cambios)
      return { ...existente, ...cambios }
    }

    const cliente: Omit<ClienteLocal, "id"> = {
      tenantId: input.tenantId,
      storeId: input.storeId || input.tenantId,
      tipo_documento: input.tipo_documento,
      numero_documento: input.numero_documento,
      razon_social: input.razon_social,
      nombre_completo: input.nombre_completo || input.razon_social,
      nombres: input.nombres || "",
      apellido_paterno: input.apellido_paterno || "",
      apellido_materno: input.apellido_materno || "",
      direccion: input.direccion || "",
      estado: input.estado || "",
      condicion: input.condicion || "",
    }

    const id = await addDocument(collections.clientes, cliente)
    return { id, ...cliente }
  },
}

export default ClientesService
