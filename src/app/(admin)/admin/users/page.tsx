import { getAdminUserWalletTransactions, getAdminUsers } from "@/modules/admin/application/admin.service";
import { AdminUsersManagement } from "@/modules/admin/ui";
import { Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

type AdminUsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = (await searchParams) ?? {};
  const search = typeof params.search === "string" ? params.search : "";
  const role = params.role === "admin" || params.role === "user" ? params.role : undefined;
  const accountStatus =
    params.accountStatus === "pending" ||
    params.accountStatus === "active" ||
    params.accountStatus === "suspended"
      ? params.accountStatus
      : undefined;
  const selectedUserId = typeof params.userId === "string" ? params.userId : undefined;

  let users = [] as Awaited<ReturnType<typeof getAdminUsers>>;
  let usersError: string | null = null;

  try {
    users = await getAdminUsers({
      search: search || undefined,
      role,
      accountStatus,
      limit: 120
    });
  } catch (error) {
    usersError = error instanceof Error ? error.message : "No se pudo cargar usuarios.";
  }

  let selectedUserTransactions = [] as Awaited<ReturnType<typeof getAdminUserWalletTransactions>>;
  let transactionsError: string | null = null;

  if (selectedUserId) {
    try {
      selectedUserTransactions = await getAdminUserWalletTransactions({
        userId: selectedUserId,
        limit: 60
      });
    } catch (error) {
      transactionsError =
        error instanceof Error ? error.message : "No se pudo cargar movimientos de billetera.";
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <Input
              name="search"
              defaultValue={search}
              placeholder="Buscar por nombre, nickname, correo o telefono"
            />
            <select
              name="role"
              defaultValue={role ?? ""}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="">Todos los roles</option>
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
            <select
              name="accountStatus"
              defaultValue={accountStatus ?? ""}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activa</option>
              <option value="pending">Pendiente</option>
              <option value="suspended">Suspendida</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Aplicar
            </button>
          </form>
        </CardContent>
      </Card>

      {usersError ? (
        <Card>
          <CardContent className="p-4 text-sm text-danger">{usersError}</CardContent>
        </Card>
      ) : (
        <AdminUsersManagement
          users={users}
          selectedUserId={selectedUserId}
          selectedUserTransactions={selectedUserTransactions}
        />
      )}

      {transactionsError ? (
        <Card>
          <CardContent className="p-4 text-sm text-danger">{transactionsError}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
