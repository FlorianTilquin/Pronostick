import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { getMatches } from "@/lib/db";
import { leaderboard, matchImpactStats } from "@/lib/scoring";

function MatchLabel({ match }: { match: { home_team: string; away_team: string; match_no: number } }) {
  return (
    <span className="score-match-label">
      <span className="match-no">#{match.match_no}</span>
      <TeamName team={match.home_team} />
      <span className="muted">-</span>
      <TeamName team={match.away_team} />
    </span>
  );
}

export default async function ClassementPage() {
  const user = await requireUser();
  const rows = leaderboard();
  const finished = getMatches().filter((match) => match.status === "finished").length;
  const impact = matchImpactStats();

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Scores en direct</p>
          <h1>Classement</h1>
          <p className="muted">{finished} match(s) avec résultat saisi.</p>
        </div>
      </div>
      <section className="stat-grid" style={{ marginBottom: 18 }}>
        {rows.map((row, index) => (
          <div className="card stat" key={row.user.id}>
            <span className="muted">#{index + 1}</span>
            <strong>{row.total}</strong>
            <div>{row.user.display_name}</div>
          </div>
        ))}
      </section>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rang</th>
              <th>Joueur</th>
              <th>Points</th>
              <th>Pronos</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.user.id}>
                <td>{index + 1}</td>
                <td>{row.user.display_name}</td>
                <td className="score">{row.total}</td>
                <td>{row.predictions}</td>
                <td>{row.submitted ? "Soumis" : "Brouillon"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {finished ? (
        <section className="score-insights">
          <div className="panel">
            <h2>Matchs qui ont fait l’écart</h2>
            <div className="insight-list">
              {impact.swingMatches.map((row) => (
                <article className="insight-item" key={row.match.id}>
                  <MatchLabel match={row.match} />
                  <strong>Écart {row.spread} pts</strong>
                  <p className="muted">
                    Meilleur score : {row.best.map((item) => item.user.display_name).join(", ")} avec {row.best[0]?.total ?? 0} pts, moyenne {row.average.toFixed(1)}.
                  </p>
                </article>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Coups solo</h2>
            <div className="insight-list">
              {impact.soloShots.map((row) => (
                <article className="insight-item" key={row.match.id}>
                  <MatchLabel match={row.match} />
                  <strong>{row.best[0]?.user.display_name} +{row.topGap.toFixed(1)} vs moyenne</strong>
                  <p className="muted">
                    Prono {row.best[0]?.prediction.home_score}-{row.best[0]?.prediction.away_score}, {row.best[0]?.total ?? 0} pts.
                  </p>
                </article>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Scores exacts flairés</h2>
            <div className="insight-list">
              {impact.exactMatches.length ? impact.exactMatches.map((row) => (
                <article className="insight-item" key={row.match.id}>
                  <MatchLabel match={row.match} />
                  <strong>{row.exactCount} score(s) exact(s)</strong>
                  <p className="muted">
                    Résultat {row.match.home_score}-{row.match.away_score}.
                  </p>
                </article>
              )) : <p className="muted">Aucun score exact pour l’instant.</p>}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
