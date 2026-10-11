// Brain dump : des idées notées en vrac (avec ou sans catégorie), puis rangées ou transformées en tâches.
// + suivi du corps (optionnel).
// Règles et calculs seulement (pas d'affichage).

import { nouvelId } from '../schema.js';
import { ajouterJours, lundiDe } from '../dates.js';

const C = (d) => d.carnet;

// ---- Notes ----

export function ajouterNote(d, { texte, categorieId, date }) {
  const maintenant = new Date().toISOString();
  const n = { id: nouvelId(), date, texte: texte.trim(), categorieId: categorieId || null, creeLe: maintenant, modifieLe: maintenant };
  C(d).notes.push(n);
  return n;
}

// Un « vide-tête » : une idée par ligne, puces et numéros ignorés.
export function ajouterIdees(d, { texte, categorieId, date }) {
  return String(texte || '')
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean)
    .map((ligne) => ajouterNote(d, { texte: ligne, categorieId, date }));
}

export function modifierNote(d, id, { texte, categorieId, date }) {
  const n = C(d).notes.find((x) => x.id === id);
  if (!n) return;
  n.texte = texte.trim();
  n.categorieId = categorieId || null;
  n.date = date;
  n.modifieLe = new Date().toISOString();
}

export function supprimerNote(d, id) {
  const index = C(d).notes.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [note] = C(d).notes.splice(index, 1);
  return { note, index };
}

export function restaurerNote(d, { note, index }) {
  C(d).notes.splice(Math.min(index, C(d).notes.length), 0, note);
}

function sansAccents(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Lecture chronologique complète (la plus récente d'abord) ou filtrée par domaine et/ou texte.
// categorieId : '' (tout), SANS_CATEGORIE (pas encore rangées) ou l'identifiant d'une catégorie.
export const SANS_CATEGORIE = '__sans';

export function notesFiltrees(d, { categorieId = '', texte = '' } = {}) {
  const mots = sansAccents(texte).split(/\s+/).filter(Boolean);
  return C(d)
    .notes.filter((n) => !categorieId || (categorieId === SANS_CATEGORIE ? !n.categorieId : n.categorieId === categorieId))
    .filter((n) => !mots.length || mots.every((m) => sansAccents(n.texte).includes(m)))
    .sort((a, b) => (a.date === b.date ? (a.creeLe < b.creeLe ? 1 : -1) : a.date < b.date ? 1 : -1));
}

export function compteParDomaine(d) {
  const compte = new Map();
  for (const n of C(d).notes) {
    const cle = n.categorieId || SANS_CATEGORIE;
    compte.set(cle, (compte.get(cle) || 0) + 1);
  }
  return compte;
}

// Notes d'une période (pour le bilan de la semaine).
export function notesDeLaPeriode(d, debut, fin) {
  return C(d).notes.filter((n) => n.date >= debut && n.date <= fin);
}

// ---- Suivi du corps (optionnel) ----

export function lireNombre(texte) {
  if (texte === '' || texte === null || texte === undefined) return null;
  const n = Number(String(texte).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function definirSuiviCorps(d, actif) {
  C(d).corps.actif = Boolean(actif);
}

export function definirChampSuivi(d, champId, suivi) {
  const c = C(d).corps.champs.find((x) => x.id === champId);
  if (c) c.suivi = Boolean(suivi);
}

export function ajouterChamp(d, { nom, unite }) {
  const nomNet = nom.trim();
  let id = sansAccents(nomNet).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mesure';
  const existants = new Set(C(d).corps.champs.map((c) => c.id));
  let base = id;
  let n = 2;
  while (existants.has(id)) id = `${base}-${n++}`;
  const champ = { id, nom: nomNet, unite: (unite || '').trim(), suivi: true };
  C(d).corps.champs.push(champ);
  return champ;
}

// valeurs : { champId: nombre ou texte }. Les champs vides sont ignorés ; une mesure vide n'est pas créée.
export function ajouterMesure(d, { date, valeurs }) {
  const propres = {};
  for (const [cle, v] of Object.entries(valeurs || {})) {
    const n = lireNombre(v);
    if (n !== null) propres[cle] = n;
  }
  if (!Object.keys(propres).length) return null;
  const m = { id: nouvelId(), date, valeurs: propres };
  C(d).corps.mesures.push(m);
  return m;
}

export function modifierMesure(d, id, { date, valeurs }) {
  const m = C(d).corps.mesures.find((x) => x.id === id);
  if (!m) return;
  const propres = {};
  for (const [cle, v] of Object.entries(valeurs || {})) {
    const n = lireNombre(v);
    if (n !== null) propres[cle] = n;
  }
  m.date = date;
  m.valeurs = propres;
}

export function supprimerMesure(d, id) {
  const index = C(d).corps.mesures.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [mesure] = C(d).corps.mesures.splice(index, 1);
  return { mesure, index };
}

export function restaurerMesure(d, { mesure, index }) {
  C(d).corps.mesures.splice(Math.min(index, C(d).corps.mesures.length), 0, mesure);
}

// Tendance hebdomadaire d'une mesure : la moyenne de chaque semaine (du lundi au dimanche)
// où elle a été prise, des plus anciennes aux plus récentes.
export function tendanceHebdo(d, champId, { semaines = 12, aujourdhuiCle } = {}) {
  const parSemaine = new Map();
  for (const m of C(d).corps.mesures) {
    const v = m.valeurs[champId];
    if (typeof v !== 'number') continue;
    const lundi = lundiDe(m.date);
    if (!parSemaine.has(lundi)) parSemaine.set(lundi, []);
    parSemaine.get(lundi).push(v);
  }
  let lundis = [...parSemaine.keys()].sort();
  if (aujourdhuiCle) {
    const limite = ajouterJours(lundiDe(aujourdhuiCle), -7 * (semaines - 1));
    lundis = lundis.filter((l) => l >= limite);
  } else {
    lundis = lundis.slice(-semaines);
  }
  return lundis.map((lundi) => {
    const vals = parSemaine.get(lundi);
    return { lundi, valeur: vals.reduce((t, v) => t + v, 0) / vals.length, n: vals.length };
  });
}

export function formaterMesure(valeur, unite = '') {
  if (valeur === null || valeur === undefined) return '—';
  const texte = (Math.round(valeur * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return unite ? `${texte} ${unite}` : texte;
}
