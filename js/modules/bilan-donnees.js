// Bilan de la semaine : un récapitulatif automatique de ce qui a été fait, trois questions,
// des priorités pour la semaine suivante. Règles et calculs seulement (pas d'affichage).
// Ton : on met en avant ce qui a été fait ; on ne liste jamais ce qui ne l'a pas été.

import { elementsDuJour, estCoche } from '../registry.js';
import { nouvelId } from '../schema.js';
import { ajouterJours, jourSemaine, lundiDe, joursEntre, versCle } from '../dates.js';
import { moyennesCheckins } from './bien-etre-donnees.js';
import { seancesDeLaPeriode } from './sport-donnees.js';

const B = (d) => d.bilan;

const dateLocale = (iso) => versCle(new Date(iso));

// ---- Le récapitulatif automatique ----

export function recapSemaine(d, lundi) {
  const dimanche = ajouterJours(lundi, 6);

  // Choses faites, par catégorie (les routines et habitudes comptées à part ou avec leur catégorie).
  const parCategorie = new Map();
  let total = 0;
  let routines = 0;
  for (const date of joursEntre(lundi, dimanche)) {
    for (const item of elementsDuJour(date, d)) {
      if (item.type !== 'tache') continue;
      if (item.source === 'checkin' || item.source === 'seance-prevue') continue; // comptés plus bas
      if (!estCoche(d, item)) continue;
      if (item.groupe && item.groupe.startsWith('routine:')) {
        routines++;
        continue;
      }
      total++;
      parCategorie.set(item.categorieId, (parCategorie.get(item.categorieId) || 0) + 1);
    }
  }

  // Études
  const chapitres = d.etudes.chapitres
    .filter((c) => c.statutLe && ['en-cours', 'termine', 'revise'].includes(c.statut))
    .filter((c) => {
      const jour = dateLocale(c.statutLe);
      return jour >= lundi && jour <= dimanche;
    })
    .map((c) => ({ id: c.id, titre: c.titre, statut: c.statut }));
  const secondes = d.etudes.temps.filter((t) => t.date >= lundi && t.date <= dimanche).reduce((s, t) => s + t.secondes, 0);
  const resultats = d.etudes.resultats.filter((r) => {
    if (r.partiel) return false;
    const jour = dateLocale(r.date);
    return jour >= lundi && jour <= dimanche;
  });
  const qcm = {
    n: resultats.length,
    moyenne: resultats.length ? Math.round(resultats.reduce((s, r) => s + (r.total ? r.juste / r.total : 0), 0) / resultats.length * 100) : null,
  };

  // Sport
  const seances = seancesDeLaPeriode(d, lundi, dimanche);
  const sport = { n: seances.length, minutes: seances.reduce((s, x) => s + (x.dureeMin || 0), 0) };

  // Bien-être
  const m = moyennesCheckins(d, lundi, dimanche);

  return {
    lundi,
    taches: { total, routines, parCategorie: [...parCategorie.entries()].map(([categorieId, n]) => ({ categorieId, n })).sort((a, b) => b.n - a.n) },
    etudes: { chapitres, secondes, qcm },
    sport,
    bienEtre: { humeur: m.humeur, energie: m.energie, sommeilHeures: m.sommeilHeures, nbJours: m.nbJours },
  };
}

// Vrai s'il y a quelque chose à raconter (sinon on propose un message doux).
export function recapNonVide(r) {
  return (
    r.taches.total + r.taches.routines > 0 ||
    r.etudes.chapitres.length > 0 ||
    r.etudes.secondes > 0 ||
    r.etudes.qcm.n > 0 ||
    r.sport.n > 0 ||
    r.bienEtre.nbJours > 0 ||
    (r.avancees?.length || 0) > 0 // anciens bilans seulement : le brain dump n'est plus dans le récap
  );
}

export function messageRecap(r) {
  if (!recapNonVide(r)) return "Cette semaine a peut-être été calme, et c'est aussi une semaine. Prendre un moment pour toi, c'est déjà beaucoup ✦";
  const fait = r.taches.total + r.sport.n + r.etudes.chapitres.length + (r.avancees?.length || 0);
  if (fait >= 15) return 'Quelle semaine ! Regarde tout ce que tu as accompli ✦';
  if (fait >= 5) return 'Une belle semaine, avec de vrais pas en avant ✦';
  return 'Chaque pas compte, et cette semaine en a eu ✦';
}

// ---- Quand proposer le bilan ----

// La semaine à « bilanner » : celle qui se termine ce dimanche, ou, du lundi au samedi, la semaine passée.
export function semaineABilanner(aujourdhuiCle) {
  return jourSemaine(aujourdhuiCle) === 0 ? lundiDe(aujourdhuiCle) : ajouterJours(lundiDe(aujourdhuiCle), -7);
}

export function bilanDeLaSemaine(d, lundi) {
  return B(d).bilans.find((b) => b.lundi === lundi) || null;
}

// Le lundi de la semaine à proposer sur l'accueil, ou null si le bilan est déjà fait.
export function bilanEnAttente(d, aujourdhuiCle) {
  const lundi = semaineABilanner(aujourdhuiCle);
  return bilanDeLaSemaine(d, lundi) ? null : lundi;
}

// ---- Enregistrer ----

// Une priorité par ligne ; puces et lignes vides retirées.
export function lirePriorites(texte) {
  return String(texte || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

// Crée ou met à jour le bilan de la semaine ; le récapitulatif est figé à ce moment-là.
export function enregistrerBilan(d, { lundi, fiere, difficile, priorites }) {
  const maintenant = new Date().toISOString();
  const valeurs = {
    fiere: String(fiere || '').trim(),
    difficile: String(difficile || '').trim(),
    priorites: Array.isArray(priorites) ? priorites : lirePriorites(priorites),
    recap: recapSemaine(d, lundi),
    modifieLe: maintenant,
  };
  const existant = bilanDeLaSemaine(d, lundi);
  if (existant) {
    Object.assign(existant, valeurs);
    return existant;
  }
  const b = { id: nouvelId(), lundi, creeLe: maintenant, ...valeurs };
  B(d).bilans.push(b);
  return b;
}

export function supprimerBilan(d, id) {
  const index = B(d).bilans.findIndex((b) => b.id === id);
  if (index === -1) return null;
  const [bilan] = B(d).bilans.splice(index, 1);
  return { bilan, index };
}

export function restaurerBilan(d, { bilan, index }) {
  B(d).bilans.splice(Math.min(index, B(d).bilans.length), 0, bilan);
}

export function bilansPasses(d) {
  return [...B(d).bilans].sort((a, b) => (a.lundi < b.lundi ? 1 : -1));
}

// Les priorités choisies lors du bilan de la semaine précédente, affichées pendant la semaine en cours.
// Si la semaine a été préparée (page « Préparer ma semaine »), ce sont ses priorités qui comptent.
export function prioritesDeLaSemaine(d, dateCle) {
  const prep = (B(d).preparations || []).find((p) => p.lundi === lundiDe(dateCle));
  if (prep && prep.priorites.length) return prep.priorites;
  const precedente = ajouterJours(lundiDe(dateCle), -7);
  const b = bilanDeLaSemaine(d, precedente);
  return b && b.priorites.length ? b.priorites : [];
}
