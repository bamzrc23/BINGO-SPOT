import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export function WithdrawalRulesInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>REGLAS DE RETIRO</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Los retiros se procesan unicamente dentro del sistema.</p>
        <p>Bancos habilitados: Banco Pichincha y Banco Guayaquil.</p>
        <p className="font-semibold">Monto minimo por retiro: $10.00</p>
        <p>
          Tiempo estimado para acreditarse en cuenta: 24 a 48 horas, segun validacion
          administrativa.
        </p>
      </CardContent>
    </Card>
  );
}
