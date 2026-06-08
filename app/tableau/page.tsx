import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { predictionsByMatchForUserVisibility } from "@/lib/scoring";

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Europe/Paris",
    weekday: "short"
  }).format(new Date(value));
}

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
                  .map(({ match, market, bookmakerMarket, predictions }) => (
                    <article className="tableau-match" key={match.id}>
                      <div className="tableau-main">
                        <div className="tableau-meta">
                          <span className="match-no">#{match.match_no}</span>
                          <time dateTime={match.kickoff_at}>{formatKickoff(match.kickoff_at)}</time>
                        </div>
                        <div className="tableau-fixture">
                          <TeamName team={match.home_team} />
                          <span className="score real-score">{match.home_score === null ? "à venir" : `${match.home_score}-${match.away_score}`}</span>
                          <TeamName team={match.away_team} align="right" />
                        </div>
                        {market || bookmakerMarket ? (
                          <div className="markets-stack">
                            {market ? (
                              <div className="market-row" aria-label="Cotes basées sur les pronostics humains">
                                <span className="market-label">Amis</span>
                                {market.map((item) => (
                                  <span className="market-pill" key={item.outcome}>
                                    <strong>{item.label}</strong>
                                    <span>{item.odds ? `x${item.odds.toFixed(1)}` : "x-"}</span>
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {bookmakerMarket ? (
                              <div className="market-row bookmaker-row" aria-label="Cotes moyennes des bookmakers">
                                <span className="market-label">Books</span>
                                {bookmakerMarket.map((item) => (
                                  <span className="market-pill bookmaker-pill" key={item.outcome}>
                                    <strong>{item.label}</strong>
                                    <span>x{item.odds.toFixed(2)}</span>
                                  </span>
                                ))}
                              </div>
                            ) : null}
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
