import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { bookmakerPickForMarket, readBookmakerOdds } from "@/lib/bookmakerOdds";
import { readConfig } from "@/lib/config";
import { readMatchSchedule } from "@/lib/matchSchedule";
import { readModelReport } from "@/lib/model";
import type { Match, Prediction, Role, SpecialCategory, User } from "@/lib/types";

type DbUser = User & { password_hash: string; created_at: string };

type Store = {
  users: DbUser[];
  matches: Match[];
  predictions: Prediction[];
  submissions: Array<{ user_id: number; submitted_at: string }>;
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
        kickoff_at: new Date(baseDate + (matchNo - 1) * 6 * 60 * 60 * 1000).toISOString(),
        venue: `Groupe ${group.name} - horaire a verifier`,
        home_team: home,
        away_team: away,
        home_score: null,
        away_score: null,
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
    syncMatchSchedule(created);
    syncSystemModel(created);
    syncSystemBookmaker(created);
    writeStore(created);
    return created;
  }
  const store = JSON.parse(fs.readFileSync(file, "utf8")) as Store;
  const scheduleChanged = syncMatchSchedule(store);
  const modelChanged = syncSystemModel(store);
  const bookmakerChanged = syncSystemBookmaker(store);
  const changed = scheduleChanged || modelChanged || bookmakerChanged;
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

export function getPredictions(userId?: number) {
  const predictions = readStore().predictions;
  return [...(userId ? predictions.filter((item) => item.user_id === userId) : predictions)].sort((a, b) => a.user_id - b.user_id || a.match_id - b.match_id);
}

export function getSpecialPredictions(userId: number) {
  return readStore().special_predictions.filter((item) => item.user_id === userId);
}

export function hasSubmitted(userId: number) {
  return readStore().submissions.some((submission) => submission.user_id === userId);
}

export function getSubmittedUserIds() {
  return new Set(readStore().submissions.map((row) => row.user_id));
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

export function submitUser(userId: number) {
  updateStore((store) => {
    if (!store.submissions.some((item) => item.user_id === userId)) {
      store.submissions.push({ user_id: userId, submitted_at: now() });
    }
  });
}

export function updateMatchResult(matchId: number, homeScore: number | null, awayScore: number | null) {
  updateStore((store) => {
    const match = store.matches.find((item) => item.id === matchId);
    if (!match) return;
    match.home_score = homeScore;
    match.away_score = awayScore;
    match.status = homeScore === null || awayScore === null ? "scheduled" : "finished";
  });
}
