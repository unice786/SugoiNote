import * as SecureStore from 'expo-secure-store';

// IP local de la PC para desarrollo (iniciar.ps1 la compara y avisa si cambio).
// Para un telefono, usa la IP local de la PC y el perfil "celular" del backend.
const API_BASE_POR_DEFECTO = 'http://192.168.0.38:5199';

// En builds (EAS) se define EXPO_PUBLIC_API_URL con la API publicada.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || API_BASE_POR_DEFECTO;

const TOKEN_KEY = 'sugoinote.jwt';

// ── Tipos y DTOs ─────────────────────────────────────────────

export interface Estudiante {
  estudianteId: string;
  nombreCompleto: string;
  correoElectronico: string;
  fotoPerfil: string | null;
}

export interface RespuestaAuth {
  token: string;
  estudiante: Estudiante;
}

export interface ApunteDto {
  apunteId: string;
  tituloNota: string;
  contenidoTexto?: string | null;
  fechaRegistro?: string | null;
  materiaNombre?: string | null;
  tieneResumen: boolean;
  totalExamenes: number;
}

export interface CrearApunteRequest {
  tituloNota: string;
  contenidoTexto?: string;
  materiaId?: string | null;
  nuevaMateriaNombre?: string | null;
}

export interface MateriaDto {
  materiaId: string;
  nombreMateria: string;
}

export interface AutoSaveRequest {
  titulo: string;
  contenido: string;
}

export interface ResumenDto {
  apunteId: string;
  tituloNota: string;
  resumen?: string | null;
  fechaRegistro?: string | null;
}

export interface ApunteResumenRef {
  apunteId: string;
  tituloNota: string;
}

export interface ExamenResumenDto {
  examenId: string;
  apunteId: string;
  tituloApunte: string;
  fecha?: string | null;
  nota?: number | null;
  total: number;
}

export interface ExamenOpcionDto {
  opcionId: string;
  texto: string;
  esLaCorrecta?: boolean;
}

export interface ExamenPreguntaDto {
  preguntaId: string;
  texto: string;
  respuestaSeleccionadaId?: string | null;
  opciones: ExamenOpcionDto[];
}

export interface ExamenDetalleDto {
  examenId: string;
  tituloApunte: string;
  calificado: boolean;
  nota?: number | null;
  preguntas: ExamenPreguntaDto[];
}

export interface GenerarExamenRequest {
  apunteId: string;
  tipo?: 'opcion_multiple' | 'verdadero_falso';
  cantidadPreguntas: number;
}

export interface CalificarExamenRequest {
  respuestas: Record<string, string>;
}

export interface CalificarExamenResponse {
  nota: number;
  total: number;
  correctas: number;
}

export interface PostDto {
  postId: string;
  titulo: string;
  detalle: string;
  autor: string;
  fotoUrl?: string | null;
  esEncuesta: boolean;
  imagenUrl?: string | null;
  esMio: boolean;
  fecha?: string | null;
  totalRespuestas: number;
  totalVotos: number;
}

export interface PostOpcionDto {
  opcionId: string;
  texto: string;
  totalVotos: number;
  seleccionada: boolean;
}

export interface PostRespuestaDto {
  respuestaId: string;
  autor: string;
  texto: string;
  fecha?: string | null;
}

export interface PostDetalleDto {
  postId: string;
  titulo: string;
  detalle: string;
  autor: string;
  fecha?: string | null;
  esEncuesta: boolean;
  imagenUrl?: string | null;
  esMio: boolean;
  soloUnaOpcion: boolean;
  totalVotos: number;
  opciones: PostOpcionDto[];
  respuestas: PostRespuestaDto[];
}

export interface CrearPostRequest {
  titulo: string;
  detalle: string;
  imagenUrl?: string | null;
}

export interface CrearEncuestaRequest {
  titulo: string;
  detalle?: string;
  opciones: string[];
  imagenUrl?: string | null;
  soloUnaOpcion?: boolean;
}

export interface PerfilDto {
  estudianteId: string;
  nombreCompleto: string;
  correoElectronico: string;
  fotoPerfil?: string | null;
  fechaCreacion?: string | null;
  totalApuntes: number;
  totalResumenes: number;
  totalExamenes: number;
  totalPublicaciones: number;
  totalMaterias: number;
  promedio?: number | null;
}

export interface ActualizarPerfilRequest {
  nombreCompleto: string;
  correo: string;
}

export interface ActualizarFotoRequest {
  fotoPerfil: string;
}

// ── Manejo de errores y tokens ───────────────────────────────

export class ErrorApi extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function guardarToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function leerToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function borrarToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api<T>(ruta: string, init: RequestInit = {}, sinSesion = false): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');

  if (!sinSesion) {
    const token = await leerToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${ruta}`, { ...init, headers });
  } catch {
    throw new ErrorApi(0, `No se pudo conectar con ${API_BASE}. Verifica la Wi-Fi y que la API esté encendida.`);
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) await borrarToken();
    throw new ErrorApi(response.status, data?.error ?? `Error ${response.status}`);
  }
  return data as T;
}

// ── Módulos de API ───────────────────────────────────────────

export const auth = {
  login: (correoElectronico: string, claveAcceso: string) =>
    api<RespuestaAuth>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correoElectronico, claveAcceso }),
    }, true),
  registrar: (nombreCompleto: string, correoElectronico: string, claveAcceso: string) =>
    api<RespuestaAuth>('/api/auth/registrar', {
      method: 'POST',
      body: JSON.stringify({ nombreCompleto, correoElectronico, claveAcceso }),
    }, true),
  me: () => api<{ estudianteId: string }>('/api/auth/me'),
};

export const apuntes = {
  listar: () => api<ApunteDto[]>('/api/apuntes'),
  materias: () => api<MateriaDto[]>('/api/apuntes/materias'),
  obtener: (id: string) => api<ApunteDto>(`/api/apuntes/${id}`),
  crear: (dto: CrearApunteRequest) =>
    api<{ apunteId: string }>('/api/apuntes', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  autoSave: (id: string, dto: AutoSaveRequest) =>
    api<{ guardado: boolean }>(`/api/apuntes/${id}/autosave`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  eliminar: (id: string) =>
    api<{ eliminado: boolean }>(`/api/apuntes/${id}`, {
      method: 'DELETE',
    }),
};

export const resumenes = {
  listar: () => api<ResumenDto[]>('/api/resumenes'),
  obtener: (apunteId: string) => api<ResumenDto>(`/api/resumenes/${apunteId}`),
  apuntesDisponibles: () => api<ApunteResumenRef[]>('/api/resumenes/apuntes'),
  generar: (apunteId: string) =>
    api<{ resumen: string }>('/api/resumenes/generar', {
      method: 'POST',
      body: JSON.stringify({ apunteId }),
    }),
};

export const examenes = {
  listar: () => api<ExamenResumenDto[]>('/api/examenes'),
  obtener: (id: string) => api<ExamenDetalleDto>(`/api/examenes/${id}`),
  generar: (dto: GenerarExamenRequest) =>
    api<{ examenId: string }>('/api/examenes/generar', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  calificar: (id: string, dto: CalificarExamenRequest) =>
    api<CalificarExamenResponse>(`/api/examenes/${id}/calificar`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};

export const chat = {
  enviar: (mensaje: string) =>
    api<{ respuesta: string }>('/api/chat/enviar', {
      method: 'POST',
      body: JSON.stringify({ mensaje }),
    }),
};

export const comunidad = {
  listar: (pagina = 0) => api<PostDto[]>(`/api/comunidad?pagina=${pagina}`),
  obtener: (id: string) => api<PostDetalleDto>(`/api/comunidad/${id}`),
  crearPost: (dto: CrearPostRequest) =>
    api<{ postId: string }>('/api/comunidad/posts', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  crearEncuesta: (dto: CrearEncuestaRequest) =>
    api<{ postId: string }>('/api/comunidad/encuestas', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  responder: (id: string, texto: string) =>
    api<{ ok: boolean }>(`/api/comunidad/${id}/responder`, {
      method: 'POST',
      body: JSON.stringify({ texto }),
    }),
  votar: (id: string, opcionIds: string[]) =>
    api<{ ok: boolean }>(`/api/comunidad/${id}/votar`, {
      method: 'POST',
      body: JSON.stringify({ opcionIds }),
    }),
  eliminar: (id: string) =>
    api<{ eliminado: boolean }>(`/api/comunidad/${id}`, {
      method: 'DELETE',
    }),
};

export const perfil = {
  obtener: () => api<PerfilDto>('/api/perfil'),
  actualizar: (dto: ActualizarPerfilRequest) =>
    api<{ mensaje: string }>('/api/perfil', {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  actualizarFoto: (dto: ActualizarFotoRequest) =>
    api<{ mensaje: string }>('/api/perfil/foto', {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
};
