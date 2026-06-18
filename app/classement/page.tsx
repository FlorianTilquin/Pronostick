import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { Check, Crown, Trophy } from "lucide-react";
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
  const leaderScore = rows[0]?.total ?? 0;
  const rankedRows = rows.map((row, index) => ({
    ...row,
    rank: index > 0 && row.total === rows[index - 1].total
      ? rows.slice(0, index).findIndex((candidate) => candidate.total === row.total) + 1
      : index + 1,
  }));
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
      <section className="leaderboard-panel">
        <div className="leaderboard-heading">
          <div>
            <span className="leaderboard-kicker"><Trophy size={14} /> Classement général</span>
            <h2>La course est lancée</h2>
          </div>
          <span className="leaderboard-match-count">{finished} résultat{finished > 1 ? "s" : ""}</span>
        </div>
        <div className="leaderboard-list">
          {rankedRows.map((row) => {
            const progress = leaderScore > 0 ? Math.max(3, (row.total / leaderScore) * 100) : 0;
            return (
              <article className={`leaderboard-row rank-${Math.min(row.rank, 4)}`} key={row.user.id}>
                <div className="leaderboard-rank" aria-label={`Rang ${row.rank}`}>
                  {row.rank === 1 ? <Crown size={20} /> : row.rank}
                </div>
                <div className="leaderboard-player">
                  <div className="leaderboard-player-line">
                    <strong>{row.user.display_name}</strong>
                    {row.user.is_system ? <span className="leaderboard-tag">Modèle</span> : null}
                  </div>
                  <div className="leaderboard-progress" aria-hidden="true">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="leaderboard-meta">
                    <span>{row.predictions} pronostic{row.predictions > 1 ? "s" : ""}</span>
                    <span className={row.submitted ? "submitted" : ""}>
                      {row.submitted ? <Check size={12} /> : null}
                      {row.submitted ? "Validé" : "Brouillon"}
                    </span>
                  </div>
                </div>
                <div className="leaderboard-score">
                  <strong>{row.total}</strong>
                  <span>pts</span>
                </div>
              </article>
            );
          })}
        </div>
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
            <p className="muted">Points perdus à cause de buts inscrits dans les 10 dernières minutes, temps additionnel inclus.</p>
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
            <p className="muted">Points gagnés grâce à des buts inscrits dans les 10 dernières minutes, temps additionnel inclus.</p>
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
