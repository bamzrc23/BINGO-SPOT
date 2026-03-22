import { LoginForm } from "@/modules/auth/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = typeof resolvedSearchParams.next === "string" ? resolvedSearchParams.next : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesion</CardTitle>
        <CardDescription>Ingresa con tu cuenta para entrar a las partidas.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm nextPath={nextPath} />
      </CardContent>
    </Card>
  );
}
