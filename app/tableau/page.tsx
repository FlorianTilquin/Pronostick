import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { predictionsByMatchForUserVisibility } from "@/lib/scoring";

export default async function TableauPage() {
  const user = await requireUser();
  const rows = predictionsByMatchForUserVisibility(user);
  const groups = Array.from(new Set(rows.map((row) => row.match.group_name)));
  const players = rows[0]?.predictions.map(({ user: player }) => player) ?? [];

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Comparaison</p>
          <h1>Tableau des pronos</h1>
          <p className="muted">Les autres pronostics se dévoilent quand tu as soumis tous les tiens.</p>
        </div>
      </div>
      <section className="panel">
        <div className="tableau-groups">
          {groups.map((group) => (
            <section className="tableau-group" key={group}>
              <h2>Groupe {group}</h2>
              <div className="tableau-list">
                {rows
                  .filter(({ match }) => match.group_name === group)
                  .map(({ match, market, predictions }) => (
                    <article className="tableau-match" key={match.id}>
                      <div className="tableau-main">
                        <div className="tableau-fixture">
                          <span className="match-no">#{match.match_no}</span>
                          <TeamName team={match.home_team} />
                          <span className="score real-score">{match.home_score === null ? "à venir" : `${match.home_score}-${match.away_score}`}</span>
                          <TeamName team={match.away_team} align="right" />
                        </div>
                        {market ? (
                          <div className="market-row" aria-label="Probabilités basées sur les pronostics humains">
                            {market.map((item) => (
                              <span className="market-pill" key={item.outcome}>
                                <strong>{item.label}</strong>
                                <span>{Math.round(item.probability * 100)}%</span>
                                <small>{item.odds ? `x${item.odds.toFixed(1)}` : "x-"} · {item.count}</small>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="tableau-predictions" style={{ ["--player-count" as string]: players.length }}>
                        {predictions.map(({ user: player, prediction, hidden }) => (
                          <div className="prediction-cell" key={player.id}>
                            <span>{player.display_name}</span>
                            <strong>{hidden ? "Masqué" : prediction ? `${prediction.home_score}-${prediction.away_score}` : "Non rempli"}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
