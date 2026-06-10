import fs from "node:fs";
import path from "node:path";

export type AppConfig = {
  competition: {
    name: string;
    timezone: string;
    predictionLockMinutesBeforeKickoff: number;
  };
  initialUsers: Array<{
    username: string;
    displayName: string;
    password: string;
    role: "admin" | "player";
  }>;
  scoring: {
    exactScore: number;
    correctOutcome: number;
    correctGoalDifference: number;
    correctTeamGoals: number;
    maxGoalDistancePenalty: number;
    oddsBonus: {
      enabled: boolean;
      maxBonus: number;
      minBonus: number;
      basis: "outcome";
    };
    specials: {
      topScorer: number;
      bestDefense: number;
      bestAttack: number;
      firstTeamCriticizedByTrump?: number;
      messiOrRonaldoFewestGoals?: number;
    };
  };
  groups: Array<{ name: string; teams: string[] }>;
};

// Cache avec re-verification du mtime au plus une fois par seconde :
// readConfig est appele dans des boucles chaudes (simulation hasard, classement),
// mais une edition de data/config.json reste prise en compte sans redemarrage.
let cache: { config: AppConfig; mtimeMs: number; checkedAt: number } | null = null;

export function readConfig(): AppConfig {
  const now = Date.now();
  if (cache && now - cache.checkedAt < 1000) return cache.config;
  const file = path.join(process.cwd(), "data", "config.json");
  const { mtimeMs } = fs.statSync(file);
  if (cache && cache.mtimeMs === mtimeMs) {
    cache.checkedAt = now;
    return cache.config;
  }
  const config = JSON.parse(fs.readFileSync(file, "utf8")) as AppConfig;
  cache = { config, mtimeMs, checkedAt: now };
  return config;
}
