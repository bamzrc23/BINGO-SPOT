import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function HistoryPage() {
  return (
    <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
      <CardHeader>
        <CardTitle>Historial</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Vista base para historial de partidas, compras, premios, recargas y retiros.
      </CardContent>
    </Card>
  );
}
