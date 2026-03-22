"use client";

import { useActionState } from "react";

import { upsertGameSettingAction } from "@/modules/admin/application";
import {
  ADMIN_ROLE_LABELS,
  ADMIN_ROLE_PERMISSION_MATRIX,
  INITIAL_ADMIN_FORM_STATE,
  type GameSettingRow
} from "@/modules/admin/domain";
import { AdminFormFeedback } from "@/modules/admin/ui/admin-form-feedback";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

type AdminSettingsManagerProps = {
  settings: GameSettingRow[];
};

function valueToText(value: GameSettingRow["value"]): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

export function AdminSettingsManager({ settings }: AdminSettingsManagerProps) {
  const [state, formAction, isPending] = useActionState(
    upsertGameSettingAction,
    INITIAL_ADMIN_FORM_STATE
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Parametros basicos del juego</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminFormFeedback state={state} />

          <div className="space-y-3">
            {settings.map((setting) => (
              <form
                key={setting.key}
                action={formAction}
                className="rounded-xl border border-border p-4"
                onSubmit={(event) => {
                  if (!window.confirm("Confirma guardar este parametro?")) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="key" value={setting.key} />
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{setting.key}</p>
                    <Input
                      name="description"
                      defaultValue={setting.description ?? ""}
                      placeholder="Descripcion"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <Input
                      name="valueRaw"
                      defaultValue={valueToText(setting.value)}
                      placeholder='Ej: 0.12 o {"enabled":true}'
                      required
                    />
                    {setting.updatedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Ultima actualizacion: {formatDateTime(setting.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={isPending}>
                      Guardar
                    </Button>
                  </div>
                </div>
              </form>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles y permisos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ADMIN_ROLE_PERMISSION_MATRIX.map((item) => (
              <div key={item.role} className="rounded-xl border border-border p-4">
                <p className="text-sm font-semibold">{ADMIN_ROLE_LABELS[item.role]}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {item.capabilities.map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
