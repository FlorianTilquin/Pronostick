"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, requireAdmin, requireUser } from "@/lib/auth";
import {
  addUser,
  changeUserPassword,
  deleteUser,
  getMatches,
  getPredictions,
  getSpecialPredictions,
  getUserByUsername,
  hasSubmitted,
  submitUser,
  updateMatchResult,
  updateUserDisplayColor,
  updateUserDisplayName,
  upsertPrediction,
  upsertSpecialPrediction
} from "@/lib/db";
import { isValidChartColor } from "@/lib/chartColors";
import { clearLoginFailures, loginBlockedMinutes, recordLoginFailure } from "@/lib/loginRateLimit";
import { specialBets } from "@/lib/specials";

const score = z.coerce.number().int().min(0).max(30);

function persistPredictionForm(userId: number, formData: FormData) {
  const matches = getMatches();
  for (const match of matches) {
    const homeRaw = formData.get(`home_${match.id}`);
    const awayRaw = formData.get(`away_${match.id}`);
    if (homeRaw === null || awayRaw === null || homeRaw === "" || awayRaw === "") continue;
    const parsedHome = score.safeParse(homeRaw);
    const parsedAway = score.safeParse(awayRaw);
    if (parsedHome.success && parsedAway.success) {
      upsertPrediction(userId, match.id, parsedHome.data, parsedAway.data);
    }
  }

  for (const { category } of specialBets) {
    const value = String(formData.get(category) ?? "").trim();
    if (value) {
      upsertSpecialPrediction(userId, category, value);
    }
  }
}

export async function loginAction(_: unknown, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const blockedMinutes = loginBlockedMinutes(username);
  if (blockedMinutes > 0) {
    return { error: `Trop de tentatives. Réessaie dans ${blockedMinutes} min.` };
  }
  const user = getUserByUsername(username);
  if (!user || user.is_system || !bcrypt.compareSync(password, user.password_hash)) {
    recordLoginFailure(username);
    return { error: "Identifiants incorrects." };
  }
  clearLoginFailures(username);
  await createSession(user);
  redirect("/predict");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function savePredictionsAction(formData: FormData) {
  const user = await requireUser();
  if (hasSubmitted(user.id)) return;
  persistPredictionForm(user.id, formData);
  revalidatePath("/predict");
  redirect("/predict?sauvegarde=1");
}

export async function submitPredictionsAction(formData: FormData) {
  const user = await requireUser();
  if (hasSubmitted(user.id)) return;
  persistPredictionForm(user.id, formData);
  const totalMatches = getMatches().length;
  const count = getPredictions(user.id).length;
  const specials = getSpecialPredictions(user.id).length;
  if (count === totalMatches && specials === specialBets.length) {
    submitUser(user.id);
  }
  revalidatePath("/");
  revalidatePath("/tableau");
  revalidatePath("/predict");
}

export async function updateResultAction(formData: FormData) {
  await requireAdmin();
  const matchId = z.coerce.number().int().parse(formData.get("matchId"));
  const home = formData.get("homeScore");
  const away = formData.get("awayScore");
  const homeScore = home === "" || home === null ? null : score.parse(home);
  const awayScore = away === "" || away === null ? null : score.parse(away);
  updateMatchResult(matchId, homeScore, awayScore);
  revalidatePath("/admin");
  revalidatePath("/classement");
  revalidatePath("/graphiques");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !displayName || password.length < 6) return;
  addUser(username, displayName, password);
  revalidatePath("/admin");
}

export async function changeUserPasswordAction(formData: FormData) {
  await requireAdmin();
  const userId = z.coerce.number().int().parse(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return;
  changeUserPassword(userId, password);
  revalidatePath("/admin");
}

export async function updateUserDisplayNameAction(formData: FormData) {
  await requireAdmin();
  const userId = z.coerce.number().int().parse(formData.get("userId"));
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return;
  updateUserDisplayName(userId, displayName);
  revalidatePath("/admin");
  revalidatePath("/classement");
  revalidatePath("/tableau");
  revalidatePath("/graphiques");
}

export async function updateUserColorAction(formData: FormData) {
  await requireAdmin();
  const userId = z.coerce.number().int().parse(formData.get("userId"));
  const color = String(formData.get("color") ?? "").trim();
  if (!isValidChartColor(color)) return;
  updateUserDisplayColor(userId, color);
  revalidatePath("/admin");
  revalidatePath("/graphiques");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = z.coerce.number().int().parse(formData.get("userId"));
  if (userId === admin.id) return;
  deleteUser(userId);
  revalidatePath("/admin");
  revalidatePath("/classement");
  revalidatePath("/tableau");
  revalidatePath("/graphiques");
}
