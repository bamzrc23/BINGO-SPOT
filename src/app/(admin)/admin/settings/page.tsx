import { getAdminGameSettings } from "@/modules/admin/application/admin.service";
import { AdminSettingsManager } from "@/modules/admin/ui";
import { Card, CardContent } from "@/components/ui";

export default async function AdminSettingsPage() {
  let settings = [] as Awaited<ReturnType<typeof getAdminGameSettings>>;
  let settingsError: string | null = null;

  try {
    settings = await getAdminGameSettings();
  } catch (error) {
    settingsError =
      error instanceof Error ? error.message : "No se pudo cargar la configuracion.";
  }

  return (
    <div className="space-y-4">
      {settingsError ? (
        <Card>
          <CardContent className="p-4 text-sm text-danger">{settingsError}</CardContent>
        </Card>
      ) : (
        <AdminSettingsManager settings={settings} />
      )}
    </div>
  );
}
