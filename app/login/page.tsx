"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions";
import { PasswordInput } from "@/components/PasswordInput";

// Images servies en local (public/legacy) : pas de dependance a des hotes externes.
const legacyPhotos = [
  {
    year: "2010",
    title: "Le bus de Knysna",
    src: "/legacy/knysna-2010.jpg",
    width: 874,
    height: 420,
    credit: "SportBuzzBusiness / adidas"
  },
  {
    year: "1998",
    title: "Le soir ou tout commence",
    src: "/legacy/finale-1998.jpg",
    width: 960,
    height: 648,
    credit: "Archives nationales / Wikimedia Commons"
  },
  {
    year: "2006",
    title: "Zidane et Thuram, Berlin",
    src: "/legacy/berlin-2006.jpg",
    width: 960,
    height: 893,
    credit: "David Ruddell / CC BY 2.0"
  },
  {
    year: "2018",
    title: "La deuxieme etoile",
    src: "/legacy/moscou-2018.jpg",
    width: 960,
    height: 592,
    credit: "Kremlin.ru / CC BY 4.0"
  }
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-copy">
          <p className="eyebrow">Knysna Memorial League</p>
          <h1>Pronostick</h1>
          <p>1998, 2006, 2010, 2018. La France du foot a tout connu, donc vos 2-1 prudents peuvent attendre.</p>
          <span>Photo phare : le bus de Knysna, Mondial 2010.</span>
        </div>

        <form className="login-card form-grid" action={action}>
          <div>
            <p className="eyebrow">Coupe du Monde 2026</p>
            <h2>Connexion</h2>
            <p className="muted">Connecte-toi avec le compte préparé par l’admin.</p>
          </div>
          <input className="compact-input" name="username" placeholder="Utilisateur" autoComplete="username" required />
          <PasswordInput name="password" placeholder="Mot de passe" autoComplete="current-password" required />
          {state?.error ? <p style={{ color: "var(--red)", margin: 0 }}>{state.error}</p> : null}
          <button className="button" disabled={pending} type="submit">
            <LogIn size={18} />
            Entrer
          </button>
        </form>

        <div className="legacy-strip">
          {legacyPhotos.map((photo) => (
            <figure className="legacy-photo" key={photo.year}>
              <img src={photo.src} alt={photo.title} width={photo.width} height={photo.height} loading="lazy" />
              <figcaption>
                <strong>{photo.year}</strong>
                <span>{photo.title}</span>
                <small>{photo.credit}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
