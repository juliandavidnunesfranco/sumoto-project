// Server component puro: solo resuelve el mensaje de error desde searchParams
// y delega la interactividad al FormularioLogin (client).

import Image from "next/image";
import { FormularioLogin } from "@/components/login/formulario-login";

const MENSAJES: Record<string, string> = {
  credenciales: "Credenciales inválidas.",
  "sin-perfil": "Tu usuario no tiene perfil asignado.",
  "faltan-datos": "Correo y contraseña son obligatorios.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; denegado?: string; next?: string }>;
}) {
  const params = await searchParams;
  const mensaje = params.denegado
    ? "Tu rol no tiene acceso a esa sección."
    : params.error
      ? (MENSAJES[params.error] ?? "No fue posible ingresar.")
      : null;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        
        <FormularioLogin mensaje={mensaje} next={params.next ?? ""} />
      </div>

      <div className="relative hidden overflow-hidden border-l border-border bg-card lg:block">
        <Image
          src="/motos/naked-300.png"
          alt="Moto SUMOTO"
          fill
          className="object-cover opacity-90"
        />
       
        <div className="absolute bottom-10 left-10 right-10 w-3xl p-3 rounded-2xl">
          <p className="text-balance text-2xl font-bold">
            Crédito que mueve <span className="text-blue-50">cada venta.</span>
          </p>
          <p className="mt-2 text-sm text-blue-50 ">
            Originación, evaluación y cartera en una sola plataforma.
          </p>
        </div>
      </div>
    </main>
  );
}
