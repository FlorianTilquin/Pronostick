import { readConfig } from "@/lib/config";
import { getMatches, getPredictions, getSubmittedUserIds, getUsers } from "@/lib/db";
import { teamName } from "@/lib/teams";
import type { Match, Prediction, User } from "@/lib/types";

type PredictionWithMatch = Prediction & { match: Match };

function outcome(home: number, away: number) {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

function outcomeLabel(value: "H" | "D" | "A", match: Match) {
  if (value === "H") return teamName(match.home_team);
  if (value === "A") return teamName(match.away_team);
  return "Nul";
}

function oddsEligibleUserIds() {
  return new Set(getUsers().filter((user) => !user.is_system).map((user) => user.id));
}

export function scorePrediction(prediction: Prediction, match: Match, allPredictions: Prediction[], eligibleOddsUsers = oddsEligibleUserIds()) {
  if (match.home_score === null || match.away_score === null || match.status !== "finished") {
    return { base: 0, odds: 0, total: 0, details: "En attente" };
  }

  const cfg = readConfig().scoring;
  const actualOutcome = outcome(match.home_score, match.away_score);
  const predictedOutcome = outcome(prediction.home_score, prediction.away_score);
  let base = 0;
  const parts: string[] = [];

  if (prediction.home_score === match.home_score && prediction.away_score === match.away_score) {
    base += cfg.exactScore;
    parts.push("score exact");
  } else {
    if (actualOutcome === predictedOutcome) {
      base += cfg.correctOutcome;
      parts.push("bon signe");
    }
    const actualDiff = match.home_score - match.away_score;
    const predictedDiff = prediction.home_score - prediction.away_score;
    if (actualDiff === predictedDiff) {
      base += cfg.correctGoalDifference;
      parts.push("bon ecart");
    }
    if (prediction.home_score === match.home_score) base += cfg.correctTeamGoals;
    if (prediction.away_score === match.away_score) base += cfg.correctTeamGoals;

    const goalDistance = Math.abs(prediction.home_score - match.home_score) + Math.abs(prediction.away_score - match.away_score);
    base = Math.max(0, base - Math.min(goalDistance, cfg.maxGoalDistancePenalty));
  }

  let odds = 0;
  if (cfg.oddsBonus.enabled && actualOutcome === predictedOutcome) {
    const matchPredictions = allPredictions.filter((item) => item.match_id === match.id && eligibleOddsUsers.has(item.user_id));
    const sameOutcome = matchPredictions.filter((item) => outcome(item.home_score, item.away_score) === predictedOutcome).length;
    if (matchPredictions.length > 0) {
      const rarity = 1 - sameOutcome / matchPredictions.length;
      odds = Math.round(cfg.oddsBonus.minBonus + rarity * cfg.oddsBonus.maxBonus);
    }
  }

  return { base, odds, total: base + odds, details: parts.join(", ") || "proximite" };
}

export function leaderboard() {
  const users = getUsers();
  const matches = getMatches();
  const predictions = getPredictions();
  const submitted = getSubmittedUserIds();
  const eligibleOddsUsers = oddsEligibleUserIds();
  const rows = users
    .filter((user) => user.role === "player" || submitted.has(user.id))
    .map((user) => {
      const userPredictions = predictions.filter((prediction) => prediction.user_id === user.id);
      const total = userPredictions.reduce((sum, prediction) => {
        const match = matches.find((item) => item.id === prediction.match_id);
        return match ? sum + scorePrediction(prediction, match, predictions, eligibleOddsUsers).total : sum;
      }, 0);
      return { user, total, predictions: userPredictions.length, submitted: submitted.has(user.id) };
    })
    .sort((a, b) => b.total - a.total || a.user.display_name.localeCompare(b.user.display_name));

  return rows;
}

export function timeline() {
  const users = getUsers().filter((user) => user.role === "player");
  const matches = getMatches().filter((match) => match.status === "finished");
  const predictions = getPredictions();
  const eligibleOddsUsers = oddsEligibleUserIds();
  const cumul = new Map<number, number>(users.map((user) => [user.id, 0]));

  return matches.map((match) => {
    const row: Record<string, number | string> = { match: `${match.match_no}. ${teamName(match.home_team)}-${teamName(match.away_team)}` };
    for (const user of users) {
      const prediction = predictions.find((item) => item.user_id === user.id && item.match_id === match.id);
      if (prediction) {
        cumul.set(user.id, (cumul.get(user.id) ?? 0) + scorePrediction(prediction, match, predictions, eligibleOddsUsers).total);
      }
      row[user.display_name] = cumul.get(user.id) ?? 0;
    }
    return row;
  });
}

export function predictionsByMatchForUserVisibility(viewer: User) {
  const matches = getMatches();
  const users = getUsers().filter((user) => user.role === "player");
  const humanUsers = users.filter((user) => !user.is_system);
  const predictions = getPredictions();
  const submitted = getSubmittedUserIds();
  const viewerCanSeeAll = viewer.role === "admin" || submitted.has(viewer.id);

  return matches.map((match) => {
    const humanPredictions = predictions.filter((item) => item.match_id === match.id && humanUsers.some((user) => user.id === item.user_id));
    const counts = { H: 0, D: 0, A: 0 };
    for (const prediction of humanPredictions) {
      counts[outcome(prediction.home_score, prediction.away_score)] += 1;
    }
    const market = viewerCanSeeAll && humanPredictions.length
      ? (["H", "D", "A"] as const).map((value) => {
          const probability = counts[value] / humanPredictions.length;
          return {
            outcome: value,
            label: outcomeLabel(value, match),
            count: counts[value],
            probability,
            odds: probability > 0 ? 1 / probability : null
          };
        })
      : null;

    return {
      match,
      market,
      predictions: users.map((user) => {
        const prediction = predictions.find((item) => item.user_id === user.id && item.match_id === match.id);
        const visible = viewerCanSeeAll || user.id === viewer.id;
        return { user, prediction: visible ? prediction : null, hidden: !visible && Boolean(prediction) };
      })
    };
  });
}

export function matchImpactStats() {
  const matches = getMatches().filter((match) => match.status === "finished");
  const users = getUsers().filter((user) => user.role === "player");
  const predictions = getPredictions();
  const eligibleOddsUsers = oddsEligibleUserIds();

  const rows = matches.map((match) => {
    const scores = users
      .map((user) => {
        const prediction = predictions.find((item) => item.user_id === user.id && item.match_id === match.id);
        if (!prediction) return null;
        const scored = scorePrediction(prediction, match, predictions, eligibleOddsUsers);
        return { user, prediction, ...scored };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const totals = scores.map((item) => item.total);
    const max = totals.length ? Math.max(...totals) : 0;
    const min = totals.length ? Math.min(...totals) : 0;
    const average = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0;
    const best = scores.filter((item) => item.total === max);
    const exactCount = scores.filter((item) => item.prediction.home_score === match.home_score && item.prediction.away_score === match.away_score).length;

    return {
      match,
      scores,
      best,
      average,
      spread: max - min,
      exactCount,
      topGap: max - average
    };
  });

  return {
    swingMatches: [...rows].sort((a, b) => b.spread - a.spread || b.topGap - a.topGap).slice(0, 5),
    soloShots: [...rows]
      .filter((row) => row.best.length === 1 && row.best[0]?.total > 0)
      .sort((a, b) => b.topGap - a.topGap || b.spread - a.spread)
      .slice(0, 5),
    exactMatches: [...rows].filter((row) => row.exactCount > 0).sort((a, b) => b.exactCount - a.exactCount || b.spread - a.spread).slice(0, 5)
  };
}
