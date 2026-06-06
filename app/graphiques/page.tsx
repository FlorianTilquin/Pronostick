import { TimelineChart } from "@/components/TimelineChart";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getUsers } from "@/lib/db";
import { timeline } from "@/lib/scoring";

export default async function GraphiquesPage() {
  const user = await requireUser();
  const names = getUsers()
    .filter((item) => item.role === "player")
    .map((item) => item.display_name);
  const data = timeline();

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Evolution</p>
          <h1>Graphiques</h1>
          <p className="muted">Courbe cumulée des points après chaque résultat saisi.</p>
        </div>
      </div>
      <section className="panel">
        {data.length ? <TimelineChart data={data} names={names} /> : <p className="muted">Aucun résultat saisi pour le moment.</p>}
      </section>
    </AppShell>
  );
}
