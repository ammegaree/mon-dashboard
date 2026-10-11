// Budget : ce que les onglets se partagent (le mois regardé, les filtres, ce qui est ouvert) et la barre de mois.

import { h } from '../ui.js';
import { aujourdhui, formatMois, depuisCle } from '../dates.js';
import { moisDe, decalerMois } from './budget-donnees.js';

// mois : null = le mois en cours.
const etat = { mois: null, poste: '', objectif: null, pret: null, reglageOuvert: false, toutesDepenses: false };

export function moisVu() {
  return etat.mois || moisDe(aujourdhui());
}

export function choisirMois(mois) {
  etat.mois = mois === moisDe(aujourdhui()) ? null : mois;
  etat.toutesDepenses = false;
}

// Ce qui est ouvert : un objectif, un prêt, le réglage du budget, toutes les dépenses…
export const ecran = {
  get objectif() {
    return etat.objectif;
  },
  set objectif(v) {
    etat.objectif = v;
  },
  get pret() {
    return etat.pret;
  },
  set pret(v) {
    etat.pret = v;
  },
  get reglageOuvert() {
    return etat.reglageOuvert;
  },
  set reglageOuvert(v) {
    etat.reglageOuvert = Boolean(v);
  },
  get toutesDepenses() {
    return etat.toutesDepenses;
  },
  set toutesDepenses(v) {
    etat.toutesDepenses = Boolean(v);
  },
};

// « 30 juin 2027 »
const fmtDateLongue = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
export function dateLongue(cle) {
  return fmtDateLongue.format(depuisCle(cle));
}

export function posteFiltre() {
  return etat.poste;
}

export function choisirPoste(posteId) {
  etat.poste = posteId || '';
  etat.toutesDepenses = false;
}

export function reinitialiserBudget() {
  Object.assign(etat, { mois: null, poste: '', objectif: null, pret: null, reglageOuvert: false, toutesDepenses: false });
}

// « ◀ Octobre 2026 ▶ » (+ « Ce mois-ci » quand on est ailleurs).
export function barreMois(redessiner) {
  const reel = moisDe(aujourdhui());
  const vu = moisVu();
  const aller = (n) => {
    choisirMois(decalerMois(vu, n));
    redessiner();
  };
  return h(
    'div',
    { class: 'barre-mois' },
    h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Mois précédent', onclick: () => aller(-1) }, '◀'),
    h('strong', { class: 'barre-mois-nom' }, formatMois(`${vu}-01`)),
    h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Mois suivant', onclick: () => aller(1) }, '▶'),
    vu !== reel &&
      h(
        'button',
        {
          class: 'bouton bouton-petit',
          type: 'button',
          onclick: () => {
            choisirMois(reel);
            redessiner();
          },
        },
        'Ce mois-ci'
      )
  );
}
