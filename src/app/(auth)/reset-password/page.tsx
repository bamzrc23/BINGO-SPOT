import { ResetPasswordForm } from "@/modules/auth/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actualizar contrasena</CardTitle>
        <CardDescription>
          Ingresa tu nueva contrasena luego de abrir el enlace enviado a tu correo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
