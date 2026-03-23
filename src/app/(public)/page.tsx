import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="py-4 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-2xl font-black uppercase">Bingo online tipo spot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-black/70">
              Compra tablas 3x3, participa en partidas en vivo y gana por lineas horizontales o
              verticales. Todo el motor critico se procesa en servidor para mayor seguridad.
            </p>
            <div className="space-y-2 rounded-2xl border-2 border-black bg-neutral-100 p-4">
              <p className="text-sm font-black uppercase">Reglas clave</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-black/80">
                <li>Cada tabla cuesta $0.10 y puedes comprar 1, 5, 25 o 100.</li>
                <li>Las lineas ganadoras son horizontales y verticales.</li>
                <li>Se paga cada linea lograda y se acredita directo a tu billetera.</li>
                <li>La bola de la suerte puede agregar giros extra.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-black uppercase">Como se juega y como ganar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-black/80">
            <div className="space-y-1">
              <p className="font-semibold uppercase text-black">Modo de juego</p>
              <p>
                Antes de cada partida compras tus tablas. Al iniciar, el sistema revela
                multiplicadores y luego canta los numeros en tiempo real.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold uppercase text-black">Como ganar</p>
              <p>
                Marca los numeros sorteados y completa lineas. Si una linea incluye multiplicadores,
                el premio de esa linea aumenta segun los multiplicadores activos.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold uppercase text-black">Pagos y control</p>
              <p>
                Los premios se pagan automaticamente al saldo interno y quedan registrados en tu
                historial.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
