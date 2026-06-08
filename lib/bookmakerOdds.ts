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
