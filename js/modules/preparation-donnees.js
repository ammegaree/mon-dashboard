// Préparer ma semaine : cinq minutes guidées pour regarder la semaine qui vient (rendez-vous, priorités,
// sport, repas, sous). C'est le miroir du bilan du dimanche, tourné vers l'avant.
// On y choisit surtout des priorités ; le reste est un coup d'œil sur ce qui existe déjà.
// Ton : une invitation, jamais une obligation. Règles et calculs seulement (pas d'affichage).

import { elementsDuJour } from '../registry.js';
import { nouvelId } from '../schema.js';
import { ajouterJours, jourSemaine, lundiDe, joursEntre } from '../dates.js';
import { bilanDeLaSemaine, lirePriorites } from './bilan-donnees.js';
import { bilanDuMois, moisDe } from './budget-donnees.js';

const B = (d) => d.bilan;

// La semaine à préparer : la semaine qui vient si on est dimanche, sinon la semaine en cours.
export function semaineAPreparer(jour) {
  return jourSemaine(jour) === 0 ? ajouterJours(lundiDe(jour), 7) : lundiDe(jour);
}

export function preparationDeLaSemaine(d, lundi) {
  return (B(d).preparations || []).find((p) => p.lundi === lundi) || null;
}

// Le lundi à proposer sur l'accueil : seulement le dimanche et le lundi, et seulement si ce n'est pas déjà fait.
export function preparationEnAttente(d, jour) {
  const dow = jourSemaine(jour);
  if (dow !== 0 && dow !== 1) return null;
  const lundi = semaineAPreparer(jour);
  return preparationDeLaSemaine(d, lundi) ? null : lundi;
}

// Les priorités déjà choisies pour cette semaine, sinon celles notées lors du bilan de la semaine d'avant.
export function prioritesDepart(d, lundi) {
  const prep = preparationDeLaSemaine(d, lundi);
  if (prep && prep.priorites.length) return prep.priorites;
  const bilan = bilanDeLaSemaine(d, ajouterJours(lundi, -7));
  return bilan && bilan.priorites.length ? bilan.priorites : [];
}

// Crée ou met à jour la préparation d'une semaine. `priorites` : un texte (une par ligne) ou une liste.
export function enregistrerPreparation(d, { lundi, priorites }) {
  if (!B(d).preparations) B(d).preparations = [];
  const liste = (Array.isArray(priorites) ? priorites : lirePriorites(priorites)).map((p) => String(p).trim()).filter(Boolean).slice(0, 10);
  const maintenant = new Date().toISOString();
  const existante = preparationDeLaSemaine(d, lundi);
  if (existante) {
    existante.priorites = liste;
    existante.modifieLe = maintenant;
    return existante;
  }
  const p = { id: nouvelId(), lundi, priorites: liste, creeLe: maintenant, modifieLe: maintenant };
  B(d).preparations.push(p);
  return p;
}

export function supprimerPreparation(d, lundi) {
  const liste = B(d).preparations || [];
  const i = liste.findIndex((p) => p.lundi === lundi);
  if (i === -1) return null;
  const [preparation] = liste.splice(i, 1);
  return { preparation, index: i };
}

export function restaurerPreparation(d, retire) {
  if (!retire) return;
  if (!B(d).preparations) B(d).preparations = [];
  if (B(d).preparations.some((p) => p.id === retire.preparation.id)) return;
  B(d).preparations.splice(Math.min(retire.index, B(d).preparations.length), 0, retire.preparation);
}

// Un coup d'œil sur la semaine : ce qui est déjà prévu, jour par jour, et ce qui manque (sans jugement).
export function apercuSemaine(d, lundi, jour) {
  const dates = joursEntre(lundi, ajouterJours(lundi, 6));
  const jours = dates.map((date) => {
    const tous = elementsDuJour(date, d);
    const visibles = tous.filter((e) => !e.groupe && !e.discret);
    return {
      date,
      passe: date < jour,
      rdv: visibles.filter((e) => e.type === 'rdv').sort((a, b) => (a.heure || '').localeCompare(b.heure || '')),
      taches: visibles.filter((e) => e.type === 'tache'),
      seances: tous.filter((e) => e.source === 'seance-prevue'),
      echeances: tous.filter((e) => e.source === 'maison-echeance'),
      diner: d.nourriture.repas.find((r) => r.date === date && r.moment === 'diner') || null,
    };
  });

  const futurs = jours.filter((j) => !j.passe);
  // Le mois qui compte pour le budget : celui d'aujourd'hui s'il est dans la semaine, sinon celui du lundi.
  const dansLaSemaine = jour >= lundi && jour <= ajouterJours(lundi, 6);
  const budget = bilanDuMois(d, moisDe(dansLaSemaine ? jour : lundi), jour);

  return {
    lundi,
    jours,
    nbRdv: jours.reduce((n, j) => n + j.rdv.length, 0),
    nbTaches: jours.reduce((n, j) => n + j.taches.length, 0),
    nbSeances: jours.reduce((n, j) => n + j.seances.length, 0),
    nbDiners: jours.filter((j) => j.diner).length,
    joursSansDiner: futurs.filter((j) => !j.diner).map((j) => j.date),
    echeances: jours.flatMap((j) => j.echeances.map((e) => ({ ...e, date: j.date }))),
    budget: { reste: budget.reste, parJour: budget.parJour, configure: budget.revenus > 0 || budget.fixes > 0 },
  };
}
