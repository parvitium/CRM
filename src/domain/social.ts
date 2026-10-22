export const SOCIAL_PLATFORMS = ["facebook", "instagram", "x", "tiktok", "youtube"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const ACCESS_STATUSES = [
  "none",
  "requested",
  "partner_granted",
  "delegated",
  "expired",
] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

const REF_PREFIXES = ["op://", "vault://", "aws-secrets://"] as const;

const FORBIDDEN_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "cookie",
  "credentials",
];

export function isAllowedSecretsRef(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  return REF_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function assertAllowedSecretsRef(value: string | null | undefined): void {
  if (!isAllowedSecretsRef(value)) {
    throw new Error(
      "secrets_manager_ref must be a vault pointer (op://, vault://, or aws-secrets://)",
    );
  }
}

export function isForbiddenSocialField(name: string): boolean {
  const normalized = name.toLowerCase();
  return FORBIDDEN_KEYS.includes(normalized);
}

export function socialAccessLabel(status: AccessStatus): string {
  switch (status) {
    case "none":
      return "No access";
    case "requested":
      return "Invite sent";
    case "partner_granted":
      return "Partner access";
    case "delegated":
      return "Delegated";
    case "expired":
      return "Expired";
  }
}
