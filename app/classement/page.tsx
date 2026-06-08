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
            <h2>Tout le monde l’a vu</h2>
            <div className="insight-list">
              {impact.collectiveHits.length ? impact.collectiveHits.map((row) => (
                <article className="insight-item" key={row.match.id}>
                  <MatchLabel match={row.match} />
                  <strong>{row.scores.length}/{row.scores.length} avec des points</strong>
                  <p className="muted">
                    Résultat {row.match.home_score}-{row.match.away_score}, moyenne {row.average.toFixed(1)} pts, {row.exactCount} score(s) exact(s).
                  </p>
                </article>
              )) : <p className="muted">Aucun sans-faute collectif pour l’instant.</p>}
            </div>
          </div>
          <div className="panel">
            <h2>Naufrages collectifs</h2>
            <div className="insight-list">
              {impact.collectiveMisses.length ? impact.collectiveMisses.map((row) => (
                <article className="insight-item" key={row.match.id}>
                  <MatchLabel match={row.match} />
                  <strong>0 point pour tout le monde</strong>
                  <p className="muted">
                    Résultat {row.match.home_score}-{row.match.away_score}. Personne n’a trouvé le bon sens du match.
                  </p>
                </article>
              )) : <p className="muted">Aucun raté général pour l’instant.</p>}
            </div>
          </div>
          <div className="panel">
            <h2>Contre les books</h2>
            <div className="insight-list">
              {impact.bookmakerUpsets.length ? impact.bookmakerUpsets.map((row) => (
                <article className="insight-item" key={row.match.id}>
                  <MatchLabel match={row.match} />
                  <strong>{row.bookmakerActual?.label} coté x{row.bookmakerActual?.odds.toFixed(2)}</strong>
                  <p className="muted">
                    Trouvé par {row.outcomeHits.map((item) => item.user.display_name).join(", ")} malgré une proba books de {Math.round((row.bookmakerActual?.probability ?? 0) * 100)}%.
                  </p>
                </article>
              )) : <p className="muted">Aucun gros contrepied coté pour l’instant.</p>}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
