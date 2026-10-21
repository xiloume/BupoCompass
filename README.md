# BupoCompass

**Game Completion Tracker** — Overlay assistant pour le 100% dans les jeux vidéo.

## Fonctionnalités MVP

- Overlay transparent always-on-top
- Création de profils par jeu
- Zones avec items à compléter
- Compteurs incrémentaux (+/-)
- Barres de progression par zone et globale
- Mode compact
- Sauvegarde locale automatique (localStorage)
- Import/Export JSON
- Raccourcis clavier globaux (F9 toggle, F10 mode interactif)

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Cela lance Vite (port 5173) puis Electron en parallèle.

## Build / Package (.exe Windows)

```bash
npm run dist:win
```

Génère dans `release/` :

- `BupoCompass Setup 0.1.0.exe` — installateur NSIS (raccourcis bureau + menu Démarrer)
- `BupoCompass-0.1.0-portable.exe` — **exécutable portable**, aucune installation requise

En mode packagé, les données inscriptibles vont dans `%APPDATA%/bupo-compass` :

- `games/registry.json` — templates de jeux (le fichier livré sert de base)
- `steam-config.bin` — SteamID / clé API (chiffrés)

Un `.env` posé **à côté de l'exécutable** est également lu (`STEAM_API_KEY`,
`STEAM_ID`, `STEAM_LANG`).

## Succès en français

Les noms et descriptifs des succès sont affichés dans la langue configurée
(**français par défaut**), modifiable via ⚙ → *Langue des succès*.
Dans la checklist, **cliquer sur le nom d'un succès** déplie son descriptif.

Si un jeu a été importé avant cette version, ré-importe son template
(*Templates → Mes templates → Importer*) : les libellés sont retraduits et les
descriptifs complétés, sans dupliquer les zones ni perdre la progression.

### Comment la traduction est obtenue

Sans clé API, l'endpoint par profil
`/profiles/<id>/stats/<appid>/achievements/?xml=1&l=<lang>` **ignore le paramètre
`l`** : il répond toujours dans la langue par défaut du jeu (vérifié : les
réponses `french` et `english` sont identiques à l'octet près). Il fournit en
revanche l'`apiname` et l'état débloqué/verrouillé.

Les pages **HTML**, elles, respectent bien `l` — mais n'exposent pas d'`apiname` :

- `/stats/<appid>/achievements/?l=<lang>` (globale) : liste tous les succès, mais
  laisse **vide le descriptif des succès masqués**
- `/profiles/<id>/stats/<appid>/achievements/?l=<lang>` (profil) : révèle le
  descriptif des succès masqués **déjà débloqués**, mais omet ceux encore
  verrouillés

`desktop/steamLocalization.js` récupère chaque page dans la langue cible **et** en
anglais, associe les deux par index (même endpoint donc même ordre), ce qui donne
`libellé anglais → libellé traduit`, puis **fusionne les deux sources** avant de
l'appliquer aux entrées du profil.

Attention : associer une page au XML du profil **par index serait faux**, le XML
étant trié par date de déblocage et les pages par rareté (concordance mesurée :
26/55 seulement).

Limite résiduelle : un succès à la fois **masqué et encore verrouillé** n'a son
descriptif publié nulle part publiquement ; le descriptif anglais est alors
conservé (mesuré : 2 sur 55). Renseigner une **clé API** dans ⚙ lève cette limite,
`GetSchemaForGame` retournant tout, y compris les masqués, dans la langue
demandée. Un jeu sans traduction officielle reste évidemment dans sa langue
d'origine.

## Synchronisation avec le profil

Le rapprochement se fait en priorité sur la **clé Steam** (`apiname`), qui est
indépendante de la langue : un succès verrouillé côté Steam décoche l'item
correspondant, et un succès débloqué le coche. Le rapprochement par nom ne sert
que de repli pour les items créés avant le stockage de la clé, et **ne fait que
cocher** — jamais décocher — pour éviter qu'une correspondance approximative
erronée détruise de la progression.

## Raccourcis

| Raccourci | Action |
|-----------|--------|
| `F9` | Afficher / Masquer l'overlay |
| `F10` | Basculer mode interactif (click-through) |

## Stack technique

- **Electron** — Fenêtre overlay transparente
- **React 18** — Interface utilisateur
- **Zustand** — State management avec persistence
- **TailwindCSS** — Styling
- **Vite** — Build tool
