import fs from "node:fs";
import path from "node:path";

export type BookmakerMarket = {
  match_id: number;
  match_no: number;
  home_team: string;
  away_team: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  home_implied_prob: number;
  draw_implied_prob: number;
  away_implied_prob: number;
  samples: number;
  bookmaker_count_avg: number;
  sources: string[];
  source_files: string[];
  fetched_at: string;
};

export type BookmakerPick = {
  outcome: "H" | "D" | "A";
  home_score: number;
  away_score: number;
};

type BookmakerOddsReport = {
  generated_on: string;
  description: string;
  matches: BookmakerMarket[];
};

function oddsPath() {
  return path.join(process.cwd(), "data", "bookmaker_odds.json");
}

export function readBookmakerOdds(): BookmakerOddsReport | null {
  const file = oddsPath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as BookmakerOddsReport;
}

export function bookmakerOddsByMatchId() {
  const report = readBookmakerOdds();
  return new Map((report?.matches ?? []).map((market) => [market.match_id, market]));
}

export function bookmakerPickForMarket(market: BookmakerMarket): BookmakerPick {
  const drawUplift = 1.25;
  const drawNearFavoriteThreshold = 0.75;
  const favoriteProbability = Math.max(market.home_implied_prob, market.away_implied_prob);
  const outsiderProbability = Math.min(market.home_implied_prob, market.away_implied_prob);
  const favoriteEdge = favoriteProbability - outsiderProbability;
  const outcome = market.draw_implied_prob * drawUplift >= favoriteProbability * drawNearFavoriteThreshold
    ? "D"
    : market.home_implied_prob >= market.away_implied_prob
      ? "H"
      : "A";

  if (outcome === "H") {
    if (market.home_implied_prob >= 0.72 && market.away_implied_prob <= 0.12) return { outcome, home_score: 3, away_score: 0 };
    if (market.home_implied_prob >= 0.62 && market.away_implied_prob <= 0.22) return { outcome, home_score: 2, away_score: 0 };
    if (market.home_implied_prob >= 0.54 && market.away_implied_prob >= 0.18) return { outcome, home_score: 2, away_score: 1 };
    return { outcome, home_score: 1, away_score: 0 };
  }
  if (outcome === "A") {
    if (market.away_implied_prob >= 0.72 && market.home_implied_prob <= 0.12) return { outcome, home_score: 0, away_score: 3 };
    if (market.away_implied_prob >= 0.62 && market.home_implied_prob <= 0.22) return { outcome, home_score: 0, away_score: 2 };
    if (market.away_implied_prob >= 0.54 && market.home_implied_prob >= 0.18) return { outcome, home_score: 1, away_score: 2 };
    return { outcome, home_score: 0, away_score: 1 };
  }
  if (market.draw_implied_prob >= 0.31 && favoriteEdge <= 0.14) return { outcome, home_score: 0, away_score: 0 };
  if (market.draw_implied_prob <= 0.285 && favoriteProbability <= 0.39) return { outcome, home_score: 2, away_score: 2 };
  return { outcome, home_score: 1, away_score: 1 };
}
