import fs from "node:fs";
import path from "node:path";
import { getMatches } from "@/lib/db";
import { normalizeTeam } from "@/lib/resultsSync";

// Meilleurs buteurs agreges depuis le scoreboard public ESPN (sans cle).
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const SYNC_COOLDOWN_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

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

type EspnEvent = {
  status?: { type?: { completed?: boolean } };
  competitions?: Array<{
    competitors?: Array<{ id?: string; team?: { id?: string; name?: string; displayName?: string } }>;
    details?: Array<{
      scoringPlay?: boolean;
      ownGoal?: boolean;
      shootout?: boolean;
      team?: { id?: string };
      athletesInvolved?: Array<{ displayName?: string }>;
    }>;
  }>;
};

function scorersPath() {
  return path.join(process.cwd(), "data", "top_scorers.json");
}

export function readTopScorers(): ScorersFile | null {
  try {
    const file = scorersPath();
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as ScorersFile;
  } catch {
    return null;
  }
}

function utcDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10).replaceAll("-", "");
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

function aggregateScorers(events: EspnEvent[]): Scorer[] {
  const goals = new Map<string, Scorer>();
  for (const event of events) {
    if (!event.status?.type?.completed) continue;
    const competition = event.competitions?.[0];
    const teamsById = new Map<string, string>();
    for (const competitor of competition?.competitors ?? []) {
      const id = competitor.team?.id;
      const name = competitor.team?.name ?? competitor.team?.displayName;
      if (id && name) teamsById.set(id, canonicalTeamName(name));
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

// Rafraichit data/top_scorers.json depuis ESPN, au plus toutes les 30 minutes
// et seulement une fois le tournoi commence. N'echoue jamais.
export async function maybeSyncTopScorers() {
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
    const scorers = aggregateScorers(payload.events ?? []);
    if (!scorers.length) return;

    const file = scorersPath();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ updated_at: new Date(now).toISOString(), scorers }, null, 2));
    fs.renameSync(tmp, file);
  } catch (error) {
    console.warn("[tournamentStats] echec de la synchronisation des buteurs:", error);
  }
}
