import { Activity, BrainCircuit, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireUser } from "@/lib/auth";
import { readModelReport } from "@/lib/model";
import { teamName } from "@/lib/teams";

function pct(value: unknown) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function num(value: unknown, digits = 2) {
  return typeof value === "number" ? value.toFixed(digits) : "n/a";
}

export default async function ModelePage() {
  const user = await requireUser();
  const report = readModelReport();

  if (!report) {
    return (
      <AppShell user={user}>
        <section className="panel">
          <h1>Modèle</h1>
          <p className="muted">Aucun rapport modèle disponible pour le moment.</p>
        </section>
      </AppShell>
    );
  }

  const metrics = report.metadata.model_metrics;
  const confident = [...report.matches].sort((a, b) => b.pick_confidence - a.pick_confidence).slice(0, 6);
  const uncertain = [...report.matches].sort((a, b) => a.pick_confidence - b.pick_confidence).slice(0, 6);
  const groups = Array.from(new Set(report.groups.map((item) => item.group)));

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Machine à pronostiquer</p>
          <h1>XGBoost</h1>
          <p className="muted">
            Le modèle joue avec le score modal de chaque match. Il apparaît comme un concurrent, mais ne modifie pas les bonus de cote.
          </p>
        </div>
      </div>

      <section className="stat-grid model-stats">
        <div className="card stat">
          <BrainCircuit size={22} />
          <span className="muted">Accuracy V/N/D</span>
          <strong>{pct(metrics.score_blend_accuracy)}</strong>
        </div>
        <div className="card stat">
          <Activity size={22} />
          <span className="muted">Log loss</span>
          <strong>{num(metrics.score_blend_log_loss, 3)}</strong>
        </div>
        <div className="card stat">
          <Target size={22} />
          <span className="muted">Matchs de test</span>
          <strong>{typeof metrics.test_matches === "number" ? metrics.test_matches.toLocaleString("fr-FR") : "n/a"}</strong>
        </div>
        <div className="card stat">
          <Trophy size={22} />
          <span className="muted">Période</span>
          <strong className="model-period">
            <span>{String(metrics.test_start)}</span>
            <span>{String(metrics.test_end)}</span>
          </strong>
        </div>
      </section>

      <section className="two model-grid">
        <div className="panel">
          <h2>Ses coups les plus sûrs</h2>
          <div className="model-match-list">
            {confident.map((match) => (
              <article className="model-match" key={match.match_id}>
                <span className="match-no">#{match.match_no} · Groupe {match.group}</span>
                <div className="model-fixture">
                  <TeamName team={match.home_team} />
                  <strong>{match.modal_score}</strong>
                  <TeamName team={match.away_team} align="right" />
                </div>
                <p className="muted">
                  Pick {teamName(match.pick_label)} à {(match.pick_confidence * 100).toFixed(0)}%, xG {match.expected_home_goals.toFixed(1)}-{match.expected_away_goals.toFixed(1)}.
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Les matchs les plus piégeux</h2>
          <div className="model-match-list">
            {uncertain.map((match) => (
              <article className="model-match" key={match.match_id}>
                <span className="match-no">#{match.match_no} · Groupe {match.group}</span>
                <div className="model-fixture">
                  <TeamName team={match.home_team} />
                  <strong>{match.modal_score}</strong>
                  <TeamName team={match.away_team} align="right" />
                </div>
                <p className="muted">
                  Pick {teamName(match.pick_label)} à {(match.pick_confidence * 100).toFixed(0)}%, score modal probable à {(match.modal_score_probability * 100).toFixed(1)}%.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel table-wrap">
        <h2>Qualifiés projetés</h2>
        <div className="model-qualifiers">
          {groups.map((group) => (
            <div className="model-group" key={group}>
              <h3>Groupe {group}</h3>
              {report.groups
                .filter((item) => item.group === group)
                .sort((a, b) => a.projected_rank - b.projected_rank)
                .map((item) => (
                  <div className={item.projected_status ? "model-team qualified" : "model-team"} key={item.team}>
                    <span>{item.projected_rank}</span>
                    <TeamName team={item.team} />
                    <strong>{item.expected_points.toFixed(1)} pts</strong>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
