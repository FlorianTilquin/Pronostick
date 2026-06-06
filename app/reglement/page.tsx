import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { readConfig } from "@/lib/config";

export default async function ReglementPage() {
  const user = await requireUser();
  const scoring = readConfig().scoring;

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
              <td>Score exact</td>
              <td className="score">{scoring.exactScore}</td>
              <td>Déclenché quand les deux scores sont parfaitement trouvés.</td>
            </tr>
            <tr>
              <td>Bon signe</td>
              <td className="score">{scoring.correctOutcome}</td>
              <td>Victoire domicile, nul ou victoire extérieur correctement anticipé.</td>
            </tr>
            <tr>
              <td>Bon écart</td>
              <td className="score">{scoring.correctGoalDifference}</td>
              <td>Différence de buts exacte, même sans score exact.</td>
            </tr>
            <tr>
              <td>Buts d’une équipe</td>
              <td className="score">{scoring.correctTeamGoals}</td>
              <td>Bonus par équipe dont le nombre de buts est correct.</td>
            </tr>
            <tr>
              <td>Pénalité distance</td>
              <td className="score">-{scoring.maxGoalDistancePenalty} max</td>
              <td>Réduit le score selon l’écart total aux buts réels.</td>
            </tr>
            <tr>
              <td>Bonus cote</td>
              <td className="score">0 à {scoring.oddsBonus.maxBonus}</td>
              <td>Plus le bon signe était rare parmi les joueurs, plus il rapporte.</td>
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
              <td className="score">{scoring.specials.firstTeamCriticizedByTrump ?? 4}</td>
              <td>Pari bonus à arbitrer entre vous pendant le tournoi.</td>
            </tr>
            <tr>
              <td>Messi ou CR7 : moins de buts</td>
              <td className="score">{scoring.specials.messiOrRonaldoFewestGoals ?? 4}</td>
              <td>Choisir celui qui termine avec le plus petit total de buts.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
