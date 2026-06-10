"use client";

import { BarChart3, BrainCircuit, ClipboardList, Gauge, Settings, Table2, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/predict", label: "Pronostics", icon: ClipboardList },
  { href: "/tableau", label: "Tableau", icon: Table2 },
  { href: "/classement", label: "Scores", icon: Trophy },
  { href: "/graphiques", label: "Graphiques", icon: BarChart3 },
  { href: "/modele", label: "Modèle", icon: BrainCircuit },
  { href: "/reglement", label: "Barème", icon: Gauge }
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...items, { href: "/admin", label: "Admin", icon: Settings }] : items;

  return (
    <>
      {links.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
