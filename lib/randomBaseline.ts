import fs from "node:fs";
import path from "node:path";
import { getMatches, getPredictions, getUsers } from "@/lib/db";
import { scorePrediction } from "@/lib/scoring";
import { teamName } from "@/lib/teams";
import type { Prediction } from "@/lib/types";

type RandomDistribution = {
  seed: number;
  simulations: number;
  source: {
    description: string;
    matches: number;
    start: string;
    end: string;
    tournaments: number;
    top_tournaments: Record<string, number>;
  };
  scorelines: Array<{ home: number; away: number; count: number }>;
};

export const randomBaselineNames = ["Hasard bottom 1%", "Hasard bottom 5%", "Hasard top 5%", "Hasard top 1%"];

function distributionPath() {
  return path.join(process.cwd(), "data", "random_score_distribution.json");
}

export function readRandomDistribution(): RandomDistribution | null {
  const file = distributionPath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as RandomDistribution;
}

function randomUnit(seed: number) {
  let value = seed >>> 0;
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function sampleScore(distribution: RandomDistribution, simulation: number, matchId: number) {
  const total = distribution.scorelines.reduce((sum, item) => sum + item.count, 0);
  const target = randomUnit(distribution.seed + simulation * 100003 + matchId * 9176) * total;
  let cumulative = 0;
  for (const item of distribution.scorelines) {
    cumulative += item.count;
    if (target <= cumulative) return item;
  }
  return distribution.scorelines[distribution.scorelines.length - 1];
}

function percentile(sortedValues: number[], p: number) {
  if (!sortedValues.length) return 0;
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor(p * (sortedValues.length - 1))));
  return sortedValues[index];
}

export function randomBaselineTimeline() {
  const distribution = readRandomDistribution();
  if (!distribution) return [];

  const matches = getMatches().filter((match) => match.status === "finished");
  const predictions = getPredictions();
  const eligibleOddsUsers = new Set(getUsers().filter((user) => !user.is_system).map((user) => user.id));
  const totals = Array.from({ length: distribution.simulations }, () => 0);

  return matches.map((match) => {
    for (let simulation = 0; simulation < distribution.simulations; simulation += 1) {
      const score = sampleScore(distribution, simulation, match.id);
      const prediction: Prediction = {
        id: -simulation - 1,
        user_id: -simulation - 1,
        match_id: match.id,
        home_score: score.home,
        away_score: score.away,
        updated_at: ""
      };
      totals[simulation] += scorePrediction(prediction, match, predictions, eligibleOddsUsers).total;
    }

    const sorted = [...totals].sort((a, b) => a - b);
    return {
      match: `${match.match_no}. ${teamName(match.home_team)}-${teamName(match.away_team)}`,
      "Hasard bottom 1%": percentile(sorted, 0.01),
      "Hasard bottom 5%": percentile(sorted, 0.05),
      "Hasard top 5%": percentile(sorted, 0.95),
      "Hasard top 1%": percentile(sorted, 0.99)
    };
  });
}
