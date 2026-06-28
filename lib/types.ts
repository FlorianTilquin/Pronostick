export type Role = "admin" | "player";

export type Stage = "group" | "round_of_32" | "round_of_16" | "quarter_final" | "semi_final" | "third_place" | "final";

export type PredictionRoundId = Stage;

export type User = {
  id: number;
  username: string;
  display_name: string;
  display_color?: string;
  role: Role;
  is_system?: boolean;
  system_type?: "model" | "bookmaker";
};

export type Match = {
  id: number;
  match_no: number;
  group_name: string;
  stage?: Stage;
  prediction_round_id?: PredictionRoundId;
  points_multiplier?: 1 | 2 | 3;
  home_source?: string;
  away_source?: string;
  kickoff_at: string;
  venue: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  winner_team?: string | null;
  status: "scheduled" | "finished";
};

export type Prediction = {
  id: number;
  user_id: number;
  match_id: number;
  home_score: number;
  away_score: number;
  updated_at: string;
};

export type SpecialCategory = "topScorer" | "bestDefense" | "bestAttack" | "firstTeamCriticizedByTrump" | "messiOrRonaldoFewestGoals";
