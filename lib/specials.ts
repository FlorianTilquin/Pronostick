import type { SpecialCategory } from "@/lib/types";

export const specialBets: Array<{ category: SpecialCategory; label: string }> = [
  { category: "topScorer", label: "Meilleur buteur" },
  { category: "bestDefense", label: "Meilleure défense" },
  { category: "bestAttack", label: "Meilleure attaque" },
  { category: "firstTeamCriticizedByTrump", label: "1e équipe critiquée par Trump" },
  { category: "messiOrRonaldoFewestGoals", label: "Qui de Messi ou de CR7 met le moins de buts" }
];
