"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updateUserStatusAction } from "@/modules/admin/application";
import {
  ADMIN_ACCOUNT_STATUS_LABELS,
  ADMIN_ROLE_LABELS,
  INITIAL_ADMIN_FORM_STATE,
  type AdminUserWithWallet,
  type AdminWalletTransaction
} from "@/modules/admin/domain";
import { AdminFormFeedback } from "@/modules/admin/ui/admin-form-feedback";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { WALLET_DIRECTION_LABELS, WALLET_MOVEMENT_LABELS } from "@/modules/wallet/domain";

type AdminUsersManagementProps = {
  users: AdminUserWithWallet[];
  selectedUserId?: string;
  selectedUserTransactions: AdminWalletTransaction[];
};

export function AdminUsersManagement({
  users,
  selectedUserId,
  selectedUserTransactions
}: AdminUsersManagementProps) {
  const [state, formAction, isPending] = useActionState(
    updateUserStatusAction,
    INITIAL_ADMIN_FORM_STATE
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Usuarios y billeteras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminFormFeedback state={state} />

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay usuarios para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Usuario</th>
                    <th className="px-2 py-2 font-medium">Rol</th>
                    <th className="px-2 py-2 font-medium">Estado</th>
                    <th className="px-2 py-2 font-medium">Saldo</th>
                    <th className="px-2 py-2 font-medium">Movimientos</th>
                    <th className="px-2 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border/60 align-top">
                      <td className="px-2 py-3">
                        <p className="font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">@{user.nickname}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        {user.phone ? <p className="text-xs text-muted-foreground">{user.phone}</p> : null}
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={user.role === "admin" ? "danger" : "default"}>
                          {ADMIN_ROLE_LABELS[user.role]}
                        </Badge>
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={user.accountStatus === "active" ? "success" : "default"}>
                          {ADMIN_ACCOUNT_STATUS_LABELS[user.accountStatus]}
                        </Badge>
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium">{formatCurrency(user.walletBalance)}</p>
                        <p className="text-xs text-muted-foreground">
                          Bloqueado: {formatCurrency(user.walletLockedBalance)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Ult. update: {user.walletUpdatedAt ? formatDateTime(user.walletUpdatedAt) : "-"}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium">{user.walletTxCount}</p>
                        <p className="text-xs text-muted-foreground">
                          Ultimo: {user.lastWalletTxAt ? formatDateTime(user.lastWalletTxAt) : "-"}
                        </p>
                        <Link
                          href={`/admin/users?userId=${user.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Ver detalle
                        </Link>
                      </td>
                      <td className="px-2 py-3">
                        <form
                          action={formAction}
                          className="space-y-2"
                          onSubmit={(event) => {
                            const submitter = (event.nativeEvent as SubmitEvent)
                              .submitter as HTMLButtonElement | null;

                            if (!submitter) {
                              return;
                            }

                            const nextStatus = submitter.value === "active" ? "activar" : "suspender";
                            if (!window.confirm(`Confirma ${nextStatus} esta cuenta?`)) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="userId" value={user.id} />
                          <Input
                            name="reason"
                            placeholder="Motivo (opcional)"
                            className="h-9 text-xs"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              name="accountStatus"
                              value="active"
                              size="sm"
                              disabled={isPending}
                            >
                              Activar
                            </Button>
                            <Button
                              type="submit"
                              name="accountStatus"
                              value="suspended"
                              size="sm"
                              variant="danger"
                              disabled={isPending}
                            >
                              Suspender
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUserId ? (
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de billetera (usuario seleccionado)</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedUserTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay movimientos registrados para el usuario seleccionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Fecha</th>
                      <th className="px-2 py-2 font-medium">Tipo</th>
                      <th className="px-2 py-2 font-medium">Direccion</th>
                      <th className="px-2 py-2 font-medium">Monto</th>
                      <th className="px-2 py-2 font-medium">Antes</th>
                      <th className="px-2 py-2 font-medium">Despues</th>
                      <th className="px-2 py-2 font-medium">Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUserTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-border/60">
                        <td className="px-2 py-2">{formatDateTime(tx.createdAt)}</td>
                        <td className="px-2 py-2">{WALLET_MOVEMENT_LABELS[tx.movementType]}</td>
                        <td className="px-2 py-2">{WALLET_DIRECTION_LABELS[tx.direction]}</td>
                        <td className="px-2 py-2">{formatCurrency(tx.amount)}</td>
                        <td className="px-2 py-2">{formatCurrency(tx.balanceBefore)}</td>
                        <td className="px-2 py-2">{formatCurrency(tx.balanceAfter)}</td>
                        <td className="px-2 py-2 text-muted-foreground">{tx.operationRef ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
