import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ScrollToMatch } from "@/components/ScrollToMatch";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { getActiveRoundId, getAvailableRounds, getSpecialPredictions, getSubmittedUserIds, getUsers } from "@/lib/db";
import { roundLabels, roundOrder } from "@/lib/knockout";
import { maybeSyncResults } from "@/lib/resultsSync";
import { predictionsByMatchForUserVisibility } from "@/lib/scoring";
import { specialBets } from "@/lib/specials";
import type { PredictionRoundId } from "@/lib/types";

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

type TableauPageProps = {
  searchParams?: Promise<{ ordre?: string; round?: string }>;
};

export default async function TableauPage({ searchParams }: TableauPageProps) {
  const user = await requireUser();
  await maybeSyncResults();
  const params = await searchParams;
  const isChronological = params?.ordre !== "groupes";
  const activeRound = getActiveRoundId();
  const availableRounds = getAvailableRounds();
  const requestedRound = params?.round as PredictionRoundId | undefined;
  const selectedRound = requestedRound && roundOrder.includes(requestedRound) ? requestedRound : activeRound;
  const rows = predictionsByMatchForUserVisibility(user, selectedRound);
  const groups = Array.from(new Set(rows.map((row) => row.match.group_name)));
  const chronologicalRows = [...rows].sort((a, b) => Date.parse(a.match.kickoff_at) - Date.parse(b.match.kickoff_at) || a.match.match_no - b.match.match_no);
  const lastPlayedMatch = [...chronologicalRows].reverse().find(({ match }) => match.home_score !== null && match.away_score !== null)?.match ?? null;
  const submitted = getSubmittedUserIds(selectedRound);
  const groupSubmitted = getSubmittedUserIds("group");
  const canSeeSpecials = user.role === "admin" || groupSubmitted.has(user.id);
  const specialPlayers = getUsers().filter((player) => player.role === "player" && !player.is_system);
  const specialRows = specialPlayers.map((player) => {
    const predictions = new Map(getSpecialPredictions(player.id).map((prediction) => [prediction.category, prediction.value]));
    return { player, predictions, submitted: submitted.has(player.id) };
  });

  const renderMatch = ({ match, market, bookmakerMarket, predictions }: (typeof rows)[number]) => (
    <article className="tableau-match" id={`match-${match.id}`} key={match.id}>
      <div className="tableau-main">
        <div className="tableau-meta">
          <span className="match-no">#{match.match_no}</span>
          <span>{match.stage === "group" ? `Groupe ${match.group_name}` : match.group_name}</span>
          <time dateTime={match.kickoff_at}>{formatKickoff(match.kickoff_at)}</time>
        </div>
        <p className="tableau-venue">{match.venue}</p>
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
      <div className="tableau-predictions">
        {predictions.map(({ user: player, prediction, hidden }) => (
          <div className="prediction-cell" key={player.id}>
            <span>{player.display_name}</span>
            <strong>{hidden ? "Masqué" : prediction ? `${prediction.home_score}-${prediction.away_score}` : "Non rempli"}</strong>
          </div>
        ))}
      </div>
    </article>
  );

  return (
    <AppShell user={user}>
      <ScrollToMatch matchId={lastPlayedMatch?.id ?? null} />
      <div className="topline">
        <div>
          <p className="eyebrow">Comparaison · {roundLabels[selectedRound]}</p>
          <h1>Tableau des pronos</h1>
          <p className="muted">Par défaut, le tableau reste sur le round actif pour éviter les kilomètres de scroll.</p>
        </div>
      </div>
      <section className="panel">
        <div className="tableau-toolbar">
          <span>Affichage</span>
          <nav className="view-switch" aria-label="Ordre d'affichage du tableau">
            <Link className={`view-switch-item ${isChronological ? "active" : ""}`} href={`/tableau?round=${selectedRound}`} aria-current={isChronological ? "page" : undefined}>
              Chronologique
            </Link>
            <Link className={`view-switch-item ${!isChronological ? "active" : ""}`} href={`/tableau?round=${selectedRound}&ordre=groupes`} aria-current={!isChronological ? "page" : undefined}>
              Groupes
            </Link>
          </nav>
        </div>
        <nav className="round-switch" aria-label="Round du tableau">
          {availableRounds.map((roundId) => (
            <Link className={roundId === selectedRound ? "active" : ""} href={`/tableau?round=${roundId}${isChronological ? "" : "&ordre=groupes"}`} key={roundId}>
              {roundLabels[roundId]}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <div className="locked-panel compact-locked">
            <h3>Aucune affiche</h3>
            <p className="muted">Ce round n’est pas encore généré.</p>
          </div>
        ) : isChronological ? (
          <div className="tableau-list tableau-list-chrono">{chronologicalRows.map(renderMatch)}</div>
        ) : (
          <div className="tableau-groups">
            {groups.map((group) => (
              <section className="tableau-group" key={group}>
                <h2>Groupe {group}</h2>
                <div className="tableau-list">{rows.filter(({ match }) => match.group_name === group).map(renderMatch)}</div>
              </section>
            ))}
          </div>
        )}
      </section>
      <section className="panel bonus-board">
        <div className="section-title">
          <div>
            <h2>Paris bonus</h2>
            <p className="muted">Les bonus se dévoilent avec les grilles validées.</p>
          </div>
        </div>
        {canSeeSpecials ? (
          <div className="bonus-grid">
            {specialRows.map(({ player, predictions, submitted: playerSubmitted }) => (
              <article className={playerSubmitted ? "bonus-card" : "bonus-card muted-card"} key={player.id}>
                <div className="bonus-card-head">
                  <strong>{player.display_name}</strong>
                  <span>{playerSubmitted ? "Validé" : "En attente"}</span>
                </div>
                <dl className="bonus-list">
                  {specialBets.map((bet) => (
                    <div className="bonus-item" key={bet.category}>
                      <dt>{bet.label}</dt>
                      <dd>{playerSubmitted ? predictions.get(bet.category) || "Non rempli" : "Masqué"}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="locked-panel compact-locked">
            <h3>Encore caché</h3>
            <p className="muted">Soumets tous tes pronostics et tes paris bonus pour voir ceux des autres.</p>
            <Link className="button secondary" href="/predict">Retour aux pronostics</Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
