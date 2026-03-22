import { ForgotPasswordForm } from "@/modules/auth/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contrasena</CardTitle>
        <CardDescription>Ingresa tu correo para recibir instrucciones de recuperacion.</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
