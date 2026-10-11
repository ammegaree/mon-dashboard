// Loisirs : mes envies rangées en listes (à lire, à voir, à écouter, à essayer…).
//
// Une envie passe de « à faire » à « en cours » (facultatif) puis « terminé » : c'est là qu'on peut
// lui donner de 1 à 5 étoiles et écrire un avis. Aucune date limite, aucun « en retard » :
// une envie peut attendre aussi longtemps qu'elle veut.
// Règles et calculs seulement (pas d'affichage).

import { nouvelId } from '../schema.js';
import { aujourdhui } from '../dates.js';

const L = (d) => d.loisirs;

export const STATUTS = [
  { id: 'a-faire', nom: 'À faire' },
  { id: 'en-cours', nom: 'En cours' },
  { id: 'fini', nom: 'Terminé' },
];

// Les listes de départ (modifiables, supprimables, on peut en créer d'autres).
export const LISTES_PAR_DEFAUT = [
  { id: 'lire', nom: 'À lire', icone: '📖', auteur: true },
  { id: 'voir', nom: 'À voir', icone: '🎬', auteur: false },
  { id: 'ecouter', nom: 'À écouter', icone: '🎧', auteur: false },
  { id: 'essayer', nom: 'À essayer', icone: '🎯', auteur: false },
  { id: 'visiter', nom: 'À visiter', icone: '📍', auteur: false },
];

function texte(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

export function etoilesValides(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

// 4 → « ★★★★☆ »
export function texteEtoiles(n) {
  const e = etoilesValides(n);
  return e ? '★'.repeat(e) + '☆'.repeat(5 - e) : '';
}

// Un lien propre : « https://… » tel quel, « exemple.fr/page » devient « https://exemple.fr/page ».
// Tout autre genre d'adresse (javascript:, data:…) est refusé. Rend '' si ce n'est pas un lien web.
export function lienPropre(v) {
  const t = String(v ?? '').trim().slice(0, 500);
  if (!t || /\s/.test(t)) return '';
  if (/^https?:\/\/[^\s/]+/i.test(t)) return t;
  if (/^[^\s/:]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(t)) return `https://${t}`;
  return '';
}

// ---- Listes ----

export function listeParId(d, id) {
  return L(d).listes.find((l) => l.id === id) || null;
}

// `auteur` : la liste propose un champ « Auteur » sur chaque envie (utile pour les livres).
export function ajouterListe(d, { nom, icone = '✨', auteur = false }) {
  const n = texte(nom, 40);
  if (!n) return null;
  const liste = { id: nouvelId(), nom: n, icone: texte(icone, 8) || '✨', auteur: Boolean(auteur) };
  L(d).listes.push(liste);
  return liste;
}

export function modifierListe(d, id, { nom, icone, auteur }) {
  const l = listeParId(d, id);
  const n = texte(nom, 40);
  if (!l || !n) return null;
  l.nom = n;
  l.icone = texte(icone, 8) || '✨';
  if (auteur !== undefined) l.auteur = Boolean(auteur);
  return l;
}

// Supprimer une liste supprime aussi ses envies : on rend de quoi tout remettre (voir `restaurerListe`).
export function supprimerListe(d, id) {
  const i = L(d).listes.findIndex((l) => l.id === id);
  if (i === -1) return null;
  const [liste] = L(d).listes.splice(i, 1);
  const envies = L(d).envies.filter((e) => e.listeId === id);
  L(d).envies = L(d).envies.filter((e) => e.listeId !== id);
  return { liste, index: i, envies };
}

export function restaurerListe(d, retire) {
  if (!retire || L(d).listes.some((l) => l.id === retire.liste.id)) return;
  L(d).listes.splice(Math.min(retire.index, L(d).listes.length), 0, retire.liste);
  L(d).envies.push(...retire.envies);
}

// ---- Envies ----

export function envieParId(d, id) {
  return L(d).envies.find((e) => e.id === id) || null;
}

export function ajouterEnvie(d, { titre, listeId, note = '', lien = '', auteur = '' }) {
  const t = texte(titre, 160);
  if (!t || !listeParId(d, listeId)) return null;
  const envie = { id: nouvelId(), listeId, titre: t, auteur: texte(auteur, 100), note: texte(note, 600), lien: lienPropre(lien), statut: 'a-faire', etoiles: null, avis: '', creeLe: new Date().toISOString(), termineLe: null };
  L(d).envies.push(envie);
  return envie;
}

// `statut`, `etoiles`, `avis`, `termineLe` sont facultatifs : on ne touche que ce qui est donné.
export function modifierEnvie(d, id, valeurs) {
  const e = envieParId(d, id);
  if (!e) return null;
  if (valeurs.titre !== undefined) {
    const t = texte(valeurs.titre, 160);
    if (!t) return null;
    e.titre = t;
  }
  if (valeurs.listeId !== undefined && listeParId(d, valeurs.listeId)) e.listeId = valeurs.listeId;
  if (valeurs.auteur !== undefined) e.auteur = texte(valeurs.auteur, 100);
  if (valeurs.note !== undefined) e.note = texte(valeurs.note, 600);
  if (valeurs.lien !== undefined) e.lien = lienPropre(valeurs.lien);
  if (valeurs.statut !== undefined && STATUTS.some((s) => s.id === valeurs.statut)) {
    e.statut = valeurs.statut;
    if (e.statut === 'fini') e.termineLe = valeurs.termineLe || e.termineLe || aujourdhui();
    else e.termineLe = null;
  } else if (valeurs.termineLe !== undefined && e.statut === 'fini' && /^\d{4}-\d{2}-\d{2}$/.test(valeurs.termineLe)) {
    e.termineLe = valeurs.termineLe;
  }
  if (valeurs.etoiles !== undefined) e.etoiles = etoilesValides(valeurs.etoiles);
  if (valeurs.avis !== undefined) e.avis = texte(valeurs.avis, 2000);
  return e;
}

export function changerStatut(d, id, statut) {
  return modifierEnvie(d, id, { statut });
}

export function supprimerEnvie(d, id) {
  const i = L(d).envies.findIndex((e) => e.id === id);
  if (i === -1) return null;
  const [envie] = L(d).envies.splice(i, 1);
  return { envie, index: i };
}

export function restaurerEnvie(d, retire) {
  if (!retire || L(d).envies.some((e) => e.id === retire.envie.id)) return;
  L(d).envies.splice(Math.min(retire.index, L(d).envies.length), 0, retire.envie);
}

// ---- Lectures ----

export function enviesDeListe(d, listeId, statut = null) {
  return L(d).envies.filter((e) => e.listeId === listeId && (!statut || e.statut === statut));
}

export function enCours(d) {
  return L(d).envies.filter((e) => e.statut === 'en-cours' && listeParId(d, e.listeId));
}

export function comptes(d, listeId) {
  const envies = enviesDeListe(d, listeId);
  return {
    aFaire: envies.filter((e) => e.statut === 'a-faire').length,
    enCours: envies.filter((e) => e.statut === 'en-cours').length,
    fini: envies.filter((e) => e.statut === 'fini').length,
  };
}

// Les envies terminées, la plus récente d'abord. `listeId` : '' = toutes ; `etoilesMin` : 0 = toutes.
export function terminees(d, { listeId = '', etoilesMin = 0 } = {}) {
  return L(d)
    .envies.filter((e) => e.statut === 'fini' && (!listeId || e.listeId === listeId) && (!etoilesMin || (e.etoiles || 0) >= etoilesMin))
    .sort((a, b) => {
      const da = a.termineLe || '';
      const db = b.termineLe || '';
      return da === db ? (a.creeLe < b.creeLe ? 1 : -1) : da < db ? 1 : -1;
    });
}

// Moyenne des notes données (les terminées sans étoiles ne comptent pas). null s'il n'y en a aucune.
export function moyenneEtoiles(envies) {
  const notes = envies.map((e) => e.etoiles).filter(Boolean);
  if (notes.length === 0) return null;
  return Math.round((notes.reduce((t, n) => t + n, 0) / notes.length) * 10) / 10;
}

// ---- La roue : tirer une envie au hasard ----

// Les envies « à faire » parmi lesquelles tirer (`listeId` vide = toutes les listes).
export function candidates(d, listeId = '') {
  return L(d).envies.filter((e) => e.statut === 'a-faire' && listeParId(d, e.listeId) && (!listeId || e.listeId === listeId));
}

// Tire une envie. `exclure` : un identifiant à éviter (le tirage précédent), tant qu'il y a un autre choix.
// `hasard` : une fonction qui rend un nombre de 0 à 1 (pour les tests). Rend null s'il n'y a rien à tirer.
export function tirerEnvie(d, { listeId = '', exclure = null } = {}, hasard = Math.random) {
  let choix = candidates(d, listeId);
  if (choix.length > 1 && exclure) choix = choix.filter((e) => e.id !== exclure);
  if (choix.length === 0) return null;
  return choix[Math.min(choix.length - 1, Math.floor(hasard() * choix.length))];
}
