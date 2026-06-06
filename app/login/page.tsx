"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions";

const legacyPhotos = [
  {
    year: "2010",
    title: "Le bus de Knysna",
    src: "https://static.europe1.fr/var/europe1/storage/styles/image_750_422/public/media/image/2025/02/18/03/mondial-le-bus-de-knysna-roule-toujours.jpg?itok=Hsv89kdZ",
    credit: "S. Hervieu / Europe 1"
  },
  {
    year: "1998",
    title: "Le soir ou tout commence",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Tribune_pr%C3%A9sidentielle_finale_France_Br%C3%A9sil_football_12_juillet_1998.jpg?width=900",
    credit: "Archives nationales / Wikimedia Commons"
  },
  {
    year: "2006",
    title: "Zidane et Thuram, Berlin",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Italy_vs_France_-_FIFA_World_Cup_2006_final_-_Lilian_Thuram_and_Zinedine_Zidane.jpg?width=900",
    credit: "David Ruddell / CC BY 2.0"
  },
  {
    year: "2018",
    title: "La deuxieme etoile",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/France_champion_of_the_Football_World_Cup_Russia_2018.jpg?width=900",
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
          <input className="compact-input" name="password" type="password" placeholder="Mot de passe" autoComplete="current-password" required />
          {state?.error ? <p style={{ color: "var(--red)", margin: 0 }}>{state.error}</p> : null}
          <button className="button" disabled={pending} type="submit">
            <LogIn size={18} />
            Entrer
          </button>
        </form>

        <div className="legacy-strip">
          {legacyPhotos.map((photo) => (
            <figure className="legacy-photo" key={photo.year}>
              <img src={photo.src} alt={photo.title} />
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
