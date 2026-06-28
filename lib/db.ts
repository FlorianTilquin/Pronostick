import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { bookmakerPickForMarket, readBookmakerOdds } from "@/lib/bookmakerOdds";
import { readConfig } from "@/lib/config";
import { readMatchSchedule } from "@/lib/matchSchedule";
import { readModelReport } from "@/lib/model";
import {
  blankKnockoutMatch,
  isThirdPlaceSource,
  knockoutTemplates,
  matchTeamsKnown,
  roundOrder,
  sourceCandidates,
  stageMultipliers,
  type KnockoutSeed,
  type ThirdPlaceAssignment,
} from "@/lib/knockout";
import type { Match, Prediction, PredictionRoundId, Role, SpecialCategory, User } from "@/lib/types";

type DbUser = User & { password_hash: string; created_at: string };

type Store = {
  users: DbUser[];
  matches: Match[];
  predictions: Prediction[];
  submissions: Array<{ user_id: number; round_id?: PredictionRoundId; submitted_at: string }>;
  active_round_id?: PredictionRoundId;
  knockout_seeds?: KnockoutSeed[];
  third_place_assignments?: ThirdPlaceAssignment[];
  special_predictions: Array<{ id: number; user_id: number; category: SpecialCategory; value: string; updated_at: string }>;
  special_results: Array<{ category: SpecialCategory; value: string }>;
  counters: {
    users: number;
    matches: number;
    predictions: number;
    special_predictions: number;
  };
};

function storePath() {
  return process.env.STORE_PATH ?? path.join(process.cwd(), "data", "pronostick.json");
}

function now() {
  return new Date().toISOString();
}

function normalizeStore(store: Store) {
  let changed = false;
  if (!store.active_round_id) {
    store.active_round_id = "group";
    changed = true;
  }
  if (!store.knockout_seeds) {
    store.knockout_seeds = [];
    changed = true;
  }
  if (!store.third_place_assignments) {
    store.third_place_assignments = [];
    changed = true;
  }
  for (const submission of store.submissions) {
    if (!submission.round_id) {
      submission.round_id = "group";
      changed = true;
    }
  }
  for (const match of store.matches) {
    if (!match.stage) {
      match.stage = "group";
      changed = true;
    }
    if (!match.prediction_round_id) {
      match.prediction_round_id = match.stage;
      changed = true;
    }
    const multiplier = stageMultipliers[match.stage];
    if (!match.points_multiplier || match.points_multiplier !== multiplier) {
      match.points_multiplier = multiplier;
      changed = true;
    }
    if (match.stage === "group" && match.winner_team === undefined) {
      match.winner_team = null;
      changed = true;
    }
  }
  for (const template of knockoutTemplates) {
    const existing = store.matches.find((match) => match.match_no === template.match_no);
    if (!existing) {
      store.matches.push(blankKnockoutMatch(template));
      store.counters.matches = Math.max(store.counters.matches, template.match_no);
      changed = true;
    } else {
      const patch = blankKnockoutMatch(template);
      for (const key of ["stage", "prediction_round_id", "points_multiplier", "home_source", "away_source", "group_name", "venue", "kickoff_at"] as const) {
        if (existing[key] !== patch[key]) {
          existing[key] = patch[key] as never;
          changed = true;
        }
      }
      if (existing.winner_team === undefined) {
        existing.winner_team = null;
        changed = true;
      }
    }
  }
  return changed;
}

function sourceFromAssignment(store: Store, matchNo: number, side: "home" | "away") {
  return store.third_place_assignments?.find((item) => item.match_no === matchNo && item.side === side)?.source;
}

function seedTeam(store: Store, source: string) {
  return store.knockout_seeds?.find((seed) => seed.source === source)?.team ?? "";
}

function resolveKnockoutSource(store: Store, match: Match, side: "home" | "away", source?: string) {
  if (!source) return "";
  if (isThirdPlaceSource(source)) {
    const assigned = sourceFromAssignment(store, match.match_no, side);
    return assigned ? seedTeam(store, assigned) : "";
  }
  const seed = source.match(/^([123])([A-L])$/);
  if (seed) return seedTeam(store, `${seed[1]}${seed[2]}`);
  const previous = source.match(/^([WL])(\d+)$/);
  if (!previous) return "";
  const previousMatch = store.matches.find((item) => item.match_no === Number(previous[2]));
  if (!previousMatch?.winner_team || !previousMatch.home_team || !previousMatch.away_team) return "";
  if (previous[1] === "W") return previousMatch.winner_team;
  return previousMatch.winner_team === previousMatch.home_team ? previousMatch.away_team : previousMatch.home_team;
}

function refreshKnockoutFixtures(store: Store) {
  let changed = false;
  for (const match of store.matches) {
    if (match.stage === "group") continue;
    const home = resolveKnockoutSource(store, match, "home", match.home_source);
    const away = resolveKnockoutSource(store, match, "away", match.away_source);
    if (match.home_team !== home) {
      match.home_team = home;
      changed = true;
    }
    if (match.away_team !== away) {
      match.away_team = away;
      changed = true;
    }
    if (match.winner_team && match.winner_team !== home && match.winner_team !== away) {
      match.winner_team = null;
      changed = true;
    }
  }
  return changed;
}

type SystemSync = {
  username: string;
  display_name: string;
  system_type: NonNullable<User["system_type"]>;
  generated_on: string;
  predictions: Array<{ match_id: number; home_score: number; away_score: number }>;
  // Supprime les pronostics du compte systeme qui ne sont plus couverts par la source.
  removeStale?: boolean;
};

function syncSystemUser(store: Store, sync: SystemSync) {
  let changed = false;
  let user = store.users.find((item) => item.username === sync.username);
  if (!user) {
    store.counters.users += 1;
    user = {
      id: store.counters.users,
      username: sync.username,
      display_name: sync.display_name,
      role: "player",
      is_system: true,
      system_type: sync.system_type,
      password_hash: bcrypt.hashSync(`disabled-${sync.username}-${sync.generated_on}`, 10),
      created_at: sync.generated_on
    };
    store.users.push(user);
    changed = true;
  } else {
    if (user.display_name !== sync.display_name) {
      user.display_name = sync.display_name;
      changed = true;
    }
    if (user.role !== "player") {
      user.role = "player";
      changed = true;
    }
    if (!user.is_system || user.system_type !== sync.system_type) {
      user.is_system = true;
      user.system_type = sync.system_type;
      changed = true;
    }
  }
  const userId = user.id;

  if (sync.removeStale) {
    const coveredMatchIds = new Set(sync.predictions.map((item) => item.match_id));
    const stalePredictionCount = store.predictions.length;
    store.predictions = store.predictions.filter((prediction) => prediction.user_id !== userId || coveredMatchIds.has(prediction.match_id));
    if (store.predictions.length !== stalePredictionCount) {
      changed = true;
    }
  }

  for (const item of sync.predictions) {
    const existing = store.predictions.find((prediction) => prediction.user_id === userId && prediction.match_id === item.match_id);
    if (existing) {
      if (existing.home_score !== item.home_score || existing.away_score !== item.away_score) {
        existing.home_score = item.home_score;
        existing.away_score = item.away_score;
        existing.updated_at = sync.generated_on;
        changed = true;
      }
    } else {
      store.counters.predictions += 1;
      store.predictions.push({
        id: store.counters.predictions,
        user_id: userId,
        match_id: item.match_id,
        home_score: item.home_score,
        away_score: item.away_score,
        updated_at: sync.generated_on
      });
      changed = true;
    }
  }

  if (!store.submissions.some((item) => item.user_id === userId)) {
    store.submissions.push({ user_id: userId, submitted_at: sync.generated_on });
    changed = true;
  }

  return changed;
}

function syncSystemModel(store: Store) {
  const model = readModelReport();
  if (!model) return false;
  return syncSystemUser(store, {
    username: model.username,
    display_name: model.display_name,
    system_type: "model",
    generated_on: model.metadata.generated_on,
    predictions: model.matches.map((item) => ({
      match_id: item.match_id,
      home_score: item.prediction_home_score,
      away_score: item.prediction_away_score
    }))
  });
}

function syncSystemBookmaker(store: Store) {
  const report = readBookmakerOdds();
  if (!report) return false;
  return syncSystemUser(store, {
    username: "bookmakers",
    display_name: "Bookmakers",
    system_type: "bookmaker",
    generated_on: report.generated_on,
    removeStale: true,
    predictions: report.matches.map((market) => {
      const pick = bookmakerPickForMarket(market);
      return { match_id: market.match_id, home_score: pick.home_score, away_score: pick.away_score };
    })
  });
}

function syncMatchSchedule(store: Store) {
  const schedule = readMatchSchedule();
  if (!schedule) return false;

  let changed = false;
  for (const item of schedule.matches) {
    const match = store.matches.find((candidate) => candidate.id === item.match_id);
    if (!match) continue;
    const sameFixture = match.home_team === item.home_team && match.away_team === item.away_team;
    if (!sameFixture) continue;
    if (match.kickoff_at !== item.kickoff_at) {
      match.kickoff_at = item.kickoff_at;
      changed = true;
    }
    if (match.venue !== item.venue) {
      match.venue = item.venue;
      changed = true;
    }
  }

  return changed;
}

function initialStore(): Store {
  const cfg = readConfig();
  const users: DbUser[] = cfg.initialUsers.map((user, index) => ({
    id: index + 1,
    username: user.username,
    display_name: user.displayName,
    role: user.role,
    password_hash: bcrypt.hashSync(user.password, 10),
    created_at: now()
  }));

  const matches: Match[] = [];
  let matchNo = 1;
  const baseDate = Date.UTC(2026, 5, 11, 20, 0, 0);
  for (const group of cfg.groups) {
    const [t1, t2, t3, t4] = group.teams;
    const fixtures = [
      [t1, t2],
      [t3, t4],
      [t1, t3],
      [t4, t2],
      [t4, t1],
      [t2, t3]
    ];
    for (const [home, away] of fixtures) {
      matches.push({
        id: matchNo,
        match_no: matchNo,
        group_name: group.name,
        stage: "group",
        prediction_round_id: "group",
        points_multiplier: 1,
        kickoff_at: new Date(baseDate + (matchNo - 1) * 6 * 60 * 60 * 1000).toISOString(),
        venue: `Groupe ${group.name} - horaire a verifier`,
        home_team: home,
        away_team: away,
        home_score: null,
        away_score: null,
        winner_team: null,
        status: "scheduled"
      });
      matchNo += 1;
    }
  }

  return {
    users,
    matches,
    predictions: [],
    submissions: [],
    active_round_id: "group",
    knockout_seeds: [],
    third_place_assignments: [],
    special_predictions: [],
    special_results: [],
    counters: {
      users: users.length,
      matches: matches.length,
      predictions: 0,
      special_predictions: 0
    }
  };
}

export function readStore(): Store {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const created = initialStore();
    normalizeStore(created);
    syncMatchSchedule(created);
    syncSystemModel(created);
    syncSystemBookmaker(created);
    refreshKnockoutFixtures(created);
    writeStore(created);
    return created;
  }
  const store = JSON.parse(fs.readFileSync(file, "utf8")) as Store;
  const normalized = normalizeStore(store);
  const scheduleChanged = syncMatchSchedule(store);
  const modelChanged = syncSystemModel(store);
  const bookmakerChanged = syncSystemBookmaker(store);
  const knockoutChanged = refreshKnockoutFixtures(store);
  const changed = normalized || scheduleChanged || modelChanged || bookmakerChanged || knockoutChanged;
  if (changed) {
    writeStore(store);
  }
  return store;
}

export function writeStore(store: Store) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, file);
}

export function updateStore<T>(fn: (store: Store) => T) {
  const store = readStore();
  const result = fn(store);
  writeStore(store);
  return result;
}

export function getUserByUsername(username: string) {
  return readStore().users.find((user) => user.username === username);
}

export function getUserById(id: number) {
  const user = readStore().users.find((item) => item.id === id);
  if (!user) return undefined;
  const { password_hash: _passwordHash, created_at: _createdAt, ...safeUser } = user;
  return safeUser;
}

export function getUsers() {
  return readStore().users.map(({ password_hash: _passwordHash, created_at: _createdAt, ...user }) => user);
}

export function getMatches() {
  return [...readStore().matches].sort((a, b) => a.match_no - b.match_no);
}

export function getActiveRoundId() {
  return readStore().active_round_id ?? "group";
}

export function getRoundMatches(roundId = getActiveRoundId()) {
  return getMatches().filter((match) => (match.prediction_round_id ?? match.stage ?? "group") === roundId && (roundId === "group" || matchTeamsKnown(match)));
}

export function getAllRoundMatches(roundId: PredictionRoundId) {
  return getMatches().filter((match) => (match.prediction_round_id ?? match.stage ?? "group") === roundId);
}

export function getAvailableRounds() {
  const matches = getMatches();
  return roundOrder.filter((roundId) => matches.some((match) => (match.prediction_round_id ?? match.stage ?? "group") === roundId && (roundId === "group" || matchTeamsKnown(match))));
}

export function getPredictions(userId?: number) {
  const predictions = readStore().predictions;
  return [...(userId ? predictions.filter((item) => item.user_id === userId) : predictions)].sort((a, b) => a.user_id - b.user_id || a.match_id - b.match_id);
}

export function getSpecialPredictions(userId: number) {
  return readStore().special_predictions.filter((item) => item.user_id === userId);
}

export function hasSubmitted(userId: number, roundId = getActiveRoundId()) {
  return readStore().submissions.some((submission) => submission.user_id === userId && (submission.round_id ?? "group") === roundId);
}

export function getSubmittedUserIds(roundId = getActiveRoundId()) {
  return new Set(readStore().submissions.filter((row) => (row.round_id ?? "group") === roundId).map((row) => row.user_id));
}

export function addUser(username: string, displayName: string, password: string, role: Role = "player") {
  updateStore((store) => {
    if (store.users.some((user) => user.username === username)) return;
    store.counters.users += 1;
    store.users.push({
      id: store.counters.users,
      username,
      display_name: displayName,
      role,
      password_hash: bcrypt.hashSync(password, 10),
      created_at: now()
    });
  });
}

export function changeUserPassword(userId: number, password: string) {
  updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user || user.is_system) return;
    user.password_hash = bcrypt.hashSync(password, 10);
  });
}

export function updateUserDisplayName(userId: number, displayName: string) {
  updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user || user.is_system) return;
    user.display_name = displayName;
  });
}

export function updateUserDisplayColor(userId: number, color: string) {
  updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user || user.role !== "player") return;
    user.display_color = color;
  });
}

export function deleteUser(userId: number) {
  updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (!user || user.is_system) return;
    const adminCount = store.users.filter((item) => item.role === "admin").length;
    if (user.role === "admin" && adminCount <= 1) return;

    store.users = store.users.filter((item) => item.id !== userId);
    store.predictions = store.predictions.filter((item) => item.user_id !== userId);
    store.submissions = store.submissions.filter((item) => item.user_id !== userId);
    store.special_predictions = store.special_predictions.filter((item) => item.user_id !== userId);
  });
}

export function upsertPrediction(userId: number, matchId: number, homeScore: number, awayScore: number) {
  updateStore((store) => {
    const existing = store.predictions.find((item) => item.user_id === userId && item.match_id === matchId);
    if (existing) {
      existing.home_score = homeScore;
      existing.away_score = awayScore;
      existing.updated_at = now();
      return;
    }
    store.counters.predictions += 1;
    store.predictions.push({
      id: store.counters.predictions,
      user_id: userId,
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
      updated_at: now()
    });
  });
}

export function upsertSpecialPrediction(userId: number, category: SpecialCategory, value: string) {
  updateStore((store) => {
    const existing = store.special_predictions.find((item) => item.user_id === userId && item.category === category);
    if (existing) {
      existing.value = value;
      existing.updated_at = now();
      return;
    }
    store.counters.special_predictions += 1;
    store.special_predictions.push({ id: store.counters.special_predictions, user_id: userId, category, value, updated_at: now() });
  });
}

export function submitUser(userId: number, roundId = getActiveRoundId()) {
  updateStore((store) => {
    if (!store.submissions.some((item) => item.user_id === userId && (item.round_id ?? "group") === roundId)) {
      store.submissions.push({ user_id: userId, round_id: roundId, submitted_at: now() });
    }
  });
}

export function updateMatchResult(matchId: number, homeScore: number | null, awayScore: number | null, winnerTeam?: string | null) {
  updateStore((store) => {
    const match = store.matches.find((item) => item.id === matchId);
    if (!match) return;
    match.home_score = homeScore;
    match.away_score = awayScore;
    match.status = homeScore === null || awayScore === null ? "scheduled" : "finished";
    if (match.status === "scheduled") {
      match.winner_team = null;
    } else if (match.stage && match.stage !== "group") {
      if (homeScore !== null && awayScore !== null && homeScore > awayScore) match.winner_team = match.home_team;
      else if (homeScore !== null && awayScore !== null && awayScore > homeScore) match.winner_team = match.away_team;
      else if (winnerTeam && (winnerTeam === match.home_team || winnerTeam === match.away_team)) match.winner_team = winnerTeam;
    }
    refreshKnockoutFixtures(store);
  });
}

export function getKnockoutSeeds() {
  return [...(readStore().knockout_seeds ?? [])].sort((a, b) => a.source.localeCompare(b.source));
}

export function getThirdPlaceAssignments() {
  return [...(readStore().third_place_assignments ?? [])].sort((a, b) => a.match_no - b.match_no || a.side.localeCompare(b.side));
}

export function setKnockoutSeed(source: string, team: string) {
  updateStore((store) => {
    const match = source.match(/^([123])([A-L])$/);
    if (!match) return;
    const rank = Number(match[1]) as 1 | 2 | 3;
    const group = match[2]!;
    const existing = store.knockout_seeds?.find((item) => item.source === source);
    if (!store.knockout_seeds) store.knockout_seeds = [];
    if (!team) {
      store.knockout_seeds = store.knockout_seeds.filter((item) => item.source !== source);
    } else if (existing) {
      existing.team = team;
    } else {
      store.knockout_seeds.push({ source, group, rank, team });
    }
    refreshKnockoutFixtures(store);
  });
}

export function setThirdPlaceAssignment(matchNo: number, side: "home" | "away", source: string) {
  updateStore((store) => {
    const match = store.matches.find((item) => item.match_no === matchNo);
    const templateSource = side === "home" ? match?.home_source : match?.away_source;
    if (!match || !templateSource || !isThirdPlaceSource(templateSource)) return;
    const candidates = sourceCandidates(templateSource).map((group) => `3${group}`);
    if (source && !candidates.includes(source)) return;
    if (!store.third_place_assignments) store.third_place_assignments = [];
    store.third_place_assignments = store.third_place_assignments.filter((item) => !(item.match_no === matchNo && item.side === side));
    if (source) store.third_place_assignments.push({ match_no: matchNo, side, source });
    refreshKnockoutFixtures(store);
  });
}

export function setActiveRound(roundId: PredictionRoundId) {
  updateStore((store) => {
    if (!roundOrder.includes(roundId)) return;
    store.active_round_id = roundId;
  });
}
