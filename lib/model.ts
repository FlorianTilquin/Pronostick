import fs from "node:fs";
import path from "node:path";

export type ModelMatch = {
  match_id: number;
  match_no: number;
  group: string;
  date: string;
  city: string;
  country: string;
  neutral: boolean;
  home_team: string;
  away_team: string;
  p_home_win: number;
  p_draw: number;
  p_away_win: number;
  pick: "H" | "D" | "A";
  pick_label: string;
  pick_confidence: number;
  expected_home_goals: number;
  expected_away_goals: number;
  modal_score: string;
  modal_score_probability: number;
  prediction_home_score: number;
  prediction_away_score: number;
};

export type ModelReport = {
  display_name: string;
  username: string;
  metadata: {
    generated_on: string;
    model_metrics: Record<string, number | string | boolean | Record<string, number>>;
    notes: string[];
  };
  matches: ModelMatch[];
  groups: Array<{
    group: string;
    team: string;
    expected_points: number;
    expected_goals_for: number;
    expected_goals_against: number;
    expected_goal_diff: number;
    expected_wins: number;
    expected_draws: number;
    expected_losses: number;
    projected_rank: number;
    projected_status?: string;
  }>;
  qualifiers: Array<{ group: string; rank: number; team: string }>;
};

function modelPath() {
  return path.join(process.cwd(), "data", "model_xgboost.json");
}

export function readModelReport(): ModelReport | null {
  const file = modelPath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as ModelReport;
}
