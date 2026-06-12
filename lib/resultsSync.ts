import type { Match } from "@/lib/types";
import { getMatches, updateMatchResult } from "@/lib/db";

// Source publique sans cle : scoreboard ESPN de la Coupe du Monde.
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let lastAttemptAt = 0;

// ESPN nomme certaines equipes differemment du calendrier FIFA utilise en base.
const espnAliases: Record<string, string> = {
  "south korea": "korea republic",
  "bosnia herzegovina": "bosnia and herzegovina",
  "czech republic": "czechia",
  "cote divoire": "ivory coast",
  "cabo verde islands": "cape verde",
  "cabo verde": "cape verde",
  "congo dr": "dr congo",
  "democratic republic of the congo": "dr congo",
  usa: "united states",
};

export function normalizeTeam(name: string) {
  const flat = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return espnAliases[flat] ?? flat;
}

type EspnEvent = {
  date: string;
  status?: { type?: { completed?: boolean } };
  competitions?: Array<{
    competitors?: Array<{
      score?: string;
      team?: { name?: string; displayName?: string };
    }>;
  }>;
};

function pendingMatches(matches: Match[], now: number) {
  return matches.filter(
    (match) =>
      Date.parse(match.kickoff_at) <= now && (match.home_score === null || match.away_score === null)
  );
}

function utcDay(iso: string) {
  return iso.slice(0, 10).replaceAll("-", "");
}

async function fetchEvents(days: string[]): Promise<EspnEvent[]> {
  const range = days.length > 1 ? `${days[0]}-${days[days.length - 1]}` : days[0];
  const response = await fetch(`${ESPN_SCOREBOARD}?dates=${range}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`ESPN scoreboard HTTP ${response.status}`);
  const payload = (await response.json()) as { events?: EspnEvent[] };
  return payload.events ?? [];
}

function applyEvent(event: EspnEvent, pending: Match[]) {
  if (!event.status?.type?.completed) return;
  const competitors = event.competitions?.[0]?.competitors ?? [];
  if (competitors.length !== 2) return;

  const scores = new Map<string, number>();
  for (const competitor of competitors) {
    const name = competitor.team?.name ?? competitor.team?.displayName;
    const score = Number(competitor.score);
    if (!name || !Number.isFinite(score)) return;
    scores.set(normalizeTeam(name), score);
  }

  // Apparie par paire d'equipes, peu importe qui ESPN declare a domicile.
  const match = pending.find(
    (item) => scores.has(normalizeTeam(item.home_team)) && scores.has(normalizeTeam(item.away_team))
  );
  if (!match) return;

  const homeScore = scores.get(normalizeTeam(match.home_team));
  const awayScore = scores.get(normalizeTeam(match.away_team));
  if (homeScore === undefined || awayScore === undefined) return;

  updateMatchResult(match.id, homeScore, awayScore);
  console.info(`[resultsSync] Match #${match.match_no} ${match.home_team} ${homeScore}-${awayScore} ${match.away_team}`);
}

// Recupere les resultats manquants des matchs deja joues ou en cours.
// Ne fait rien tant qu'aucun coup d'envoi n'est passe, n'ecrase jamais un
// score existant et n'echoue jamais (les erreurs reseau sont avalees).
export async function maybeSyncResults() {
  try {
    const now = Date.now();
    if (now - lastAttemptAt < SYNC_COOLDOWN_MS) return;
    const pending = pendingMatches(getMatches(), now);
    if (!pending.length) return;
    lastAttemptAt = now;

    const days = [...new Set(pending.map((match) => utcDay(match.kickoff_at)))].sort();
    const events = await fetchEvents(days);
    for (const event of events) {
      applyEvent(event, pending);
    }
  } catch (error) {
    console.warn("[resultsSync] echec de la synchronisation:", error);
  }
}
