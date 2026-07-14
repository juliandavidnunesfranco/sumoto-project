import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import { RevealOnScroll } from "@/components/shared/reveal-on-scroll"


const FEATURES = [
  {
    titulo: "Escaneo de cédula",
    texto: "La app lee la cédula y trae score, geolocalización y vectores de pago del solicitante en segundos.",
  },
  {
    titulo: "Decisión por políticas",
    texto: "Reglas de crédito administrables deciden aprobado, revisión o negado de forma consistente.",
  },
  {
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
          
          <h1 className="text-balance font-headline text-4xl font-black leading-tight tracking-tight md:text-6xl ">
            Financia cada moto <span className="text-primary"><br/>en minutos</span>, no en días.
          </h1>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            SUMOTO Crédito conecta el escaneo de cédula, el buró de crédito y políticas de riesgo
            para decidir, documentar y desembolsar la financiación de tus motos desde un solo lugar.
          </p>
          <div className="flex flex-wrap items-center gap-6 py-16">
         
              <Link href="/login">
               <span className="border border-transparent text-4xl font-headline font-black p-4 transition-colors duration-200 hover:border-black hover:text-muted-foreground">Ingresar</span>
              </Link>
         
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

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-20 md:flex-row md:px-10">
        {FEATURES.map((f, i) => (
          <RevealOnScroll key={f.titulo} retrasoMs={i * 100} className="flex flex-1 gap-8">
            {i > 0 ? <span className="hidden h-20 w-px shrink-0 bg-foreground md:block" /> : null}
            <div>
              <h3 className="font-headline text-3xl font-bold tracking-tight">{f.titulo}</h3>
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