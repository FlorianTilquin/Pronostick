import type { Match, PredictionRoundId, Stage } from "@/lib/types";

export const roundOrder: PredictionRoundId[] = ["group", "round_of_32", "round_of_16", "quarter_final", "semi_final", "third_place", "final"];

export const roundLabels: Record<PredictionRoundId, string> = {
  group: "Groupes",
  round_of_32: "1/16e de finale",
  round_of_16: "1/8e de finale",
  quarter_final: "Quarts",
  semi_final: "Demies",
  third_place: "3e place",
  final: "Finale",
};

export const stageMultipliers: Record<Stage, 1 | 2 | 3> = {
  group: 1,
  round_of_32: 2,
  round_of_16: 2,
  quarter_final: 2,
  semi_final: 2,
  third_place: 3,
  final: 3,
};

export type KnockoutSeed = {
  source: string;
  group: string;
  rank: 1 | 2 | 3;
  team: string;
};

export type ThirdPlaceAssignment = {
  match_no: number;
  side: "home" | "away";
  source: string;
};

type KnockoutTemplate = {
  match_no: number;
  stage: Exclude<Stage, "group">;
  date: string;
  venue: string;
  home_source: string;
  away_source: string;
};

const r32: KnockoutTemplate[] = [
  { match_no: 73, stage: "round_of_32", date: "2026-06-28T16:00:00Z", venue: "NRG Stadium, Houston", home_source: "2A", away_source: "2B" },
  { match_no: 74, stage: "round_of_32", date: "2026-06-28T20:30:00Z", venue: "Lincoln Financial Field, Philadelphia", home_source: "1E", away_source: "3A/B/C/D/F" },
  { match_no: 75, stage: "round_of_32", date: "2026-06-29T19:00:00Z", venue: "AT&T Stadium, Arlington", home_source: "1F", away_source: "2C" },
  { match_no: 76, stage: "round_of_32", date: "2026-06-29T22:00:00Z", venue: "MetLife Stadium, New York/New Jersey", home_source: "1C", away_source: "2F" },
  { match_no: 77, stage: "round_of_32", date: "2026-06-30T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta", home_source: "1I", away_source: "3C/D/F/G/H" },
  { match_no: 78, stage: "round_of_32", date: "2026-06-30T20:30:00Z", venue: "Lumen Field, Seattle", home_source: "2E", away_source: "2I" },
  { match_no: 79, stage: "round_of_32", date: "2026-07-01T19:00:00Z", venue: "Estadio Azteca, Mexico City", home_source: "1A", away_source: "3C/E/F/H/I" },
  { match_no: 80, stage: "round_of_32", date: "2026-07-01T22:00:00Z", venue: "BC Place, Vancouver", home_source: "1L", away_source: "3E/H/I/J/K" },
  { match_no: 81, stage: "round_of_32", date: "2026-07-02T16:00:00Z", venue: "Levi's Stadium, San Francisco Bay Area", home_source: "1D", away_source: "3B/E/F/I/J" },
  { match_no: 82, stage: "round_of_32", date: "2026-07-02T19:00:00Z", venue: "SoFi Stadium, Los Angeles", home_source: "1G", away_source: "3A/E/H/I/J" },
  { match_no: 83, stage: "round_of_32", date: "2026-07-02T22:00:00Z", venue: "Gillette Stadium, Boston", home_source: "2K", away_source: "2L" },
  { match_no: 84, stage: "round_of_32", date: "2026-07-03T00:30:00Z", venue: "Estadio Monterrey, Monterrey", home_source: "1H", away_source: "2J" },
  { match_no: 85, stage: "round_of_32", date: "2026-07-03T16:00:00Z", venue: "BMO Field, Toronto", home_source: "1B", away_source: "3E/F/G/I/J" },
  { match_no: 86, stage: "round_of_32", date: "2026-07-03T22:00:00Z", venue: "Hard Rock Stadium, Miami", home_source: "1J", away_source: "2H" },
  { match_no: 87, stage: "round_of_32", date: "2026-07-04T01:30:00Z", venue: "Arrowhead Stadium, Kansas City", home_source: "1K", away_source: "3D/E/I/J/L" },
  { match_no: 88, stage: "round_of_32", date: "2026-07-03T18:00:00Z", venue: "AT&T Stadium, Arlington", home_source: "2D", away_source: "2G" },
];

const laterRounds: KnockoutTemplate[] = [
  { match_no: 89, stage: "round_of_16", date: "2026-07-04T21:00:00Z", venue: "Lincoln Financial Field, Philadelphia", home_source: "W74", away_source: "W77" },
  { match_no: 90, stage: "round_of_16", date: "2026-07-04T17:00:00Z", venue: "NRG Stadium, Houston", home_source: "W73", away_source: "W75" },
  { match_no: 91, stage: "round_of_16", date: "2026-07-05T20:00:00Z", venue: "MetLife Stadium, New York/New Jersey", home_source: "W76", away_source: "W78" },
  { match_no: 92, stage: "round_of_16", date: "2026-07-06T00:00:00Z", venue: "Estadio Azteca, Mexico City", home_source: "W79", away_source: "W80" },
  { match_no: 93, stage: "round_of_16", date: "2026-07-06T19:00:00Z", venue: "AT&T Stadium, Arlington", home_source: "W83", away_source: "W84" },
  { match_no: 94, stage: "round_of_16", date: "2026-07-07T00:00:00Z", venue: "Lumen Field, Seattle", home_source: "W81", away_source: "W82" },
  { match_no: 95, stage: "round_of_16", date: "2026-07-07T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta", home_source: "W86", away_source: "W88" },
  { match_no: 96, stage: "round_of_16", date: "2026-07-07T20:00:00Z", venue: "BC Place, Vancouver", home_source: "W85", away_source: "W87" },
  { match_no: 97, stage: "quarter_final", date: "2026-07-09T19:00:00Z", venue: "Gillette Stadium, Boston", home_source: "W89", away_source: "W90" },
  { match_no: 98, stage: "quarter_final", date: "2026-07-10T19:00:00Z", venue: "SoFi Stadium, Los Angeles", home_source: "W93", away_source: "W94" },
  { match_no: 99, stage: "quarter_final", date: "2026-07-11T16:00:00Z", venue: "Hard Rock Stadium, Miami", home_source: "W91", away_source: "W92" },
  { match_no: 100, stage: "quarter_final", date: "2026-07-11T20:30:00Z", venue: "Arrowhead Stadium, Kansas City", home_source: "W95", away_source: "W96" },
  { match_no: 101, stage: "semi_final", date: "2026-07-14T20:00:00Z", venue: "AT&T Stadium, Arlington", home_source: "W97", away_source: "W98" },
  { match_no: 102, stage: "semi_final", date: "2026-07-15T20:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta", home_source: "W99", away_source: "W100" },
  { match_no: 103, stage: "third_place", date: "2026-07-18T20:00:00Z", venue: "Hard Rock Stadium, Miami", home_source: "L101", away_source: "L102" },
  { match_no: 104, stage: "final", date: "2026-07-19T19:00:00Z", venue: "MetLife Stadium, New York/New Jersey", home_source: "W101", away_source: "W102" },
];

export const knockoutTemplates = [...r32, ...laterRounds];

export function isKnockoutStage(stage: Stage | undefined) {
  return Boolean(stage && stage !== "group");
}

export function sourceCandidates(source: string) {
  const match = source.match(/^3([A-L](?:\/[A-L])+)$/);
  return match ? match[1]!.split("/") : [];
}

export function isThirdPlaceSource(source: string) {
  return sourceCandidates(source).length > 0;
}

export function displaySource(source: string) {
  const exact = source.match(/^([123])([A-L])$/);
  if (exact) return `${exact[1]}${exact[2]}`;
  const winner = source.match(/^W(\d+)$/);
  if (winner) return `Vainqueur #${winner[1]}`;
  const loser = source.match(/^L(\d+)$/);
  if (loser) return `Perdant #${loser[1]}`;
  const candidates = sourceCandidates(source);
  if (candidates.length) return `3e ${candidates.join("/")}`;
  return source;
}

export function blankKnockoutMatch(template: KnockoutTemplate): Match {
  return {
    id: template.match_no,
    match_no: template.match_no,
    group_name: roundLabels[template.stage],
    stage: template.stage,
    prediction_round_id: template.stage,
    points_multiplier: stageMultipliers[template.stage],
    home_source: template.home_source,
    away_source: template.away_source,
    kickoff_at: template.date,
    venue: template.venue,
    home_team: "",
    away_team: "",
    home_score: null,
    away_score: null,
    winner_team: null,
    status: "scheduled",
  };
}

export function matchTeamsKnown(match: Match) {
  return Boolean(match.home_team && match.away_team);
}
