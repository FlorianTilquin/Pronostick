import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { readConfig } from "@/lib/config";

export default async function ReglementPage() {
  const user = await requireUser();
  const scoring = readConfig().scoring;
  const exactSupplement = Math.max(0, scoring.exactScore - scoring.correctOutcome - scoring.correctGoalDifference);

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Configurable</p>
          <h1>Barème</h1>
          <p className="muted">Les valeurs viennent de data/config.json et peuvent être ajustées avant le tournoi.</p>
        </div>
      </div>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Métrique</th>
              <th>Points</th>
              <th>Logique</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bon résultat</td>
              <td className="score">{scoring.correctOutcome}</td>
              <td>Victoire domicile, nul ou victoire extérieur correctement anticipé.</td>
            </tr>
            <tr>
              <td>Bonne différence de buts</td>
              <td className="score">{scoring.correctGoalDifference}</td>
              <td>Point supplémentaire quand la différence de buts est exacte.</td>
            </tr>
            <tr>
              <td>Score exact</td>
              <td className="score">+{exactSupplement}</td>
              <td>Point supplémentaire quand les deux scores sont parfaitement trouvés, soit {scoring.exactScore} points de base au total.</td>
            </tr>
            <tr>
              <td>Meilleur buteur</td>
              <td className="score">{scoring.specials.topScorer}</td>
              <td>Résultat spécial saisi en fin de tournoi.</td>
            </tr>
            <tr>
              <td>Meilleure défense</td>
              <td className="score">{scoring.specials.bestDefense}</td>
              <td>Equipe ayant concédé le moins de buts selon ta règle finale.</td>
            </tr>
            <tr>
              <td>Meilleure attaque</td>
              <td className="score">{scoring.specials.bestAttack}</td>
              <td>Equipe ayant marqué le plus de buts selon ta règle finale.</td>
            </tr>
            <tr>
              <td>1e équipe critiquée par Trump</td>
              <td className="score">{scoring.specials.firstTeamCriticizedByTrump ?? 5}</td>
              <td>Pari bonus à arbitrer entre vous pendant le tournoi.</td>
            </tr>
            <tr>
              <td>Messi ou CR7 : moins de buts</td>
              <td className="score">{scoring.specials.messiOrRonaldoFewestGoals ?? 5}</td>
              <td>Choisir celui qui termine avec le plus petit total de buts.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
