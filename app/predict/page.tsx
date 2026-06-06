import { CheckCircle2, Save } from "lucide-react";
import { savePredictionsAction, submitPredictionsAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { getMatches, getPredictions, getSpecialPredictions, hasSubmitted } from "@/lib/db";

export default async function PredictPage() {
  const user = await requireUser();
  const matches = getMatches();
  const predictions = new Map(getPredictions(user.id).map((prediction) => [prediction.match_id, prediction]));
  const submitted = hasSubmitted(user.id);
  const specials = getSpecialPredictions(user.id);
  const specialMap = new Map(specials.map((item) => [item.category, item.value]));
  const completed = predictions.size;
  const canSubmit = completed === matches.length && specials.length === 3 && !submitted;
  const groups = Array.from(new Set(matches.map((match) => match.group_name)));

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Saisie personnelle</p>
          <h1>Mes pronostics</h1>
          <p className="muted">
            {submitted
              ? "Pronostics soumis et verrouillés. Le tableau des autres est maintenant visible."
              : `${completed}/${matches.length} matchs remplis. Sauvegarde autant que tu veux, puis soumets quand tout est prêt.`}
          </p>
        </div>
        <span className="badge">{submitted ? "Soumis" : "Brouillon"}</span>
      </div>

      <form action={savePredictionsAction} className="prediction-layout">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Matchs de poule</h2>
              <p className="muted">Un groupe à la fois, deux scores, pas de tableur déguisé.</p>
            </div>
          </div>

          <div className="result-groups prediction-groups">
            {groups.map((group) => (
              <section className="result-group" key={group}>
                <h3>Groupe {group}</h3>
                <div className="result-list">
                  {matches
                    .filter((match) => match.group_name === group)
                    .map((match) => {
                      const prediction = predictions.get(match.id);
                      return (
                        <div className="result-row prediction-row" key={match.id}>
                          <span className="match-no">#{match.match_no}</span>
                          <span className="result-team">
                            <TeamName team={match.home_team} />
                          </span>
                          <input
                            aria-label={`Score ${match.home_team}`}
                            disabled={submitted}
                            name={`home_${match.id}`}
                            type="number"
                            min="0"
                            max="30"
                            defaultValue={prediction?.home_score ?? ""}
                          />
                          <span className="muted">-</span>
                          <input
                            aria-label={`Score ${match.away_team}`}
                            disabled={submitted}
                            name={`away_${match.id}`}
                            type="number"
                            min="0"
                            max="30"
                            defaultValue={prediction?.away_score ?? ""}
                          />
                          <span className="result-team away">
                            <TeamName team={match.away_team} align="right" />
                          </span>
                        </div>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="grid">
          <section className="panel specials">
            <h2>Paris bonus</h2>
            <label>
              <span className="muted">Meilleur buteur</span>
              <input disabled={submitted} className="compact-input" name="topScorer" defaultValue={specialMap.get("topScorer") ?? ""} />
            </label>
            <label>
              <span className="muted">Meilleure défense</span>
              <input disabled={submitted} className="compact-input" name="bestDefense" defaultValue={specialMap.get("bestDefense") ?? ""} />
            </label>
            <label>
              <span className="muted">Meilleure attaque</span>
              <input disabled={submitted} className="compact-input" name="bestAttack" defaultValue={specialMap.get("bestAttack") ?? ""} />
            </label>
            {!submitted ? (
              <button className="button" type="submit">
                <Save size={18} />
                Sauvegarder
              </button>
            ) : null}
          </section>
          {!submitted ? (
            <section className="panel">
              <h2>Validation</h2>
              <p className="muted">Une fois soumis, tes pronostics sont verrouillés et tu peux voir ceux des autres.</p>
              <button formAction={submitPredictionsAction} className="button warn" disabled={!canSubmit} type="submit">
                <CheckCircle2 size={18} />
                Soumettre tous mes pronos
              </button>
            </section>
          ) : null}
        </aside>
      </form>
    </AppShell>
  );
}
