import fs from "node:fs";
import path from "node:path";
import { getMatches, getPredictions, getUsers } from "@/lib/db";
import { normalizeTeam } from "@/lib/resultsSync";
import { scorePrediction } from "@/lib/scoring";
import type { Match, User } from "@/lib/types";

// Donnees agregees depuis le scoreboard public ESPN (sans cle) : meilleurs
// buteurs et chronologie des buts de chaque match.
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const SYNC_COOLDOWN_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const LATE_WINDOW_MINUTES = 10;

let lastAttemptAt = 0;

export type Scorer = {
  name: string;
  team: string;
  goals: number;
};

type ScorersFile = {
  updated_at: string;
  scorers: Scorer[];
};

type GoalEvent = {
  minute: number;
  side: "home" | "away";
};

type MatchEventRecord = {
  endMinute: number;
  goals: GoalEvent[];
};

type MatchEventsFile = {
  updated_at: string;
  matches: Record<string, MatchEventRecord>;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  team?: { id?: string; name?: string; displayName?: string };
};

type EspnDetail = {
  scoringPlay?: boolean;
  ownGoal?: boolean;
  shootout?: boolean;
  team?: { id?: string };
  clock?: { displayValue?: string };
  athletesInvolved?: Array<{ displayName?: string }>;
};

type EspnEvent = {
  date?: string;
  status?: { displayClock?: string; type?: { completed?: boolean } };
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    details?: EspnDetail[];
  }>;
};

function scorersPath() {
  return path.join(process.cwd(), "data", "top_scorers.json");
}

function matchEventsPath() {
  return path.join(process.cwd(), "data", "match_events.json");
}

function readJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function readTopScorers() {
  return readJson<ScorersFile>(scorersPath());
}

export function readMatchEvents() {
  return readJson<MatchEventsFile>(matchEventsPath());
}

function utcDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10).replaceAll("-", "");
}

// "90'+8'" -> 98, "45'+2'" -> 47, "9'" -> 9.
function parseMinute(display?: string): number | null {
  const parts = display?.match(/\d+/g);
  if (!parts) return null;
  return parts.reduce((sum, value) => sum + Number(value), 0);
}

// Nom d'equipe tel qu'utilise en base, retrouve depuis le nom ESPN.
function canonicalTeamName(espnName: string) {
  const wanted = normalizeTeam(espnName);
  for (const match of getMatches()) {
    if (normalizeTeam(match.home_team) === wanted) return match.home_team;
    if (normalizeTeam(match.away_team) === wanted) return match.away_team;
  }
  return espnName;
}

function competitorName(competitor: EspnCompetitor) {
  return competitor.team?.name ?? competitor.team?.displayName ?? "";
}

function aggregateScorers(events: EspnEvent[]): Scorer[] {
  const goals = new Map<string, Scorer>();
  for (const event of events) {
    if (!event.status?.type?.completed) continue;
    const competition = event.competitions?.[0];
    const teamsById = new Map<string, string>();
    for (const competitor of competition?.competitors ?? []) {
      if (competitor.team?.id) teamsById.set(competitor.team.id, canonicalTeamName(competitorName(competitor)));
    }
    for (const detail of competition?.details ?? []) {
      if (!detail.scoringPlay || detail.ownGoal || detail.shootout) continue;
      const player = detail.athletesInvolved?.[0]?.displayName;
      if (!player) continue;
      const team = teamsById.get(detail.team?.id ?? "") ?? "";
      const key = `${player}|${team}`;
      const entry = goals.get(key) ?? { name: player, team, goals: 0 };
      entry.goals += 1;
      goals.set(key, entry);
    }
  }
  return [...goals.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

// Reconstruit la chronologie des buts par match, rapportee a NOTRE sens
// domicile/exterieur (qui peut differer de celui d'ESPN). Un match n'est
// conserve que si le score reconstruit colle au score officiel ESPN.
function extractMatchEvents(events: EspnEvent[]): Record<string, MatchEventRecord> {
  const matches = getMatches();
  const records: Record<string, MatchEventRecord> = {};

  for (const event of events) {
    if (!event.status?.type?.completed) continue;
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    if (competitors.length !== 2) continue;

    const normsInEvent = competitors.map((competitor) => normalizeTeam(competitorName(competitor)));
    const match = matches.find(
      (item) =>
        normsInEvent.includes(normalizeTeam(item.home_team)) && normsInEvent.includes(normalizeTeam(item.away_team))
    );
    if (!match) continue;

    const normHome = normalizeTeam(match.home_team);
    const idToNorm = new Map<string, string>();
    const espnScore = { home: 0, away: 0 };
    for (const competitor of competitors) {
      const norm = normalizeTeam(competitorName(competitor));
      if (competitor.team?.id) idToNorm.set(competitor.team.id, norm);
      const value = Number(competitor.score);
      if (Number.isFinite(value)) {
        if (norm === normHome) espnScore.home = value;
        else espnScore.away = value;
      }
    }

    const goals: GoalEvent[] = [];
    let valid = true;
    for (const detail of competition?.details ?? []) {
      if (!detail.scoringPlay || detail.shootout) continue;
      const minute = parseMinute(detail.clock?.displayValue);
      const scorerNorm = idToNorm.get(detail.team?.id ?? "");
      if (minute === null || !scorerNorm) {
        valid = false;
        break;
      }
      goals.push({ minute, side: scorerNorm === normHome ? "home" : "away" });
    }
    if (!valid) continue;

    goals.sort((a, b) => a.minute - b.minute);
    const reconstructed = goals.reduce(
      (acc, goal) => {
        acc[goal.side] += 1;
        return acc;
      },
      { home: 0, away: 0 }
    );
    // Score reconstruit incoherent (csc mal attribue, evenement manquant) : on ignore.
    if (reconstructed.home !== espnScore.home || reconstructed.away !== espnScore.away) continue;

    const lastGoalMinute = goals.length ? goals[goals.length - 1].minute : 0;
    const endMinute = parseMinute(event.status?.displayClock) ?? Math.max(90, lastGoalMinute);
    records[String(match.id)] = { endMinute, goals };
  }

  return records;
}

// Rafraichit data/top_scorers.json et data/match_events.json depuis ESPN, au
// plus toutes les 30 minutes et seulement une fois le tournoi commence.
// N'echoue jamais (les erreurs reseau sont avalees).
export async function maybeSyncTournamentFeed() {
  try {
    const now = Date.now();
    if (now - lastAttemptAt < SYNC_COOLDOWN_MS) return;
    const kickoffs = getMatches().map((match) => Date.parse(match.kickoff_at));
    const firstKickoff = Math.min(...kickoffs);
    if (!Number.isFinite(firstKickoff) || firstKickoff > now) return;
    lastAttemptAt = now;

    const range = `${utcDay(firstKickoff)}-${utcDay(now + 24 * 60 * 60 * 1000)}`;
    const response = await fetch(`${ESPN_SCOREBOARD}?dates=${range}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`ESPN scoreboard HTTP ${response.status}`);
    const payload = (await response.json()) as { events?: EspnEvent[] };
    const events = payload.events ?? [];

    const scorers = aggregateScorers(events);
    if (scorers.length) {
      writeJson(scorersPath(), { updated_at: new Date(now).toISOString(), scorers });
    }
    const matchEvents = extractMatchEvents(events);
    if (Object.keys(matchEvents).length) {
      writeJson(matchEventsPath(), { updated_at: new Date(now).toISOString(), matches: matchEvents });
    }
  } catch (error) {
    console.warn("[tournamentStats] echec de la synchronisation du feed:", error);
  }
}

export type LateGoalLoss = {
  user: User;
  lost: number;
};

// Points perdus par joueur a cause de buts inscrits dans les 10 dernieres
// minutes (temps additionnel inclus). Pour chaque match, on compare les points
// du joueur avec le score au debut de la fenetre et avec le score final ; seules
// les pertes nettes sont comptees. Inclut XGBoost, exclut les bookmakers.
export function lateGoalLosses(): LateGoalLoss[] {
  const feed = readMatchEvents();
  if (!feed) return [];
  const matches = getMatches();
  const predictions = getPredictions();
  const players = getUsers().filter((user) => user.role === "player" && user.system_type !== "bookmaker");
  const totals = new Map<number, number>(players.map((player) => [player.id, 0]));

  for (const [matchId, record] of Object.entries(feed.matches)) {
    const match = matches.find((item) => item.id === Number(matchId));
    if (!match || match.home_score === null || match.away_score === null) continue;

    const windowStart = record.endMinute - LATE_WINDOW_MINUTES;
    let homeBefore = 0;
    let awayBefore = 0;
    let homeFinal = 0;
    let awayFinal = 0;
    for (const goal of record.goals) {
      if (goal.side === "home") homeFinal += 1;
      else awayFinal += 1;
      if (goal.minute < windowStart) {
        if (goal.side === "home") homeBefore += 1;
        else awayBefore += 1;
      }
    }
    // La chrono ESPN doit coller au score enregistre, sinon le score en base
    // est fictif/desynchronise et la comparaison n'aurait aucun sens.
    if (homeFinal !== match.home_score || awayFinal !== match.away_score) continue;
    // Aucun but n'a change le score dans la fenetre : rien a compter.
    if (homeBefore === match.home_score && awayBefore === match.away_score) continue;

    const beforeWindow: Match = { ...match, home_score: homeBefore, away_score: awayBefore };
    const matchPredictions = predictions.filter((prediction) => prediction.match_id === match.id);
    for (const player of players) {
      const prediction = matchPredictions.find((item) => item.user_id === player.id);
      if (!prediction) continue;
      const before = scorePrediction(prediction, beforeWindow, predictions).total;
      const final = scorePrediction(prediction, match, predictions).total;
      const lost = before - final;
      if (lost > 0) totals.set(player.id, (totals.get(player.id) ?? 0) + lost);
    }
  }

  return players
    .map((player) => ({ user: player, lost: totals.get(player.id) ?? 0 }))
    .filter((row) => row.lost > 0)
    .sort((a, b) => b.lost - a.lost || a.user.display_name.localeCompare(b.user.display_name));
}
