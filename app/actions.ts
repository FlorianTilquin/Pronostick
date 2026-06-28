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
  getActiveRoundId,
  getMatches,
  getRoundMatches,
  getPredictions,
  getSpecialPredictions,
  getUserByUsername,
  hasSubmitted,
  setActiveRound,
  setKnockoutSeed,
  setThirdPlaceAssignment,
  submitUser,
  updateMatchResult,
  updateUserDisplayColor,
  updateUserDisplayName,
  upsertPrediction,
  upsertSpecialPrediction
} from "@/lib/db";
import { isValidChartColor } from "@/lib/chartColors";
import { roundOrder } from "@/lib/knockout";
import { clearLoginFailures, loginBlockedMinutes, recordLoginFailure } from "@/lib/loginRateLimit";
import { specialBets } from "@/lib/specials";
import type { PredictionRoundId } from "@/lib/types";

const score = z.coerce.number().int().min(0).max(30);

function persistPredictionForm(userId: number, formData: FormData) {
  const roundId = getActiveRoundId();
  const matches = getRoundMatches(roundId);
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

  if (roundId === "group") {
    for (const { category } of specialBets) {
      const value = String(formData.get(category) ?? "").trim();
      if (value) {
        upsertSpecialPrediction(userId, category, value);
      }
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
  const roundId = getActiveRoundId();
  if (hasSubmitted(user.id, roundId)) return;
  persistPredictionForm(user.id, formData);
  revalidatePath("/predict");
  redirect("/predict?sauvegarde=1");
}

export async function submitPredictionsAction(formData: FormData) {
  const user = await requireUser();
  const roundId = getActiveRoundId();
  if (hasSubmitted(user.id, roundId)) return;
  persistPredictionForm(user.id, formData);
  const totalMatches = getRoundMatches(roundId).length;
  const roundMatchIds = new Set(getRoundMatches(roundId).map((match) => match.id));
  const count = getPredictions(user.id).filter((prediction) => roundMatchIds.has(prediction.match_id)).length;
  const specials = getSpecialPredictions(user.id).length;
  if (count === totalMatches && (roundId !== "group" || specials === specialBets.length)) {
    submitUser(user.id, roundId);
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
  const winner = String(formData.get("winnerTeam") ?? "");
  const homeScore = home === "" || home === null ? null : score.parse(home);
  const awayScore = away === "" || away === null ? null : score.parse(away);
  updateMatchResult(matchId, homeScore, awayScore, winner || null);
  revalidatePath("/admin");
  revalidatePath("/classement");
  revalidatePath("/graphiques");
  revalidatePath("/tableau");
  revalidatePath("/predict");
}

export async function updateKnockoutSeedAction(formData: FormData) {
  await requireAdmin();
  const source = String(formData.get("source") ?? "").trim();
  const team = String(formData.get("team") ?? "").trim();
  setKnockoutSeed(source, team);
  revalidatePath("/admin");
  revalidatePath("/predict");
  revalidatePath("/tableau");
}

export async function updateThirdPlaceAssignmentAction(formData: FormData) {
  await requireAdmin();
  const matchNo = z.coerce.number().int().parse(formData.get("matchNo"));
  const side = String(formData.get("side") ?? "") === "home" ? "home" : "away";
  const source = String(formData.get("source") ?? "").trim();
  setThirdPlaceAssignment(matchNo, side, source);
  revalidatePath("/admin");
  revalidatePath("/predict");
  revalidatePath("/tableau");
}

export async function openRoundAction(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId") ?? "") as PredictionRoundId;
  if (!roundOrder.includes(roundId)) return;
  setActiveRound(roundId);
  revalidatePath("/admin");
  revalidatePath("/predict");
  revalidatePath("/tableau");
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
