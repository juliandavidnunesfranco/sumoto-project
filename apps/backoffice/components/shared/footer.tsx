export default function Footer(){
    return (
    <footer className="border-t border-border px-6 py-6 text-center md:px-10">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} SUMOTO · Plataforma para la gestión de crédito.
        </p>
    </footer>
    )
}