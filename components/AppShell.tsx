import { logoutAction } from "@/app/actions";
import { NavLinks } from "@/components/NavLinks";
import type { User } from "@/lib/types";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Pronostick</strong>
          <span>Coupe du Monde 2026</span>
        </div>
        <nav className="nav">
          <NavLinks isAdmin={user.role === "admin"} />
          <form action={logoutAction}>
            <button type="submit">Déconnexion</button>
          </form>
        </nav>
        <div className="userbox">
          Connecté en tant que
          <br />
          <strong>{user.display_name}</strong>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
