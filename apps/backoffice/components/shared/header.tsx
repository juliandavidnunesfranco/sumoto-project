import Link from "next/link"
import Image from "next/image"
import { Gauge } from "lucide-react"
import { cn } from "@/lib/cn"


export function Header({className}:{className?:string}){
    return (
    <header className={cn("sticky top-0 z-40 flex h-36 w-full items-center justify-between  bg-background/80 px-6 py-2 backdrop-blur md:px-10", className)}>
        <div className="flex flex-col gap-2 ">
          <Image
            src={"/motos/cropped-Logotipo-Su-Moto-sa-PNG-02-2048x561.png"}
            width={400}
            height={400}
            alt="Logo"
            className="animar-entrada-izquierda flex items-baseline font-black tracking-tight"
            />
          <span className="animar-entrada-izquierda-retraso inline-flex items-center gap-2 text-3xl text-muted-foreground">
            <Gauge className="size-12 text-primary " />
            Plataforma para la originación de créditos.
          </span>

        </div>
            <Link href="/login">
               <span className="text-4xl font-headline font-black hover:border border-b-black p-4  hover:text-muted-foreground transition ">Ingresar</span> 
            </Link>
    </header>

    )
}