import * as SecureStore from 'expo-secure-store';

/**
 * URL base de la API.
 *
 * OJO con `localhost`: en un teléfono o emulador, `localhost` apunta al propio
 * dispositivo, no a tu computadora. Para probar en el teléfono pon la IP local
 * de tu PC (misma red WiFi), por ejemplo http://192.168.1.50:5199
 *
 * Cuando la API esté publicada en MonsterASP, cambia esto por
 * https://sugoinote.runasp.net
 */
export const API_BASE = 'http://192.168.1.68:5199';

const CLAVE_TOKEN = 'sugoinote_token';

let tokenEnMemoria: string | null = null;

// ── Persistencia del token ────────────────────────────────────

export async function guardarToken(token: string): Promise<void> {
  tokenEnMemoria = token;
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function leerToken(): Promise<string | null> {
  if (tokenEnMemoria) return tokenEnMemoria;
  tokenEnMemoria = await SecureStore.getItemAsync(CLAVE_TOKEN);
  return tokenEnMemoria;
}

export async function borrarToken(): Promise<void> {
  tokenEnMemoria = null;
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}

// ── Error de negocio ──────────────────────────────────────────

export class ErrorApi extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ErrorApi';
  }
}

export class ErrorSinSesion extends Error {
  constructor() {
    super('Tu sesión expiró. Vuelve a iniciar sesión.');
    this.name = 'ErrorSinSesion';
  }
}

/** Callback que dispara el AuthContext cuando la API responde 401. */
let alExpirar: (() => void) | null = null;
export function alExpirarSesion(fn: () => void) {
  alExpirar = fn;
}

// ── Petición genérica ─────────────────────────────────────────

type Opciones = {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  /** Si es false no adjunta el token (registro/login). */
  autenticado?: boolean;
};

export async function api<T = any>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = 'GET', cuerpo, autenticado = true } = opciones;

  const cabeceras: Record<string, string> = { Accept: 'application/json' };

  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  if (autenticado) {
    const token = await leerToken();
    if (token) cabeceras.Authorization = `Bearer ${token}`;
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa tu internet y la URL de la API.');
  }

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();
  let datos: any = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = null;
    }
  }

  if (respuesta.status === 401) {
    if (autenticado) {
      await borrarToken();
      alExpirar?.();
    }
    throw new ErrorSinSesion();
  }

  if (!respuesta.ok) {
    // El backend devuelve { "error": "..." } en los fallos de negocio.
    throw new ErrorApi(respuesta.status, datos?.error ?? `Error ${respuesta.status}`);
  }

  return datos as T;
}

// ── Endpoints ─────────────────────────────────────────────────

export type EstudianteDto = {
  estudianteId: string;
  nombreCompleto: string;
  correoElectronico: string;
  fotoPerfil: string | null;
};

export const auth = {
  registrar: (nombreCompleto: string, correoElectronico: string, claveAcceso: string) =>
    api<{ token: string; estudiante: EstudianteDto }>('/api/auth/registrar', {
      metodo: 'POST',
      cuerpo: { nombreCompleto, correoElectronico, claveAcceso },
      autenticado: false,
    }),

  login: (correoElectronico: string, claveAcceso: string) =>
    api<{ token: string; estudiante: EstudianteDto }>('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correoElectronico, claveAcceso },
      autenticado: false,
    }),

  yo: () => api<{ estudianteId: string }>('/api/auth/me'),
};

export type ApunteDto = {
  apunteId: string;
  tituloNota: string;
  contenidoTexto: string | null;
  fechaRegistro: string | null;
  materiaNombre: string | null;
  tieneResumen: boolean;
  totalExamenes: number;
};

export const apuntes = {
  listar: () => api<ApunteDto[]>('/api/apuntes'),
  obtener: (id: string) => api<ApunteDto>(`/api/apuntes/${id}`),
  crear: (tituloNota: string, contenidoTexto?: string) =>
    api<{ apunteId: string }>('/api/apuntes', { metodo: 'POST', cuerpo: { tituloNota, contenidoTexto } }),
  autoguardar: (id: string, titulo: string, contenido: string) =>
    api<{ guardado: boolean }>(`/api/apuntes/${id}/autosave`, {
      metodo: 'POST',
      cuerpo: { titulo, contenido },
    }),
  eliminar: (id: string) => api<{ eliminado: boolean }>(`/api/apuntes/${id}`, { metodo: 'DELETE' }),
};

export type ResumenDto = {
  apunteId: string;
  tituloNota: string;
  resumen: string | null;
  fechaRegistro: string | null;
};

export const resumenes = {
  listar: () => api<ResumenDto[]>('/api/resumenes'),
  obtener: (apunteId: string) => api<ResumenDto>(`/api/resumenes/${apunteId}`),
  apuntesDisponibles: () => api<{ apunteId: string; tituloNota: string }[]>('/api/resumenes/apuntes'),
  generar: (apunteId: string) =>
    api<{ resumen: string }>('/api/resumenes/generar', { metodo: 'POST', cuerpo: { apunteId } }),
};

export type ExamenResumenDto = {
  examenId: string;
  apunteId: string;
  tituloApunte: string;
  fecha: string | null;
  nota: number | null;
  total: number;
};

export const examenes = {
  listar: () => api<ExamenResumenDto[]>('/api/examenes'),
  generar: (apunteId: string, tipo: string, cantidadPreguntas: number) =>
    api<{ examenId: string }>('/api/examenes/generar', {
      metodo: 'POST',
      cuerpo: { apunteId, tipo, cantidadPreguntas },
    }),
  obtener: (id: string) => api<any>(`/api/examenes/${id}`),
  calificar: (id: string, respuestas: Record<string, string>) =>
    api<{ nota: number; correctas: number; total: number }>(`/api/examenes/${id}/calificar`, {
      metodo: 'POST',
      cuerpo: { respuestas },
    }),
};

export const chat = {
  enviar: (apunteId: string | null, mensaje: string) =>
    api<{ respuesta: string }>('/api/chat/enviar', {
      metodo: 'POST',
      cuerpo: { apunteId, mensaje },
    }),
};

export type PostDto = {
  postId: string;
  titulo: string;
  detalle: string;
  autor: string;
  fotoUrl: string | null;
  esEncuesta: boolean;
  fecha: string | null;
  totalRespuestas: number;
  totalVotos: number;
};

export const comunidad = {
  listar: () => api<PostDto[]>('/api/comunidad'),
  obtener: (id: string) => api<any>(`/api/comunidad/${id}`),
  crearPost: (titulo: string, detalle: string) =>
    api<{ postId: string }>('/api/comunidad/posts', { metodo: 'POST', cuerpo: { titulo, detalle } }),
  crearEncuesta: (titulo: string, detalle: string, opciones: string[], soloUnaOpcion: boolean) =>
    api<{ postId: string }>('/api/comunidad/encuestas', {
      metodo: 'POST',
      cuerpo: { titulo, detalle, opciones, soloUnaOpcion },
    }),
  responder: (id: string, texto: string) =>
    api<{ respuestaId: string }>(`/api/comunidad/${id}/responder`, {
      metodo: 'POST',
      cuerpo: { texto },
    }),
  votar: (id: string, opcionIds: string[]) =>
    api<{ ok: boolean }>(`/api/comunidad/${id}/votar`, {
      metodo: 'POST',
      cuerpo: { opcionIds },
    }),
};

export const perfil = {
  obtener: () => api<any>('/api/perfil'),
  actualizar: (nombreCompleto: string, correoElectronico: string) =>
    api<{ mensaje: string }>('/api/perfil', {
      metodo: 'PUT',
      cuerpo: { nombreCompleto, correoElectronico },
    }),
};