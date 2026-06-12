import { TimelineChart } from "@/components/TimelineChart";
import { AppShell } from "@/components/AppShell";
import { MdsProjectionChart } from "@/components/MdsProjectionChart";
import { RidgeOddsChart } from "@/components/RidgeOddsChart";
import { ScoringBreakdownChart } from "@/components/ScoringBreakdownChart";
import { requireUser } from "@/lib/auth";
import { maybeSyncResults } from "@/lib/resultsSync";
import { getUsers } from "@/lib/db";
import { predictionMdsProjection, predictionOddsDistribution } from "@/lib/graphStats";
import { randomBaselineBandNames, randomBaselineTimeline, readRandomDistribution } from "@/lib/randomBaseline";
import { scoringBreakdownTimeline, timeline } from "@/lib/scoring";

export default async function GraphiquesPage() {
  const user = await requireUser();
  await maybeSyncResults();
  const names = getUsers()
    .filter((item) => item.role === "player")
    .map((item) => item.display_name);
  const playerTimeline = timeline();
  const randomTimeline = randomBaselineTimeline();
  const data = playerTimeline.map((row, index) => ({ ...row, ...(randomTimeline[index] ?? {}) }));
  const randomDistribution = readRandomDistribution();
  const chartNames = randomTimeline.length ? [...randomBaselineBandNames, ...names] : names;
  const oddsDistribution = predictionOddsDistribution();
  const mdsProjection = predictionMdsProjection();
  const breakdownTimeline = scoringBreakdownTimeline();

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Evolution</p>
          <h1>Graphiques</h1>
          <p className="muted">
            Courbe cumulée des points après chaque résultat saisi, avec repères de pronostics aléatoires.
          </p>
        </div>
      </div>
      <section className="panel graph-panel">
        <div className="section-title">
          <div>
            <h2>Course aux points</h2>
            <p className="muted">Score cumulé après chaque résultat saisi, en ordre chronologique réel des matchs.</p>
          </div>
        </div>
        {data.length ? <TimelineChart data={data} names={chartNames} /> : <p className="muted">Aucun résultat saisi pour le moment.</p>}
        {randomDistribution ? (
          <p className="muted">
            Hasard : {randomDistribution.simulations.toLocaleString("fr-FR")} grilles tirées depuis {randomDistribution.source.matches.toLocaleString("fr-FR")} matchs de coupes internationales
            ({randomDistribution.source.start} - {randomDistribution.source.end}), hors amicaux et qualifications. Ces grilles ne comptent pas comme joueurs.
          </p>
        ) : null}
      </section>
      <section className="panel graph-panel">
        <div className="section-title">
          <div>
            <h2>D’où viennent les points</h2>
            <p className="muted">Compteurs cumulés de bons résultats, bonnes différences de buts et scores exacts.</p>
          </div>
        </div>
        {breakdownTimeline.length ? <ScoringBreakdownChart data={breakdownTimeline} names={names} /> : <p className="muted">Aucun résultat saisi pour le moment.</p>}
      </section>
      <section className="graph-grid">
        <article className="panel graph-panel">
          <div className="section-title">
            <div>
              <h2>Audace des pronos</h2>
              <p className="muted">Distribution des cotes bookmakers choisies par chaque joueur, XGBoost et les books inclus comme concurrents.</p>
            </div>
          </div>
          <RidgeOddsChart rows={oddsDistribution} />
          <p className="muted">Lecture : plus la bosse part à droite, plus le joueur choisit souvent des issues peu probables chez les books.</p>
        </article>
        <article className="panel graph-panel">
          <div className="section-title">
            <div>
              <h2>Proximité des grilles</h2>
              <p className="muted">Projection MDS des distances entre pronostics. La distance combine le résultat 1/N/2 et l’écart de score.</p>
            </div>
          </div>
          <MdsProjectionChart points={mdsProjection} />
          <p className="muted">Lecture : deux points proches ont des grilles similaires. Un gros point est un profil plus isolé du groupe.</p>
        </article>
      </section>
    </AppShell>
  );
}
