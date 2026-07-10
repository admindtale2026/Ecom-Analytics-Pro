"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db/client";
import { dataSources, schemaMappings, settings, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { IDENTITY_MODE_KEY } from "@/server/customers";
import { STORES } from "@/lib/constants";
import { CANONICAL_FIELDS } from "@/lib/ingest/mapping";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin") throw new Error("Admins only.");
  return user;
}

const storeId = z.enum(STORES.map((s) => s.id) as [string, ...string[]]);

const newMember = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["admin", "sales"]),
});

export type ActionState = { error?: string; ok?: string };

export async function addTeamMember(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = newMember.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, email, password, role } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: "That email already has an account." };

  await db.insert(users).values({
    name,
    email,
    role,
    passwordHash: await bcrypt.hash(password, 10),
  });
  revalidatePath("/admin/users");
  return { ok: `${name} can now sign in.` };
}

export async function deleteTeamMember(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad user id.");
  if (id === me.id) throw new Error("You cannot delete your own account.");

  const [{ admins }] = await db
    .select({ admins: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "admin"));
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id));
  if (target?.role === "admin" && Number(admins) <= 1) {
    throw new Error("Cannot delete the last remaining admin.");
  }

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
}

export async function setIdentityMode(formData: FormData): Promise<void> {
  await requireAdmin();
  const mode = z.enum(["email", "phone", "both"]).parse(formData.get("mode"));
  await db
    .insert(settings)
    .values({ key: IDENTITY_MODE_KEY, value: mode })
    .onConflictDoUpdate({ target: settings.key, set: { value: mode } });
  revalidatePath("/admin/users");
  revalidatePath("/customers");
}

/**
 * Persist Admin › Schema Mapping. Only fields whose source column differs from
 * the built-in default are stored, so `resolveMapping()` keeps tracking the
 * defaults for everything the admin never touched.
 */
export async function saveSchemaMapping(formData: FormData): Promise<void> {
  await requireAdmin();
  const store = storeId.parse(formData.get("store"));

  const overrides = CANONICAL_FIELDS.flatMap((field) => {
    const value = String(formData.get(field.key) ?? "").trim();
    if (!value || value === field.defaultColumn) return [];
    return [{ storeId: store, canonicalField: field.key, sourceColumn: value }];
  });

  await db.delete(schemaMappings).where(eq(schemaMappings.storeId, store));
  if (overrides.length) await db.insert(schemaMappings).values(overrides);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/users");
}

export async function setDataSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const store = storeId.parse(formData.get("store"));
  const kind = z.enum(["sheets", "upload"]).parse(formData.get("kind"));
  const endpointUrl = String(formData.get("endpointUrl") ?? "").trim() || null;

  if (kind === "sheets" && endpointUrl && !/^https:\/\/docs\.google\.com\//.test(endpointUrl)) {
    throw new Error("Sheets endpoint must be a docs.google.com URL.");
  }

  // data_sources has no unique index on store_id, so upsert by hand.
  const [existing] = await db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(eq(dataSources.storeId, store));
  if (existing) {
    await db.update(dataSources).set({ kind, endpointUrl }).where(eq(dataSources.id, existing.id));
  } else {
    await db.insert(dataSources).values({ storeId: store, kind, endpointUrl });
  }
  revalidatePath("/admin/settings");
}
