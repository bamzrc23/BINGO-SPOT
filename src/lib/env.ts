import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PAYPHONE_WEBHOOK_TOKEN: z.string().min(1).optional(),
  ADMIN_WHATSAPP_NUMBER: z.string().min(7).optional()
});

const resolvedSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: resolvedSupabaseKey,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PAYPHONE_WEBHOOK_TOKEN: process.env.PAYPHONE_WEBHOOK_TOKEN,
  ADMIN_WHATSAPP_NUMBER: process.env.ADMIN_WHATSAPP_NUMBER
});

if (!parsedEnv.success) {
  // Falla temprano para evitar estados inconsistenes en runtime.
  throw new Error(
    `Variables de entorno invalidas: ${JSON.stringify(parsedEnv.error.flatten().fieldErrors)}. Usa NEXT_PUBLIC_SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.`
  );
}

export const env = parsedEnv.data;
