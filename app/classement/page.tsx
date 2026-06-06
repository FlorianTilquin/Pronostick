import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { getMatches } from "@/lib/db";
import { leaderboard } from "@/lib/scoring";

export default async function ClassementPage() {
  const user = await requireUser();
  const rows = leaderboard();
  const finished = getMatches().filter((match) => match.status === "finished").length;

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
    </AppShell>
  );
}
