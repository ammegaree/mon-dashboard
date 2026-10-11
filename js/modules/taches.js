// Tâches libres, ponctuelles ou qui reviennent toutes seules.
// Ce fichier ne touche pas à l'affichage : il décide seulement
// « quelle tâche tombe quel jour » et propose les actions (ajouter, modifier…).

import { enregistrerFournisseur, enregistrerReportable } from '../registry.js';
import { nouvelId } from '../schema.js';
import { JOURS, ajouterJours, jourDuMois, jourSemaine, joursDansLeMois } from '../dates.js';

// ---- Récurrence ----

// La tâche récurrente tombe-t-elle ce jour-là ?
export function survient(recurrence, date) {
  if (!recurrence) return false;
  if (date < recurrence.debut) return false;
  if (recurrence.fin && date > recurrence.fin) return false;
  if ((recurrence.exceptions || []).includes(date)) return false;

  switch (recurrence.frequence) {
    case 'jour':
      return true;
    case 'semaine': {
      const jours = recurrence.jours?.length ? recurrence.jours : [jourSemaine(recurrence.debut)];
      return jours.includes(jourSemaine(date));
    }
    case 'mois': {
      const voulu = jourDuMois(recurrence.debut);
      const dernier = joursDansLeMois(date);
      // Le 31 d'un mois qui n'a que 30 jours tombe le 30, etc.
      return jourDuMois(date) === Math.min(voulu, dernier);
    }
    default:
      return false;
  }
}

function listerJours(dows) {
  const noms = JOURS.filter((j) => dows.includes(j.dow)).map((j) => j.long);
  if (noms.length <= 1) return noms.join('');
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

export function decrireRecurrence(recurrence) {
  if (!recurrence) return 'Une seule fois';
  switch (recurrence.frequence) {
    case 'jour':
      return 'Tous les jours';
    case 'semaine': {
      const jours = recurrence.jours?.length ? recurrence.jours : [jourSemaine(recurrence.debut)];
      if (jours.length === 7) return 'Tous les jours';
      return `Chaque ${listerJours(jours)}`;
    }
    case 'mois':
      return `Le ${jourDuMois(recurrence.debut)} de chaque mois`;
    default:
      return '';
  }
}

// ---- Fournisseur : ce qui tombe un jour donné ----

function elementDeTache(tache, date) {
  return {
    source: 'tache',
    id: tache.id,
    date,
    titre: tache.titre,
    categorieId: tache.categorieId,
    type: 'tache',
    recurrent: Boolean(tache.recurrence),
  };
}

enregistrerFournisseur((date, donnees) =>
  donnees.taches
    .filter((t) =>
      t.recurrence ? survient(t.recurrence, date) : t.date === date && !t.abandonnee
    )
    .map((t) => elementDeTache(t, date))
);

// ---- Report des tâches non faites ----

// Tâches ponctuelles passées, ni faites ni abandonnées.
export function tachesEnRetard(donnees, aujourdhuiCle) {
  return donnees.taches
    .filter((t) => !t.recurrence && !t.abandonnee && t.date < aujourdhuiCle)
    .filter((t) => !donnees.coches[`tache|${t.id}|${t.date}`])
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---- Actions (à utiliser avec store.modifier) ----

function nettoyerRecurrence(rec, dateDebut) {
  if (!rec) return null;
  const propre = {
    frequence: rec.frequence,
    debut: dateDebut,
    fin: rec.fin || null,
    exceptions: rec.exceptions || [],
  };
  if (rec.frequence === 'semaine') {
    propre.jours = rec.jours?.length ? [...rec.jours] : [jourSemaine(dateDebut)];
  }
  return propre;
}

export function ajouterTache(donnees, { titre, categorieId, date, recurrence }) {
  const tache = {
    id: nouvelId(),
    titre: titre.trim(),
    categorieId,
    date,
    recurrence: nettoyerRecurrence(recurrence, date),
    abandonnee: false,
    creeLe: new Date().toISOString(),
  };
  donnees.taches.push(tache);
  return tache;
}

export function modifierTache(donnees, id, { titre, categorieId, date, recurrence }) {
  const tache = donnees.taches.find((t) => t.id === id);
  if (!tache) return;
  tache.titre = titre.trim();
  tache.categorieId = categorieId;
  tache.date = date;
  const ancienne = tache.recurrence;
  tache.recurrence = nettoyerRecurrence(recurrence, date);
  if (tache.recurrence && ancienne) tache.recurrence.exceptions = ancienne.exceptions || [];
}

export function supprimerTache(donnees, id) {
  const index = donnees.taches.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const [tache] = donnees.taches.splice(index, 1);
  return { tache, index };
}

export function restaurerTache(donnees, { tache, index }) {
  donnees.taches.splice(Math.min(index, donnees.taches.length), 0, tache);
}

export function reporterTache(donnees, id, nouvelleDate) {
  const tache = donnees.taches.find((t) => t.id === id);
  if (!tache || tache.recurrence) return;
  tache.date = nouvelleDate;
  tache.reporteeLe = new Date().toISOString();
}

export function laisserPartir(donnees, id) {
  const tache = donnees.taches.find((t) => t.id === id);
  if (tache) tache.abandonnee = true;
}

export function passerCetteFois(donnees, id, date) {
  const tache = donnees.taches.find((t) => t.id === id);
  if (!tache?.recurrence) return;
  tache.recurrence.exceptions = [...new Set([...(tache.recurrence.exceptions || []), date])];
}

export function basculerCoche(donnees, cle) {
  if (donnees.coches[cle]) {
    delete donnees.coches[cle];
    return false;
  }
  donnees.coches[cle] = new Date().toISOString();
  return true;
}

enregistrerReportable('tache', {
  lister: (donnees, reel) =>
    tachesEnRetard(donnees, reel).map((t) => ({ source: 'tache', id: t.id, titre: t.titre, categorieId: t.categorieId, date: t.date })),
  reporter: reporterTache,
  abandonner: laisserPartir,
});

export { ajouterJours };
