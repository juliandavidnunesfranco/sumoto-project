import Link from "next/link"
import Image from "next/image"
import {  ScanLine, ShieldCheck, FileSignature} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import { RevealOnScroll } from "@/components/shared/reveal-on-scroll"


const FEATURES = [
  {
    icon: ScanLine,
    titulo: "Escaneo de cédula.",
    texto: "La app lee la cédula y trae score, geolocalización y vectores de pago del solicitante en segundos.",
  },
  {
    icon: ShieldCheck,
    titulo: "Decisión por políticas",
    texto: "Reglas de crédito administrables deciden aprobado, revisión o negado de forma consistente.",
  },
  {
    icon: FileSignature,
    titulo: "Cierre documental",
    texto: "Carga de documentos, generación de pagaré y plan de pagos sin salir de la plataforma.",
  },
]

export default function LandingPage (){
  return(
    <>
    <Header/>
    <main className="flex min-h-[120vh] flex-col bg-background">

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-12 md:grid-cols-2 md:px-10 md:py-20">
        <div className="flex flex-col gap-6">
          
          <h1 className="text-balance text-4xl font-black leading-tight tracking-tight md:text-6xl">
            Financia cada moto <span className="text-primary">en minutos</span>, no en días.
          </h1>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            SUMOTO Crédito conecta el escaneo de cédula, el buró de crédito y políticas de riesgo
            para decidir, documentar y desembolsar la financiación de tus motos desde un solo lugar.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button  size="lg" className="hover:bg-blue-500 hover:text-black">
              <Link href="/login">
                Ingresar
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">
             Solicita · Valida · Desembolsa  <br/> <span className="text-lg">En segundos</span>
            </span>
          </div>
          
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-primary/10 blur-2xl" aria-hidden="true" />
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <Image
              src="/motos/sport-250.png"
              alt="Moto SUMOTO Sport 250 disponible para financiación"
              width={720}
              height={540}
              priority
              className="h-full w-full object-cover"
            />
            
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3 md:px-10">
        
        {FEATURES.map((f, i) => (
          <RevealOnScroll key={f.titulo} retrasoMs={i * 100}>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.texto}</p>
            </div>
          </RevealOnScroll>
        ))}
      </section>
    </main>
    <Footer/>
    </>
  )
};