import fs from "node:fs";
import path from "node:path";

export type ScheduledMatch = {
  match_id: number;
  match_no: number;
  group: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  venue: string;
};

type MatchScheduleReport = {
  source_file: string;
  generated_on: string | null;
  matches: ScheduledMatch[];
};

function schedulePath() {
  return path.join(process.cwd(), "data", "match_schedule.json");
}

export function readMatchSchedule(): MatchScheduleReport | null {
  const file = schedulePath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as MatchScheduleReport;
}
