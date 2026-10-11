// Budget › Prêt : suivre le remboursement d'un prêt (étudiant, personnel…).
//
// On note ce qu'on a emprunté, la mensualité et, si on le connaît, le taux. À chaque paiement noté,
// le « reste à rembourser » est recalculé (les intérêts du mois sont retirés du paiement).
// Ce sont des repères, pas le tableau officiel de la banque : les centimes peuvent différer un peu.
// Règles et calculs seulement (pas d'affichage).

import { nouvelId } from '../schema.js';
import { aujourdhui } from '../dates.js';
import { arrondir, lireMontant, lireTaux, moisDe, decalerMois, somme, texteCourt, dateValide } from './budget-montants.js';

const P = (d) => d.budget.prets;

export function pretParId(d, id) {
  return P(d).find((p) => p.id === id) || null;
}

function valeurs({ nom, icone, capital, taux, mensualite, debut }) {
  const n = texteCourt(nom, 60);
  const c = lireMontant(capital);
  const m = lireMontant(mensualite);
  const t = lireTaux(taux);
  if (!n || !c || !m || t === null) return null;
  return { nom: n, icone: texteCourt(icone, 8) || '🏦', capital: c, mensualite: m, taux: t, debut: dateValide(debut) };
}

export function ajouterPret(d, brut) {
  const v = valeurs(brut);
  if (!v) return null;
  const pret = { id: nouvelId(), ...v, paiements: [], creeLe: new Date().toISOString() };
  P(d).push(pret);
  return pret;
}

export function modifierPret(d, id, brut) {
  const pret = pretParId(d, id);
  const v = valeurs(brut);
  if (!pret || !v) return null;
  Object.assign(pret, v);
  return pret;
}

export function supprimerPret(d, id) {
  const i = P(d).findIndex((p) => p.id === id);
  if (i === -1) return null;
  const [pret] = P(d).splice(i, 1);
  return { pret, index: i };
}

export function restaurerPret(d, retire) {
  if (!retire || P(d).some((p) => p.id === retire.pret.id)) return;
  P(d).splice(Math.min(retire.index, P(d).length), 0, retire.pret);
}

export function ajouterPaiement(d, pretId, { montant, date, note = '' }) {
  const pret = pretParId(d, pretId);
  const m = lireMontant(montant);
  if (!pret || m === null || m === 0) return null;
  const paiement = { id: nouvelId(), date: dateValide(date) || aujourdhui(), montant: m, note: texteCourt(note, 120) };
  pret.paiements.push(paiement);
  return paiement;
}

export function modifierPaiement(d, pretId, id, { montant, date, note = '' }) {
  const paiement = pretParId(d, pretId)?.paiements.find((x) => x.id === id);
  const m = lireMontant(montant);
  if (!paiement || m === null || m === 0) return null;
  paiement.montant = m;
  paiement.date = dateValide(date) || paiement.date;
  paiement.note = texteCourt(note, 120);
  return paiement;
}

export function supprimerPaiement(d, pretId, id) {
  const pret = pretParId(d, pretId);
  const i = pret ? pret.paiements.findIndex((x) => x.id === id) : -1;
  if (i === -1) return null;
  const [paiement] = pret.paiements.splice(i, 1);
  return { pretId, paiement, index: i };
}

export function restaurerPaiement(d, retire) {
  const pret = retire && pretParId(d, retire.pretId);
  if (!pret || pret.paiements.some((x) => x.id === retire.paiement.id)) return;
  pret.paiements.splice(Math.min(retire.index, pret.paiements.length), 0, retire.paiement);
}

const MAX_MOIS = 1200;

// Où en est le prêt : reste à rembourser, part déjà remboursée, fin prévue.
export function etatPret(pret, jour = aujourdhui()) {
  const intMensuel = (restant) => (pret.taux > 0 ? (restant * pret.taux) / 1200 : 0);
  let restant = pret.capital;
  let interets = 0;
  const tries = [...pret.paiements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const p of tries) {
    if (restant <= 0) break;
    const i = intMensuel(restant);
    interets += Math.min(i, p.montant);
    restant = Math.max(0, restant - (p.montant - i));
  }
  restant = arrondir(restant);

  const mois = moisDe(jour);
  const payeCeMois = pret.paiements.some((p) => moisDe(p.date) === mois);

  // Projection : on continue à payer la mensualité jusqu'à la fin.
  let n = 0;
  let projete = restant;
  let insuffisant = false;
  while (projete > 0.005 && n < MAX_MOIS) {
    const i = intMensuel(projete);
    if (pret.mensualite <= i && pret.taux > 0) {
      insuffisant = true;
      break;
    }
    projete -= pret.mensualite - i;
    n++;
  }
  if (n >= MAX_MOIS && projete > 0.005) insuffisant = true;

  const premierMois = payeCeMois ? decalerMois(mois, 1) : mois;
  return {
    restant,
    rembourse: arrondir(pret.capital - restant),
    ratio: pret.capital > 0 ? Math.min(1, (pret.capital - restant) / pret.capital) : 0,
    termine: restant <= 0.005,
    interets: arrondir(interets),
    payeCeMois,
    moisRestants: restant > 0.005 && !insuffisant ? n : null,
    finPrevue: restant > 0.005 && !insuffisant && n > 0 ? decalerMois(premierMois, n - 1) : null,
    insuffisant,
  };
}

// Ce qui a été payé pendant un mois, tous prêts confondus.
export function pretDuMois(d, mois) {
  return somme(P(d).flatMap((p) => p.paiements.filter((x) => moisDe(x.date) === mois)));
}

export function resteTotalPrets(d, jour = aujourdhui()) {
  return arrondir(P(d).reduce((t, p) => t + etatPret(p, jour).restant, 0));
}

export function capitalTotalPrets(d) {
  return arrondir(P(d).reduce((t, p) => t + p.capital, 0));
}
