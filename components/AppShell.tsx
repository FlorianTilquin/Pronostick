import { BarChart3, BrainCircuit, ClipboardList, Gauge, Settings, Table2, Trophy } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import type { User } from "@/lib/types";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const items = [
    { href: "/predict", label: "Pronostics", icon: ClipboardList },
    { href: "/tableau", label: "Tableau", icon: Table2 },
    { href: "/classement", label: "Scores", icon: Trophy },
    { href: "/graphiques", label: "Graphiques", icon: BarChart3 },
    { href: "/modele", label: "Modèle", icon: BrainCircuit },
    { href: "/reglement", label: "Barème", icon: Gauge }
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Pronostick</strong>
          <span>Coupe du Monde 2026</span>
        </div>
        <nav className="nav">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          {user.role === "admin" ? (
            <Link href="/admin">
              <Settings size={18} />
              Admin
            </Link>
          ) : null}
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
