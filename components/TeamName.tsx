import { teamInfo } from "@/lib/teams";

export function TeamName({ team, align = "left" }: { team: string; align?: "left" | "right" }) {
  const info = teamInfo(team);
  return (
    <span className={`team-name ${align === "right" ? "right" : ""}`}>
      {info.flagUrl ? (
        <img className="team-flag-img" src={info.flagUrl} alt="" aria-hidden="true" />
      ) : (
        <span className="team-flag" aria-hidden="true">{info.flag}</span>
      )}
      <span>{info.name}</span>
    </span>
  );
}
