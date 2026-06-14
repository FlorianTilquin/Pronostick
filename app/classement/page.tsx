import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { getMatches } from "@/lib/db";
import { maybeSyncResults } from "@/lib/resultsSync";
import { leaderboard, matchImpactStats, outcomeStreaks, teamGoalStats } from "@/lib/scoring";
import { teamName } from "@/lib/teams";
import { lateGoalSwings, maybeSyncTournamentFeed, readTopScorers } from "@/lib/tournamentStats";

function perMatch(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

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
  await maybeSyncResults();
  await maybeSyncTournamentFeed();
  const rows = leaderboard();
  const finished = getMatches().filter((match) => match.status === "finished").length;
  const impact = matchImpactStats();
  const streaks = outcomeStreaks();
  const topStreak = (key: "best" | "current") => {
    const max = Math.max(...streaks.map((row) => row[key]), 0);
    if (max < 2) return null;
    const names = streaks
      .filter((row) => row[key] === max)
      .map((row) => row.user.display_name)
      .join(", ");
    return { names, length: max };
  };
  const bestStreak = topStreak("best");
  const currentStreak = topStreak("current");
  const goalStats = teamGoalStats();
  const scorers = readTopScorers()?.scorers ?? [];
  const topGoals = scorers[0]?.goals ?? 0;
  const topScorers = topGoals > 0 ? scorers.filter((scorer) => scorer.goals === topGoals) : [];
  const { losses: lateLosses, gains: lateGains } = lateGoalSwings();

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
            <h2>Séries de bons pronos</h2>
            <div className="insight-list">
              <article className="insight-item">
                <span className="muted">Record historique</span>
                {bestStreak ? (
                  <strong>{bestStreak.names} avec une série de {bestStreak.length} bons pronos</strong>
                ) : (
                  <p className="muted">Aucune série d’au moins 2 bons pronos pour l’instant.</p>
                )}
              </article>
              <article className="insight-item">
                <span className="muted">Record actuel</span>
                {currentStreak ? (
                  <strong>{currentStreak.names} avec {currentStreak.length} bons pronos</strong>
                ) : (
                  <p className="muted">Aucune série en cours.</p>
                )}
              </article>
            </div>
          </div>
          <div className="panel">
            <h2>Stats du tournoi</h2>
            <div className="insight-list">
              <article className="insight-item">
                <span className="muted">Meilleur buteur</span>
                {topScorers.length ? (
                  <strong>
                    {topScorers.slice(0, 3).map((scorer) => `${scorer.name} (${teamName(scorer.team)})`).join(", ")}
                    {topScorers.length > 3 ? ` et ${topScorers.length - 3} autres` : ""} — {topGoals} but{topGoals > 1 ? "s" : ""}
                  </strong>
                ) : (
                  <p className="muted">Aucun but pour l’instant.</p>
                )}
              </article>
              <article className="insight-item">
                <span className="muted">Meilleure attaque</span>
                {goalStats.attack.length ? (
                  <span className="score-match-label">
                    {goalStats.attack.map((row) => (
                      <TeamName key={row.team} team={row.team} />
                    ))}
                    <strong>{perMatch(goalStats.attack[0].scoredPerMatch)} but(s)/match</strong>
                  </span>
                ) : (
                  <p className="muted">Aucun match terminé.</p>
                )}
              </article>
              <article className="insight-item">
                <span className="muted">Meilleure défense</span>
                {goalStats.defense.length ? (
                  <span className="score-match-label">
                    {goalStats.defense.map((row) => (
                      <TeamName key={row.team} team={row.team} />
                    ))}
                    <strong>{perMatch(goalStats.defense[0].concededPerMatch)} encaissé(s)/match</strong>
                  </span>
                ) : (
                  <p className="muted">Aucun match terminé.</p>
                )}
              </article>
            </div>
          </div>
          <div className="panel">
            <h2>Money time fatal</h2>
            <p className="muted">Points perdus à cause de buts dans les 10 dernières minutes (temps additionnel inclus).</p>
            {lateLosses.length ? (
              <div className="loss-list">
                {lateLosses.map((row) => (
                  <div className="loss-row" key={row.user.id}>
                    <strong>{row.user.display_name}</strong>
                    <span className="loss-pill">−{row.points} pts</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Personne n’a (encore) été puni dans le money time.</p>
            )}
          </div>
          <div className="panel">
            <h2>Money time béni</h2>
            <p className="muted">Points gagnés grâce à des buts dans les 10 dernières minutes (temps additionnel inclus).</p>
            {lateGains.length ? (
              <div className="loss-list">
                {lateGains.map((row) => (
                  <div className="loss-row" key={row.user.id}>
                    <strong>{row.user.display_name}</strong>
                    <span className="gain-pill">+{row.points} pts</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Personne n’a (encore) été sauvé dans le money time.</p>
            )}
          </div>
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
          <div className="panel">
            <h2>Coups solo</h2>
            <div className="insight-list">
              {impact.soloShots.length ? impact.soloShots.map((row) => (
                <article className="insight-item" key={row.match.id}>
                  <MatchLabel match={row.match} />
                  <strong>{row.best[0]?.user.display_name} +{row.topGap.toFixed(1)} vs moyenne</strong>
                  <p className="muted">
                    Prono {row.best[0]?.prediction.home_score}-{row.best[0]?.prediction.away_score}, {row.best[0]?.total ?? 0} pts sur ce match.
                  </p>
                </article>
              )) : <p className="muted">Aucun coup solo pour l’instant.</p>}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
