import { ValidationError } from "@/server/http/errors";

// Framework/Prisma-free on purpose (see facilityProvisioningService.ts's module comment) — pure
// input handling for "super-admin creates a facility + its first admin," unit-testable with zero setup.

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// The administrative home for SUPER_ADMIN/RESEARCHER accounts (see facilityRepository.ts's
// getHqFacility) — never a real hospital, so it can't be reused or reassigned via this flow.
const RESERVED_SLUGS = new Set(["hq"]);

export interface CreateFacilityWithAdminInput {
  name: string;
  /** URL-safe identifier; auto-derived from `name` when omitted. */
  slug?: string;
  stateCode?: string;
  adminName?: string;
  adminEmail: string;
}

export interface ValidatedFacilityProvisioningInput {
  name: string;
  slug: string;
  stateCode?: string;
  adminName?: string;
  adminEmail: string;
}

/** Derives a URL-safe slug from a facility name: lowercase, diacritics stripped, non-alphanumeric runs collapsed to single hyphens. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Validates and normalizes a facility+admin creation request. Throws ValidationError (with
 * per-field messages) on any problem; never touches the database, so callers are responsible for
 * checking slug/email uniqueness themselves.
 */
export function validateFacilityProvisioningInput(
  input: CreateFacilityWithAdminInput
): ValidatedFacilityProvisioningInput {
  const fieldErrors: Record<string, string> = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "Facility name is required.";

  const explicitSlug = input.slug?.trim().toLowerCase();
  const slug = explicitSlug || slugify(name);
  if (!slug || !SLUG_PATTERN.test(slug)) {
    fieldErrors.slug = "Slug must be lowercase letters, numbers, and hyphens only (e.g. \"city-general-hospital\").";
  } else if (RESERVED_SLUGS.has(slug)) {
    fieldErrors.slug = `"${slug}" is a reserved slug and can't be used for a facility.`;
  }

  const adminName = input.adminName?.trim() || undefined;

  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!adminEmail) fieldErrors.adminEmail = "Admin email is required.";

  const stateCode = input.stateCode?.trim() || undefined;

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError("Please fix the highlighted fields.", fieldErrors);
  }

  return { name, slug, stateCode, adminName, adminEmail };
}
