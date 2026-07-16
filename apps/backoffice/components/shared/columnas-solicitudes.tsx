// Columnas de solicitudes para la TablaDatos genérica (vendedor, manager,
// casos del cliente, pendientes del financiero): config pura — cada página
// compone <TablaDatos columnas={columnasSolicitudes(...)}> con su título y
// búsqueda. CADA columna de datos declara su filtro; el nombre del param es
// la clave de FiltrosSolicitudes que el core valida contra su mapa de
// estrategias (texto→ilike saneado, numero→"op:centavos", fechas→rango).

import Link from "next/link";
import { Eye, Phone, MessageCircle, UserCog } from "lucide-react";
import type { SolicitudReciente } from "@sumo/core";
import { pesos } from "@/lib/format";
import { EstadoBadge } from "@/components/panel/ui";
import type { ColumnaDatos } from "@/components/shared/tabla-datos";

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" });

const ESTILO_ACCION =
  "rounded-lg border border-transparent p-2 text-muted-foreground transition-colors duration-150 hover:border-black hover:text-foreground";

const OPCIONES_DECISION = [
  { valor: "APROBADO", etiqueta: "Aprobadas" },
  { valor: "REVISION_MANUAL", etiqueta: "En revisión" },
  { valor: "NEGADO", etiqueta: "Negadas" },
];

const OPCIONES_ESTADO = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "evaluada", etiqueta: "Evaluada" },
  { valor: "desembolsada", etiqueta: "Desembolsada" },
];

export interface OpcionesColumnasSolicitudes {
  /** Acción de gestión del manager (por ahora visual: flujo por definir). */
  conReasignar?: boolean;
  /** El wizard solo es navegable por vendedor/manager (proxy lo gatea). */
  conWizard?: boolean;
  /** Columna "Vendedor" (vista del manager y del financiero). */
  conVendedor?: boolean;
  /** Nombres de moto del catálogo (opciones del filtro de su columna). */
  motos?: string[];
  /** Vendedores de la tienda (filtro por igualdad); sin lista, el filtro
   *  cae a texto sobre el nombre (vistas de alcance nacional). */
  vendedores?: { id: string; nombre: string }[];
  /** Apagar el rango de fechas donde el período ya está fijo (ej. /hoy). */
  conFiltroFechas?: boolean;
  /** Ocultar decisión/estado donde son criterio FIJO de la vista (ej. la
   *  cola de pendientes del financiero: siempre APROBADO + evaluada). */
  conDecision?: boolean;
  conEstado?: boolean;
  /** Render extra al final (ej. botón Desembolsar del financiero). */
  accionExtra?: (s: SolicitudReciente) => React.ReactNode;
}

export function columnasSolicitudes({
  conReasignar = false,
  conWizard = true,
  conVendedor = false,
  motos = [],
  vendedores = [],
  conFiltroFechas = true,
  conDecision = true,
  conEstado = true,
  accionExtra,
}: OpcionesColumnasSolicitudes = {}): ColumnaDatos<SolicitudReciente>[] {
  return [
    {
      titulo: "Solicitud",
      filtro: { param: "solicitud", tipo: "texto", placeholder: "#id corto…" },
      render: (s) => (
        <span className="font-mono text-xs text-muted-foreground">
          #{s.solicitud_id.slice(0, 8)}
        </span>
      ),
    },
    {
      titulo: "Cliente",
      claveOrden: "cliente_nombre",
      filtro: { param: "cliente", tipo: "texto", placeholder: "Nombre o cédula…" },
      render: (s) => (
        <>
          <p className="font-medium">{s.cliente_nombre ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {s.cliente_cedula ? `CC ${s.cliente_cedula}` : "—"}
          </p>
        </>
      ),
    },
    {
      titulo: "Moto",
      claveOrden: "moto_nombre",
      filtro:
        motos.length > 0
          ? {
              param: "moto",
              tipo: "opciones" as const,
              opciones: motos.map((m) => ({ valor: m, etiqueta: m })),
            }
          : undefined,
      render: (s) => <span className="text-muted-foreground">{s.moto_nombre ?? "—"}</span>,
    },
    ...(conVendedor
      ? [
          {
            titulo: "Vendedor",
            claveOrden: "vendedor_nombre",
            filtro:
              vendedores.length > 0
                ? {
                    param: "vendedor",
                    tipo: "opciones" as const,
                    opciones: vendedores.map((v) => ({
                      valor: v.id,
                      etiqueta: v.nombre,
                    })),
                  }
                : {
                    param: "vendedorNombre",
                    tipo: "texto" as const,
                    placeholder: "Nombre…",
                  },
            render: (s) => (
              <span className="text-muted-foreground">{s.vendedor_nombre ?? "—"}</span>
            ),
          } satisfies ColumnaDatos<SolicitudReciente>,
        ]
      : []),
    {
      titulo: "Valor moto",
      claveOrden: "valor_moto_centavos",
      filtro: { param: "valor", tipo: "numero", factor: 100, placeholder: "Pesos…" },
      render: (s) => <span className="tabular-nums">{pesos(s.valor_moto_centavos)}</span>,
    },
    {
      titulo: "Cuota est.",
      claveOrden: "cuota_estimada_centavos",
      filtro: { param: "cuota", tipo: "numero", factor: 100, placeholder: "Pesos…" },
      render: (s) => (
        <span className="tabular-nums">
          {s.cuota_estimada_centavos ? pesos(s.cuota_estimada_centavos) : "—"}
        </span>
      ),
    },
    ...(conDecision
      ? [
          {
            titulo: "Decisión",
            claveOrden: "decision_resultado",
            filtro: {
              param: "decision",
              tipo: "opciones" as const,
              opciones: OPCIONES_DECISION,
            },
            render: (s) =>
              s.decision_resultado ? <EstadoBadge estado={s.decision_resultado} /> : "—",
          } satisfies ColumnaDatos<SolicitudReciente>,
        ]
      : []),
    ...(conEstado
      ? [
          {
            titulo: "Estado",
            claveOrden: "estado",
            filtro: {
              param: "estado",
              tipo: "opciones" as const,
              opciones: OPCIONES_ESTADO,
            },
            render: (s) => <EstadoBadge estado={s.estado.toUpperCase()} />,
          } satisfies ColumnaDatos<SolicitudReciente>,
        ]
      : []),
    {
      titulo: "Fecha",
      claveOrden: "creado_en",
      filtro: conFiltroFechas ? { param: "desde", tipo: "rango-fechas" as const } : undefined,
      render: (s) => (
        <span className="text-muted-foreground">{FECHA.format(new Date(s.creado_en))}</span>
      ),
    },
    {
      titulo: "Acciones",
      alinear: "derecha",
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          {conWizard ? (
            <Link
              href={`/solicitudes/nueva?cedula=${s.cliente_cedula ?? ""}&solicitudId=${s.solicitud_id}&paso=decision`}
              title="Ver en el wizard"
              className={ESTILO_ACCION}
            >
              <Eye className="size-4" />
            </Link>
          ) : null}
          {s.cliente_telefono ? (
            <>
              <a
                href={`tel:+57${s.cliente_telefono}`}
                title={`Llamar al ${s.cliente_telefono}`}
                className={ESTILO_ACCION}
              >
                <Phone className="size-4" />
              </a>
              <a
                href={`https://wa.me/57${s.cliente_telefono}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Escribir por WhatsApp"
                className={ESTILO_ACCION}
              >
                <MessageCircle className="size-4" />
              </a>
            </>
          ) : null}
          {conReasignar ? (
            <button
              type="button"
              disabled
              title="Reasignar vendedor (próximamente)"
              className="rounded-lg border border-transparent p-2 text-muted-foreground opacity-50"
            >
              <UserCog className="size-4" />
            </button>
          ) : null}
          {accionExtra ? accionExtra(s) : null}
        </div>
      ),
    },
  ];
}
