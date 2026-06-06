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
    };
  };
  groups: Array<{ name: string; teams: string[] }>;
};

export function readConfig(): AppConfig {
  const file = path.join(process.cwd(), "data", "config.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as AppConfig;
}
