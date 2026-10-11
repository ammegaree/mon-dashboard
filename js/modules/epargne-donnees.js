// Budget › Économies : des objectifs (vacances, imprévus, ordinateur…) et l'argent mis de côté pour chacun.
//
// Un versement est un montant daté : positif quand on met de côté, négatif quand on reprend de l'argent.
// Aucun jugement : sans date limite, un objectif n'est « en retard » de rien. Avec une date, on montre
// simplement ce que ça représente par mois.
// Règles et calculs seulement (pas d'affichage).

import { nouvelId } from '../schema.js';
import { aujourdhui } from '../dates.js';
import { arrondir, lireMontant, moisDe, somme, texteCourt, dateValide } from './budget-montants.js';

const O = (d) => d.budget.objectifs;

export const IDEES_OBJECTIFS = [
  { nom: 'Imprévus', icone: '🛟' },
  { nom: 'Vacances', icone: '🏖️' },
  { nom: 'Ordinateur', icone: '💻' },
  { nom: 'Permis', icone: '🚗' },
  { nom: 'Voyage', icone: '✈️' },
  { nom: 'Cadeau', icone: '🎁' },
];

export function objectifParId(d, id) {
  return O(d).find((o) => o.id === id) || null;
}

function cibleValide(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const m = lireMontant(v);
  return m && m > 0 ? m : null;
}

export function ajouterObjectif(d, { nom, icone = '🎯', cible = null, echeance = null }) {
  const n = texteCourt(nom, 60);
  if (!n) return null;
  const o = { id: nouvelId(), nom: n, icone: texteCourt(icone, 8) || '🎯', cible: cibleValide(cible), echeance: dateValide(echeance), versements: [], creeLe: new Date().toISOString() };
  O(d).push(o);
  return o;
}

export function modifierObjectif(d, id, { nom, icone, cible, echeance }) {
  const o = objectifParId(d, id);
  const n = texteCourt(nom, 60);
  if (!o || !n) return null;
  o.nom = n;
  o.icone = texteCourt(icone, 8) || '🎯';
  o.cible = cibleValide(cible);
  o.echeance = dateValide(echeance);
  return o;
}

export function supprimerObjectif(d, id) {
  const i = O(d).findIndex((o) => o.id === id);
  if (i === -1) return null;
  const [objectif] = O(d).splice(i, 1);
  return { objectif, index: i };
}

export function restaurerObjectif(d, retire) {
  if (!retire || O(d).some((o) => o.id === retire.objectif.id)) return;
  O(d).splice(Math.min(retire.index, O(d).length), 0, retire.objectif);
}

export function totalObjectif(o) {
  return somme(o.versements);
}

// `montant` : toujours positif ; `retrait` : true pour reprendre de l'argent. Rend null si c'est invalide
// (montant vide, ou retrait supérieur à ce qui est de côté).
export function ajouterVersement(d, objectifId, { montant, date, note = '', retrait = false }) {
  const o = objectifParId(d, objectifId);
  const m = lireMontant(montant);
  if (!o || m === null || m === 0) return null;
  if (retrait && m > totalObjectif(o)) return null;
  const v = { id: nouvelId(), date: dateValide(date) || aujourdhui(), montant: retrait ? -m : m, note: texteCourt(note, 120) };
  o.versements.push(v);
  return v;
}

export function modifierVersement(d, objectifId, id, { montant, date, note = '', retrait = false }) {
  const o = objectifParId(d, objectifId);
  const v = o?.versements.find((x) => x.id === id);
  const m = lireMontant(montant);
  if (!v || m === null || m === 0) return null;
  const sansLui = arrondir(totalObjectif(o) - v.montant);
  if (arrondir(sansLui + (retrait ? -m : m)) < 0) return null;
  v.montant = retrait ? -m : m;
  v.date = dateValide(date) || v.date;
  v.note = texteCourt(note, 120);
  return v;
}

export function supprimerVersement(d, objectifId, id) {
  const o = objectifParId(d, objectifId);
  const i = o ? o.versements.findIndex((x) => x.id === id) : -1;
  if (i === -1) return null;
  const [versement] = o.versements.splice(i, 1);
  return { objectifId, versement, index: i };
}

export function restaurerVersement(d, retire) {
  const o = retire && objectifParId(d, retire.objectifId);
  if (!o || o.versements.some((x) => x.id === retire.versement.id)) return;
  o.versements.splice(Math.min(retire.index, o.versements.length), 0, retire.versement);
}

// Où en est un objectif. `parMois` : ce que ça représente chaque mois d'ici la date choisie (si elle existe).
export function etatObjectif(o, jour = aujourdhui()) {
  const total = totalObjectif(o);
  const reste = o.cible ? arrondir(Math.max(0, o.cible - total)) : null;
  let parMois = null;
  if (o.cible && o.echeance && reste > 0 && o.echeance >= jour) {
    const [a1, m1] = moisDe(jour).split('-').map(Number);
    const [a2, m2] = moisDe(o.echeance).split('-').map(Number);
    const mois = Math.max(1, (a2 - a1) * 12 + (m2 - m1));
    parMois = arrondir(reste / mois);
  }
  return {
    total,
    cible: o.cible,
    reste,
    ratio: o.cible ? Math.min(1, total / o.cible) : 0,
    atteint: Boolean(o.cible) && total >= o.cible,
    parMois,
  };
}

// Ce qui a été mis de côté (net) pendant un mois, tous objectifs confondus.
export function epargneDuMois(d, mois) {
  return somme(O(d).flatMap((o) => o.versements.filter((v) => moisDe(v.date) === mois)));
}

export function totalEpargne(d) {
  return somme(O(d).map((o) => ({ montant: totalObjectif(o) })));
}

// Somme des cibles des objectifs qui en ont une (pour la barre globale).
export function totalCibles(d) {
  const avecCible = O(d).filter((o) => o.cible);
  return {
    cible: somme(avecCible, 'cible'),
    verse: somme(avecCible.map((o) => ({ montant: totalObjectif(o) }))),
    nb: avecCible.length,
  };
}
