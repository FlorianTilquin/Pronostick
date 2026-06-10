# Pronostick

Clone léger de MonPetitProno pour une ligue privée Coupe du Monde 2026, pensé pour être hébergé sur Unraid.

## Stack

- Next.js
- Store JSON persistant dans `data/pronostick.json`
- Auth par cookie signé
- Docker Compose compatible NAS
- Configuration initiale dans `data/config.json`

## Lancer en local

```bash
npm install
cp .env.example .env
npm run dev
```

Puis ouvrir `http://localhost:3000`.

Compte initial :

- utilisateur : `admin`
- mot de passe : `change-me`

Change ce mot de passe en modifiant `data/config.json` avant le premier lancement, ou crée tes vrais joueurs depuis `/admin`.

Si `data/pronostick.json` existe déjà, l’app considère que la base est initialisée. Pour repartir de `data/config.json`, arrête l’app puis supprime `data/pronostick.json`.

## Déploiement Unraid

1. Cloner le repo sur ton NAS.
2. Construire l’image :

```bash
docker build -t pronostick .
```

3. Lancer le conteneur. Pour tester en HTTP local sur le LAN, garde `COOKIE_SECURE=false` :

```bash
docker run -d \
  --name pronostick \
  --restart unless-stopped \
  -p 3000:3000 \
  -e APP_URL="http://IP_DU_NAS:3000" \
  -e AUTH_SECRET="une-longue-valeur-aleatoire" \
  -e STORE_PATH="/app/data/pronostick.json" \
  -e COOKIE_SECURE="false" \
  -v /mnt/user/appdata/pronostick/data:/app/data \
  pronostick
```

Quand l’app passe derrière Cloudflare en HTTPS, utilise `APP_URL=https://pronostick.tondomaine.com` et `COOKIE_SECURE=true`, et ne publie plus le port sur le LAN : remplace `-p 3000:3000` par `-p 127.0.0.1:3000:3000` (ou mets l’app et le proxy sur un même réseau docker sans publier de port), sinon l’app reste joignable en HTTP direct via l’IP du NAS.

Avec `docker compose`, copie d’abord `.env.example` en `.env` et renseigne `AUTH_SECRET` : le compose lit les secrets depuis `.env` (non versionné) et publie le port sur loopback uniquement.

En production (`NODE_ENV=production`), l’app refuse de signer une session si `AUTH_SECRET` n’est pas défini — pas de secret par défaut silencieux. Les connexions sont limitées à 5 échecs par compte par tranche de 10 minutes.

Le volume `/mnt/user/appdata/pronostick/data:/app/data` conserve les données et la config.

## Données dans Git

Ce projet versionne volontairement `data/pronostick.json`. Pour une petite ligue privée, ça permet de garder les comptes, pronostics, soumissions et résultats dans l’historique Git.

Après une saisie importante en production :

```bash
git status
git add data/pronostick.json
git commit -m "Archive pronostics"
git push
```

Le repo GitHub doit rester privé, car `data/pronostick.json` contient les utilisateurs, les pronostics et les mots de passe hashés.

## Flux joueur

1. L’admin crée les comptes.
2. Chaque joueur remplit tous les scores de poule et les trois paris bonus.
3. Le joueur peut sauvegarder en brouillon.
4. Quand tout est rempli, il soumet.
5. Après soumission, ses pronostics sont verrouillés et il voit ceux des autres.

## Barème

Le barème est dans `data/config.json` :

- `exactScore`
- `correctOutcome`
- `correctGoalDifference`
- `correctTeamGoals`
- `maxGoalDistancePenalty`
- `oddsBonus`
- `specials`

Le bonus de cote est basé sur la rareté du bon signe parmi les joueurs. Avec seulement 4 joueurs, ça crée vite des petits coups tactiques sans rendre le classement illisible.

## Données Coupe du Monde

Les groupes 2026 sont préremplis dans `data/config.json`. Au premier lancement, l’app génère les six affiches de poule par groupe.

Les horaires et stades sont volontairement éditables/indicatifs dans cette première version : le calendrier complet doit être recollé depuis la source FIFA officielle avant verrouillage définitif.

Sources utilisées pour cadrer les données initiales :

- FIFA, calendrier officiel Coupe du Monde 2026 : https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums
- FourFourTwo, groupes et calendrier publiés en mai 2026 : https://www.fourfourtwo.com/features/fifa-world-cup-2026-dates-fixtures-stadiums-tickets-and-everything-you-need-to-know

## Limitations de cette première version

- Pas encore d’import CSV.
- Pas encore d’édition admin des horaires/stades.
- Les paris bonus sont saisis côté joueur, mais la saisie admin des résultats bonus n’est pas encore branchée au classement.
- Pas encore d’API automatique de résultats.
