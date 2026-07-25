// Carga REAL de documentos del solicitante (antes era cosmético): el form
// envía el archivo a la server action, el core lo guarda en el bucket
// privado `documentos` y la lista sale de la fachada — el financiero los
// revisa y descarga después en /desembolsos/[id]. Server component: cero JS.

import { FileCheck, Upload } from "lucide-react";
import { originacionService } from "@/lib/core-server";
import { subirDocumentoSolicitud } from "@/app/(vendedor)/solicitudes/nueva/actions";
import { Button } from "@/components/ui/button";

function tamanoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export async function SubirDocumentos({
  solicitudId,
  cedula,
  motoId,
}: {
  solicitudId: string;
  cedula: string;
  motoId?: string;
}) {
  const documentos = await originacionService().listarDocumentos(solicitudId);

  return (
    <div>
      <form action={subirDocumentoSolicitud}>
        <input type="hidden" name="solicitudId" value={solicitudId} />
        <input type="hidden" name="cedula" value={cedula} />
        {motoId ? <input type="hidden" name="motoId" value={motoId} /> : null}
        <label className="flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground transition-colors duration-200 hover:border-primary">
          <Upload className="size-6" />
          Selecciona el documento (cédula, comprobante de ingresos…)
          <span className="text-xs">PDF, PNG o JPG · máximo 5 MB</span>
          <input
            type="file"
            name="archivo"
            accept="application/pdf,image/png,image/jpeg"
            required
            className="sr-only"
          />
        </label>
        <Button type="submit" variant="secondary" size="sm" className="mt-3">
          Subir al expediente
        </Button>
      </form>

      {documentos.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {documentos.map((d) => (
            <li
              key={d.nombre}
              className="flex items-center justify-between border border-border px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileCheck className="size-4 shrink-0 text-emerald-500" />
                <span className="truncate">{d.nombre}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {tamanoLegible(d.tamanoBytes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
