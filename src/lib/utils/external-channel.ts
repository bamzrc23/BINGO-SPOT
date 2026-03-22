const VERIFICATION_CODE_SEGMENT_LENGTH = 8;

function normalizeWhatsAppNumber(rawPhone: string): string {
  return rawPhone.replace(/\D/g, "");
}

export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const normalizedPhone = normalizeWhatsAppNumber(phoneNumber);

  if (!normalizedPhone) {
    throw new Error("Numero de WhatsApp invalido. Revisa la configuracion del administrador.");
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function createVerificationCode(prefix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "COD";
  const segment = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, VERIFICATION_CODE_SEGMENT_LENGTH)
    .toUpperCase();

  return `${safePrefix}-${segment}`;
}

export function getMetadataStringValue(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
