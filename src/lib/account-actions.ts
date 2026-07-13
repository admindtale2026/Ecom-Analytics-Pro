"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ActionState } from "@/lib/admin-actions";

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  });

/** Self-service: the signed-in user changes their own password. */
export async function changeOwnPassword(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me.id) return { error: "You must be signed in to change your password." };

  const parsed = changeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { currentPassword, newPassword } = parsed.data;

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1);
  if (!row) return { error: "Account not found." };

  const ok = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!ok) return { error: "Your current password is incorrect." };

  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(newPassword, 10) })
    .where(eq(users.id, me.id));

  return { ok: "Password updated. Use it the next time you sign in." };
}
