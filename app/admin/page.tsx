import { KeyRound, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { changeUserPasswordAction, createUserAction, deleteUserAction, updateResultAction, updateUserDisplayNameAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { TeamName } from "@/components/TeamName";
import { requireAdmin } from "@/lib/auth";
import { getMatches, getUsers } from "@/lib/db";

export default async function AdminPage() {
  const user = await requireAdmin();
  const matches = getMatches();
  const users = getUsers();
  const groups = Array.from(new Set(matches.map((match) => match.group_name)));

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
                    <input className="compact-input" name="password" type="password" minLength={6} placeholder="nouveau mdp" required />
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
              <h2>Créer un joueur</h2>
              <p className="muted">Tu choisis l’identifiant et le mot de passe, puis tu lui envoies à part.</p>
            </div>
            <Plus size={22} />
          </div>
          <form action={createUserAction} className="create-user-form">
            <input className="compact-input" name="username" placeholder="identifiant" required />
            <input className="compact-input" name="displayName" placeholder="nom affiché" required />
            <input className="compact-input" name="password" type="password" minLength={6} placeholder="mot de passe" required />
            <button className="button" type="submit">
              <Plus size={18} />
              Ajouter
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Résultats des matchs</h2>
              <p className="muted">Les scores vides gardent le match “à venir”. Dès que les deux scores sont saisis, le classement se recalcule.</p>
            </div>
          </div>

          <div className="result-groups">
            {groups.map((group) => (
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
                          <TeamName team={match.home_team} />
                        </span>
                        <input name="homeScore" aria-label={`${match.home_team} score`} type="number" min="0" max="30" defaultValue={match.home_score ?? ""} />
                        <span className="muted">-</span>
                        <input name="awayScore" aria-label={`${match.away_team} score`} type="number" min="0" max="30" defaultValue={match.away_score ?? ""} />
                        <span className="result-team away">
                          <TeamName team={match.away_team} align="right" />
                        </span>
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
