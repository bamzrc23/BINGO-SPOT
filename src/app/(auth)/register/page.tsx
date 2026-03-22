import { RegisterForm } from "@/modules/auth/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Registra tu usuario para entrar a la plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
