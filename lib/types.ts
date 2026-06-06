export type Role = "admin" | "player";

export type User = {
  id: number;
  username: string;
  display_name: string;
  role: Role;
};

export type Match = {
  id: number;
  match_no: number;
  group_name: string;
  kickoff_at: string;
  venue: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
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
