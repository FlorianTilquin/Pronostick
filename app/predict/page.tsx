import { CheckCircle2, Save } from "lucide-react";
import { savePredictionsAction, submitPredictionsAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { getActiveRoundId, getPredictions, getRoundMatches, getSpecialPredictions, hasSubmitted } from "@/lib/db";
import { roundLabels } from "@/lib/knockout";
import { specialBets } from "@/lib/specials";

type PredictPageProps = {
  searchParams?: Promise<{ sauvegarde?: string }>;
};

export default async function PredictPage({ searchParams }: PredictPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const justSaved = params?.sauvegarde === "1";
  const activeRound = getActiveRoundId();
  const matches = getRoundMatches(activeRound);
  const predictions = new Map(getPredictions(user.id).map((prediction) => [prediction.match_id, prediction]));
  const submitted = hasSubmitted(user.id, activeRound);
  const specials = getSpecialPredictions(user.id);
  const specialMap = new Map(specials.map((item) => [item.category, item.value]));
  const activeMatchIds = new Set(matches.map((match) => match.id));
  const completed = [...predictions.values()].filter((prediction) => activeMatchIds.has(prediction.match_id)).length;
  const missingMatches = Math.max(0, matches.length - completed);
  const missingSpecials = activeRound === "group" ? Math.max(0, specialBets.length - specials.length) : 0;
  const canSubmit = matches.length > 0 && missingMatches === 0 && missingSpecials === 0 && !submitted;
  const groups = Array.from(new Set(matches.map((match) => match.group_name)));
  const isGroupRound = activeRound === "group";

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Saisie personnelle</p>
          <h1>Mes pronostics</h1>
          <p className="muted">
            {submitted
              ? `${roundLabels[activeRound]} soumis et verrouillé. Le tableau des autres est maintenant visible pour ce round.`
              : `${roundLabels[activeRound]} : ${completed}/${matches.length} match(s) rempli(s). Sauvegarde autant que tu veux, puis soumets quand tout est prêt.`}
          </p>
        </div>
        <span className="badge">{submitted ? "Soumis" : "Brouillon"}</span>
      </div>

      <form action={savePredictionsAction} className="prediction-layout">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>{roundLabels[activeRound]}</h2>
              <p className="muted">{isGroupRound ? "Un groupe à la fois, deux scores, pas de tableur déguisé." : "Un round frais : tu pronostiques uniquement les affiches ouvertes."}</p>
            </div>
          </div>

          {matches.length ? (
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
          ) : (
            <div className="locked-panel compact-locked">
              <h3>Round pas encore prêt</h3>
              <p className="muted">L’admin doit renseigner les affiches puis ouvrir le round de pronostics.</p>
            </div>
          )}
        </section>

        <aside className={`grid prediction-side${!submitted ? " has-sticky-actions" : ""}`}>
          {!submitted ? (
            <div className="sticky-actions">
              <section className="panel save-panel">
                <h2>Sauvegarde</h2>
                <p className="muted">Garde tes scores et tes paris bonus même si tu quittes la page.</p>
                <button className="button" type="submit">
                  <Save size={18} />
                  Sauvegarder
                </button>
                {justSaved ? <span className="save-confirm">Sauvegardé ✓</span> : null}
              </section>
              <section className="panel validation-panel">
                <h2>Validation</h2>
                <p className="muted">
                  {canSubmit
                    ? "Une fois soumis, tes pronostics sont verrouillés et tu peux voir ceux des autres."
                    : isGroupRound
                      ? `Il manque ${missingMatches} match(s) et ${missingSpecials} pari(s) bonus. Le bouton sauvegarde aussi avant de vérifier.`
                      : `Il manque ${missingMatches} match(s) pour ce round. Le bouton sauvegarde aussi avant de vérifier.`}
                </p>
                <button formAction={submitPredictionsAction} className="button warn" type="submit" disabled={!canSubmit}>
                  <CheckCircle2 size={18} />
                  Soumettre tous mes pronos
                </button>
              </section>
            </div>
          ) : null}
          {isGroupRound ? (
            <section className="panel specials">
              <h2>Paris bonus</h2>
              {specialBets.map((bet) => (
                <label key={bet.category}>
                  <span className="muted">{bet.label}</span>
                  <input disabled={submitted} className="compact-input" name={bet.category} defaultValue={specialMap.get(bet.category) ?? ""} />
                </label>
              ))}
            </section>
          ) : null}
        </aside>
      </form>
    </AppShell>
  );
}
