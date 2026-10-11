// Administratif › Échéances : ce qui revient à date fixe (assurance, impôts, contrats…).
//
// Une échéance a une date, un rappel (« 2 semaines avant ») et éventuellement un retour régulier
// (chaque année…). Elle n'apparaît dans Aujourd'hui qu'à l'approche de sa date, et ne devient jamais
// « en retard » : si la date est passée, c'est simplement « à régler quand tu peux ».
// On n'y range jamais de mot de passe ni de numéro de compte : seulement des repères (où trouver le papier).
// Règles et calculs seulement (pas d'affichage).

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';
import { aujourdhui, ajouterJours, depuisCle, versCle } from '../dates.js';

const M = (d) => d.administratif;

export const REPETITIONS = [
  { mois: 0, nom: 'Une seule fois' },
  { mois: 1, nom: 'Chaque mois' },
  { mois: 3, nom: 'Tous les 3 mois' },
  { mois: 6, nom: 'Tous les 6 mois' },
  { mois: 12, nom: 'Chaque année' },
  { mois: 24, nom: 'Tous les 2 ans' },
  { mois: 120, nom: 'Tous les 10 ans' },
];

export const RAPPELS = [
  { jours: 7, nom: '1 semaine avant' },
  { jours: 14, nom: '2 semaines avant' },
  { jours: 30, nom: '1 mois avant' },
  { jours: 60, nom: '2 mois avant' },
];

export function nomRepetition(mois) {
  return REPETITIONS.find((r) => r.mois === mois)?.nom || `Tous les ${mois} mois`;
}

export function nomRappel(jours) {
  return RAPPELS.find((r) => r.jours === jours)?.nom || `${jours} jours avant`;
}

// Des idées : la date est à choisir (je ne devine jamais une date administrative).
export const IDEES_ECHEANCES = [
  { titre: 'Déclaration de revenus', repeteMois: 12, rappelJours: 30, note: 'Vérifie la date limite sur le site des impôts.' },
  { titre: "Assurance habitation : renouvellement", repeteMois: 12, rappelJours: 30, note: '' },
  { titre: 'Mutuelle : renouvellement', repeteMois: 12, rappelJours: 30, note: '' },
  { titre: 'Internet / mobile : fin d’engagement', repeteMois: 12, rappelJours: 30, note: 'Comparer les offres avant la date.' },
  { titre: 'Bail : date anniversaire', repeteMois: 12, rappelJours: 60, note: '' },
  { titre: 'Carte d’identité ou passeport', repeteMois: 120, rappelJours: 60, note: 'Les délais de rendez-vous peuvent être longs : mieux vaut anticiper.' },
  { titre: 'Faire le point sur mes abonnements', repeteMois: 12, rappelJours: 14, note: '' },
];

// ---- Dates ----

// Ajoute des mois en gardant le jour (le 31 janvier + 1 mois = le 28 ou 29 février).
export function ajouterMoisSurJour(cle, n) {
  const d = depuisCle(cle);
  const jour = d.getDate();
  const cible = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  cible.setDate(Math.min(jour, dernier));
  return versCle(cible);
}

function ecart(a, b) {
  const x = depuisCle(a);
  const y = depuisCle(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
}

// ---- Échéances ----

function dateOuNull(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null;
}

function repeteValide(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 1200) : 0;
}

function rappelValide(v) {
  if (v === '' || v === null || v === undefined) return 14;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 365) : 14;
}

export function ajouterEcheance(d, { titre, date, repeteMois, rappelJours, note }) {
  const e = {
    id: nouvelId(),
    titre: titre.trim(),
    date: dateOuNull(date),
    repeteMois: repeteValide(repeteMois),
    rappelJours: rappelValide(rappelJours),
    note: (note || '').trim(),
    faits: [], // [{ date: échéance concernée, faitLe: jour où c'est réglé }]
    archivee: false, // réglée pour de bon (échéance unique)
  };
  M(d).echeances.push(e);
  return e;
}

export function modifierEcheance(d, id, { titre, date, repeteMois, rappelJours, note }) {
  const e = echeanceParId(d, id);
  if (!e) return;
  e.titre = titre.trim();
  e.date = dateOuNull(date);
  e.repeteMois = repeteValide(repeteMois);
  e.rappelJours = rappelValide(rappelJours);
  e.note = (note || '').trim();
}

export function echeanceParId(d, id) {
  return M(d).echeances.find((e) => e.id === id) || null;
}

export function supprimerEcheance(d, id) {
  const index = M(d).echeances.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const [echeance] = M(d).echeances.splice(index, 1);
  return { echeance, index };
}

export function restaurerEcheance(d, { echeance, index }) {
  M(d).echeances.splice(Math.min(index, M(d).echeances.length), 0, echeance);
}

// « C'est réglé ». Une échéance qui revient passe à sa prochaine date ; une échéance unique est rangée.
export function marquerFaite(d, id, aujourdhuiCle = aujourdhui()) {
  const e = echeanceParId(d, id);
  if (!e || e.archivee) return;
  e.faits.push({ date: e.date, faitLe: aujourdhuiCle });
  if (e.repeteMois > 0 && e.date) {
    let suivante = ajouterMoisSurJour(e.date, e.repeteMois);
    // Si c'était très en avance, on ne propose pas une date déjà passée.
    while (suivante < aujourdhuiCle) suivante = ajouterMoisSurJour(suivante, e.repeteMois);
    e.date = suivante;
  } else {
    e.archivee = true;
  }
}

// Annule le dernier « réglé » : on revient à la date d'avant.
export function annulerFaite(d, id) {
  const e = echeanceParId(d, id);
  if (!e || e.faits.length === 0) return;
  const dernier = e.faits.pop();
  e.date = dernier.date;
  e.archivee = false;
}

export function faiteLe(e, jour) {
  return e.faits.some((f) => f.faitLe === jour);
}

// ---- Où en est chaque échéance ----

export function etatEcheance(e, aujourdhuiCle = aujourdhui()) {
  if (e.archivee) return { archivee: true, sansDate: false, visible: false, depassee: false, joursAvant: null };
  if (!e.date) return { archivee: false, sansDate: true, visible: false, depassee: false, joursAvant: null };
  const joursAvant = ecart(aujourdhuiCle, e.date);
  return {
    archivee: false,
    sansDate: false,
    joursAvant,
    depassee: joursAvant < 0,
    // « À régler bientôt » : dans la fenêtre du rappel, ou déjà passée et pas encore réglée.
    visible: joursAvant <= e.rappelJours,
  };
}

// Texte doux et court, relatif à aujourd'hui.
export function texteRelatif(etat) {
  if (etat.archivee) return 'réglée';
  if (etat.sansDate) return 'date à choisir';
  if (etat.depassee) return 'à régler quand tu peux';
  if (etat.joursAvant === 0) return "c'est aujourd'hui";
  if (etat.joursAvant === 1) return 'demain';
  if (etat.joursAvant >= 60) return `dans ${Math.round(etat.joursAvant / 30)} mois`;
  return `dans ${etat.joursAvant} jours`;
}

// « 15 mai » (avec l'année si ce n'est pas l'année en cours).
export function dateLisible(cle, aujourdhuiCle = aujourdhui()) {
  const annee = cle.slice(0, 4) !== aujourdhuiCle.slice(0, 4);
  return depuisCle(cle).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(annee ? { year: 'numeric' } : {}) });
}

// Les échéances à régler bientôt (fenêtre du rappel), les plus proches d'abord.
export function aRegler(d, aujourdhuiCle = aujourdhui()) {
  return M(d)
    .echeances.map((e) => ({ e, etat: etatEcheance(e, aujourdhuiCle) }))
    .filter((x) => x.etat.visible)
    .sort((a, b) => a.etat.joursAvant - b.etat.joursAvant);
}

// ---- Idées de départ ----

export function ajouterIdeesEcheances(d, titres) {
  let n = 0;
  for (const titre of titres) {
    const idee = IDEES_ECHEANCES.find((i) => i.titre === titre);
    if (!idee) continue;
    if (M(d).echeances.some((e) => e.titre.toLowerCase() === idee.titre.toLowerCase())) continue;
    ajouterEcheance(d, { ...idee, date: null });
    n++;
  }
  return n;
}

// ---- Ce qui alimente la journée ----

enregistrerFournisseur((date, donnees) => {
  const aujourdhuiCle = aujourdhui();
  const items = [];
  for (const e of donnees.administratif?.echeances || []) {
    const faiteCeJour = date <= aujourdhuiCle && faiteLe(e, date);
    const base = { source: 'maison-echeance', id: e.id, date, categorieId: 'administratif', type: 'tache' };
    if (faiteCeJour) {
      items.push({ ...base, titre: `📅 ${e.titre}`, fait: true, discret: e.date !== date });
      continue;
    }
    if (e.archivee || !e.date) continue;
    const etat = etatEcheance(e, aujourdhuiCle);
    if (date === e.date && date >= aujourdhuiCle) {
      // Le jour même : une chose à cocher (visible aussi dans la vue Semaine).
      items.push({ ...base, titre: `📅 Échéance : ${e.titre}`, fait: false });
    } else if (date === aujourdhuiCle && etat.visible) {
      // À l'approche (ou date passée) : un rappel doux dans Aujourd'hui seulement.
      items.push({ ...base, titre: `📅 ${e.titre} · ${texteRelatif(etat)}`, fait: false, discret: true });
    }
  }
  return items;
});
