import { TimelineChart } from "@/components/TimelineChart";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getUsers } from "@/lib/db";
import { randomBaselineNames, randomBaselineTimeline, readRandomDistribution } from "@/lib/randomBaseline";
import { timeline } from "@/lib/scoring";

export default async function GraphiquesPage() {
  const user = await requireUser();
  const names = getUsers()
    .filter((item) => item.role === "player")
    .map((item) => item.display_name);
  const playerTimeline = timeline();
  const randomTimeline = randomBaselineTimeline();
  const data = playerTimeline.map((row, index) => ({ ...row, ...(randomTimeline[index] ?? {}) }));
  const randomDistribution = readRandomDistribution();
  const chartNames = randomTimeline.length ? [...names, ...randomBaselineNames] : names;

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
      <section className="panel">
        {data.length ? <TimelineChart data={data} names={chartNames} /> : <p className="muted">Aucun résultat saisi pour le moment.</p>}
        {randomDistribution ? (
          <p className="muted">
            Hasard : {randomDistribution.simulations.toLocaleString("fr-FR")} grilles tirées depuis {randomDistribution.source.matches.toLocaleString("fr-FR")} matchs de coupes internationales
            ({randomDistribution.source.start} - {randomDistribution.source.end}), hors amicaux et qualifications. Ces grilles ne comptent pas comme joueurs.
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
