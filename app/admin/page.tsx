import { KeyRound, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import {
  changeUserPasswordAction,
  createUserAction,
  deleteUserAction,
  openRoundAction,
  updateKnockoutSeedAction,
  updateResultAction,
  updateThirdPlaceAssignmentAction,
  updateUserColorAction,
  updateUserDisplayNameAction,
} from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { PasswordInput } from "@/components/PasswordInput";
import { TeamName } from "@/components/TeamName";
import { requireAdmin } from "@/lib/auth";
import { colorForUser } from "@/lib/chartColors";
import { getActiveRoundId, getKnockoutSeeds, getMatches, getThirdPlaceAssignments, getUsers } from "@/lib/db";
import { displaySource, isThirdPlaceSource, roundLabels, roundOrder, sourceCandidates } from "@/lib/knockout";
import { teamName } from "@/lib/teams";

function AdminTeam({ team, source, align }: { team: string; source?: string; align?: "right" }) {
  if (team) return <TeamName team={team} align={align} />;
  return <span className="placeholder-team">{source ? displaySource(source) : "A définir"}</span>;
}

export default async function AdminPage() {
  const user = await requireAdmin();
  const matches = getMatches();
  const activeRound = getActiveRoundId();
  const allUsers = getUsers();
  const users = allUsers.filter((item) => !item.is_system);
  const graphUsers = allUsers.filter((item) => item.role === "player");
  const groups = Array.from(new Set(matches.filter((match) => (match.stage ?? "group") === "group").map((match) => match.group_name)));
  const resultGroups = Array.from(new Set(matches.map((match) => match.group_name)));
  const groupTeams = groups.map((group) => ({
    group,
    teams: Array.from(new Set(matches.filter((match) => match.group_name === group).flatMap((match) => [match.home_team, match.away_team]))),
  }));
  const knockoutSeeds = new Map(getKnockoutSeeds().map((seed) => [seed.source, seed.team]));
  const qualifiedThirdSources = new Set(getKnockoutSeeds().filter((seed) => seed.rank === 3 && seed.team).map((seed) => seed.source));
  const thirdAssignments = new Map(getThirdPlaceAssignments().map((item) => [`${item.match_no}-${item.side}`, item.source]));
  const thirdPlaceSlots = matches.filter((match) => match.stage === "round_of_32" && (isThirdPlaceSource(match.home_source ?? "") || isThirdPlaceSource(match.away_source ?? "")));

  return (
    <AppShell user={user}>
      <div className="topline">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Console</h1>
          <p className="muted">Gère les comptes, les mots de passe et les résultats sans te battre avec un tableau géant.</p>
        </div>
      </div>

      <div className="admin-layout">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Comptes</h2>
              <p className="muted">Crée les joueurs et remplace leur mot de passe quand nécessaire.</p>
            </div>
            <ShieldCheck size={22} />
          </div>

          <div className="admin-users">
            {users.map((item) => (
              <div className="user-admin-row" key={item.id}>
                <div>
                  <strong>{item.display_name}</strong>
                  <p className="muted">{item.username} · {item.role}</p>
                </div>
                <div className="user-admin-actions">
                  <form action={updateUserDisplayNameAction} className="inline-admin-form">
                    <input type="hidden" name="userId" value={item.id} />
                    <input className="compact-input" name="displayName" defaultValue={item.display_name} placeholder="nom affiché" required />
                    <button className="icon-button neutral" type="submit" title="Modifier le nom affiché">
                      <Save size={17} />
                    </button>
                  </form>
                  <form action={changeUserPasswordAction} className="inline-admin-form">
                    <input type="hidden" name="userId" value={item.id} />
                    <PasswordInput name="password" minLength={6} placeholder="nouveau mdp" required />
                    <button className="icon-button neutral" type="submit" title="Changer le mot de passe">
                      <KeyRound size={17} />
                    </button>
                  </form>
                  <form action={deleteUserAction}>
                    <input type="hidden" name="userId" value={item.id} />
                    <button className="icon-button danger" disabled={item.id === user.id} type="submit" title={item.id === user.id ? "Impossible de supprimer ton propre compte" : "Supprimer le joueur"}>
                      <Trash2 size={17} />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Phase finale</h2>
              <p className="muted">Sélectionne les qualifiés, affecte les meilleurs troisièmes aux slots FIFA possibles, puis ouvre le round.</p>
            </div>
          </div>
          <div className="knockout-admin">
            <div className="knockout-open-rounds">
              {roundOrder.map((roundId) => (
                <form action={openRoundAction} key={roundId}>
                  <input type="hidden" name="roundId" value={roundId} />
                  <button className={`round-open-button ${activeRound === roundId ? "active" : ""}`} type="submit">
                    {roundLabels[roundId]}
                  </button>
                </form>
              ))}
            </div>
            <div className="qualified-grid">
              {groupTeams.map(({ group, teams }) => (
                <section className="qualified-card" key={group}>
                  <h3>Groupe {group}</h3>
                  {[1, 2, 3].map((rank) => {
                    const source = `${rank}${group}`;
                    return (
                      <form action={updateKnockoutSeedAction} className="qualified-row" key={source}>
                        <input type="hidden" name="source" value={source} />
                        <span>{source}</span>
                        <select name="team" defaultValue={knockoutSeeds.get(source) ?? ""} aria-label={`Equipe ${source}`}>
                          <option value="">Non défini</option>
                          {teams.map((team) => (
                            <option value={team} key={team}>{teamName(team)}</option>
                          ))}
                        </select>
                        <button className="icon-button neutral" type="submit" title={`Sauvegarder ${source}`}>
                          <Save size={17} />
                        </button>
                      </form>
                    );
                  })}
                </section>
              ))}
            </div>
            <div className="third-place-grid">
              {thirdPlaceSlots.map((match) => {
                const side = isThirdPlaceSource(match.home_source ?? "") ? "home" : "away";
                const source = side === "home" ? match.home_source! : match.away_source!;
                const candidates = sourceCandidates(source).map((group) => `3${group}`);
                return (
                  <form action={updateThirdPlaceAssignmentAction} className="third-place-row" key={`${match.match_no}-${side}`}>
                    <input type="hidden" name="matchNo" value={match.match_no} />
                    <input type="hidden" name="side" value={side} />
                    <div>
                      <strong>Match #{match.match_no}</strong>
                      <p className="muted">{displaySource(match.home_source ?? "")} vs {displaySource(match.away_source ?? "")}</p>
                    </div>
                    <select name="source" defaultValue={thirdAssignments.get(`${match.match_no}-${side}`) ?? ""} aria-label={`Meilleur troisième du match ${match.match_no}`}>
                      <option value="">Non défini</option>
                      {candidates.map((candidate) => (
                        <option disabled={!qualifiedThirdSources.has(candidate)} value={candidate} key={candidate}>
                          {candidate}{knockoutSeeds.get(candidate) ? ` · ${knockoutSeeds.get(candidate)}` : ""}
                        </option>
                      ))}
                    </select>
                    <button className="icon-button neutral" type="submit" title="Sauvegarder l’affectation">
                      <Save size={17} />
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Créer un joueur</h2>
              <p className="muted">Tu choisis l’identifiant et le mot de passe, puis tu lui envoies à part.</p>
            </div>
            <Plus size={22} />
          </div>
          <form action={createUserAction} className="create-user-form">
            <input className="compact-input" name="username" placeholder="identifiant" required />
            <input className="compact-input" name="displayName" placeholder="nom affiché" required />
            <PasswordInput name="password" minLength={6} placeholder="mot de passe" required />
            <button className="button" type="submit">
              <Plus size={18} />
              Ajouter
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Couleurs des graphiques</h2>
              <p className="muted">Choisis une couleur par joueur, modèle et books pour rendre les courbes lisibles.</p>
            </div>
          </div>
          <div className="color-admin-list">
            {graphUsers.map((item, index) => (
              <form action={updateUserColorAction} className="color-admin-row" key={item.id}>
                <input type="hidden" name="userId" value={item.id} />
                <span className="color-dot" style={{ background: colorForUser(item, index) }} aria-hidden="true" />
                <div>
                  <strong>{item.display_name}</strong>
                  <p className="muted">{item.system_type === "bookmaker" ? "Bookmakers" : item.system_type === "model" ? "Modèle" : "Joueur"}</p>
                </div>
                <input className="color-input" type="color" name="color" defaultValue={colorForUser(item, index)} aria-label={`Couleur de ${item.display_name}`} />
                <button className="icon-button neutral" type="submit" title="Sauvegarder la couleur">
                  <Save size={17} />
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Résultats des matchs</h2>
              <p className="muted">Les scores vides gardent le match “à venir”. Dès que les deux scores sont saisis, le classement se recalcule.</p>
            </div>
          </div>

          <div className="result-groups">
            {resultGroups.map((group) => (
              <section className="result-group" key={group}>
                <h3>Groupe {group}</h3>
                <div className="result-list">
                  {matches
                    .filter((match) => match.group_name === group)
                    .map((match) => (
                      <form className="result-row" action={updateResultAction} key={match.id}>
                        <input type="hidden" name="matchId" value={match.id} />
                        <span className="match-no">#{match.match_no}</span>
                        <span className="result-team">
                          <AdminTeam team={match.home_team} source={match.home_source} />
                        </span>
                        <input name="homeScore" aria-label={`${match.home_team} score`} type="number" min="0" max="30" defaultValue={match.home_score ?? ""} />
                        <span className="muted">-</span>
                        <input name="awayScore" aria-label={`${match.away_team} score`} type="number" min="0" max="30" defaultValue={match.away_score ?? ""} />
                        <span className="result-team away">
                          <AdminTeam team={match.away_team} source={match.away_source} align="right" />
                        </span>
                        {match.stage && match.stage !== "group" && match.home_team && match.away_team ? (
                          <select className="winner-select" name="winnerTeam" defaultValue={match.winner_team ?? ""} aria-label={`Qualifié match ${match.match_no}`}>
                            <option value="">Qualifié auto</option>
                            <option value={match.home_team}>{match.home_team}</option>
                            <option value={match.away_team}>{match.away_team}</option>
                          </select>
                        ) : null}
                        <button className="icon-button" title="Sauvegarder le résultat" type="submit">
                          <Save size={17} />
                        </button>
                      </form>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
