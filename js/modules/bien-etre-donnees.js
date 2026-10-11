// Bien-être : check-in du jour, journal, habitudes, motivation.
// Règles et calculs seulement (pas d'affichage).

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';
import { aujourdhui, ajouterJours, jourSemaine, lundiDe, depuisCle, premierDuMois, dernierDuMois, ajouterMois, joursEntre } from '../dates.js';

const B = (d) => d.bienEtre;

// ---- Échelles du check-in ----

export const HUMEURS = [
  { v: 1, emoji: '😞', nom: 'Difficile' },
  { v: 2, emoji: '😕', nom: 'Bof' },
  { v: 3, emoji: '😐', nom: 'Neutre' },
  { v: 4, emoji: '🙂', nom: 'Bien' },
  { v: 5, emoji: '😄', nom: 'Super' },
];

export const ENERGIES = [
  { v: 1, emoji: '🪫', nom: 'Très basse' },
  { v: 2, emoji: '😴', nom: 'Basse' },
  { v: 3, emoji: '🌤️', nom: 'Moyenne' },
  { v: 4, emoji: '⚡', nom: 'Bonne' },
  { v: 5, emoji: '🔥', nom: 'Pleine' },
];

export const QUALITES_SOMMEIL = [
  { v: 1, nom: 'Agité' },
  { v: 2, nom: 'Léger' },
  { v: 3, nom: 'Correct' },
  { v: 4, nom: 'Bon' },
  { v: 5, nom: 'Réparateur' },
];

// ---- Check-in (un par date) ----

export function checkinDuJour(d, date) {
  return B(d).checkins.find((c) => c.date === date) || null;
}

function nombreOuNull(v, min, max) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

// Crée ou remplace le check-in de la date. Un check-in sans aucune valeur est supprimé.
export function enregistrerCheckin(d, { date, humeur, energie, sommeilHeures, sommeilQualite, note }) {
  const valeurs = {
    humeur: nombreOuNull(humeur, 1, 5),
    energie: nombreOuNull(energie, 1, 5),
    sommeilHeures: nombreOuNull(sommeilHeures, 0, 24),
    sommeilQualite: nombreOuNull(sommeilQualite, 1, 5),
    note: (note || '').trim(),
  };
  const vide = Object.values(valeurs).every((v) => v === null || v === '');
  const existant = checkinDuJour(d, date);
  if (vide) {
    if (existant) B(d).checkins = B(d).checkins.filter((c) => c !== existant);
    return null;
  }
  if (existant) {
    Object.assign(existant, valeurs);
    return existant;
  }
  const c = { id: nouvelId(), date, ...valeurs };
  B(d).checkins.push(c);
  return c;
}

// Moyennes sur une période (bornes comprises). Les jours non renseignés ne comptent pas.
export function moyennesCheckins(d, debut, fin) {
  const liste = B(d).checkins.filter((c) => c.date >= debut && c.date <= fin);
  const moyenne = (cle) => {
    const vals = liste.map((c) => c[cle]).filter((v) => typeof v === 'number');
    return vals.length ? vals.reduce((t, v) => t + v, 0) / vals.length : null;
  };
  return {
    humeur: moyenne('humeur'),
    energie: moyenne('energie'),
    sommeilHeures: moyenne('sommeilHeures'),
    nbJours: liste.length,
  };
}

export function formaterHeures(h) {
  if (h === null || h === undefined) return '—';
  const totalMinutes = Math.round(h * 60);
  const heures = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${heures} h ${String(minutes).padStart(2, '0')}` : `${heures} h`;
}

// ---- Journal ----

export const AMORCES = [
  "Qu'est-ce qui m'a fait du bien aujourd'hui ?",
  'De quoi suis-je reconnaissante en ce moment ?',
  "Qu'est-ce que j'ai appris sur moi récemment ?",
  "Qu'est-ce qui m'a demandé de l'énergie, et qu'est-ce qui m'en a donné ?",
  'Un petit moment que je veux garder en mémoire…',
  "De quoi ai-je besoin, là, maintenant ?",
  "Qu'est-ce que je me souhaite pour demain ?",
  'Une chose dont je suis fière, même toute petite…',
];

export function ajouterEntree(d, { date, amorce, texte }) {
  const maintenant = new Date().toISOString();
  const e = { id: nouvelId(), date, amorce: (amorce || '').trim(), texte: texte.trim(), creeLe: maintenant, modifieLe: maintenant };
  B(d).journal.push(e);
  return e;
}

export function modifierEntree(d, id, { date, amorce, texte }) {
  const e = B(d).journal.find((x) => x.id === id);
  if (!e) return;
  e.date = date;
  e.amorce = (amorce || '').trim();
  e.texte = texte.trim();
  e.modifieLe = new Date().toISOString();
}

export function supprimerEntree(d, id) {
  const index = B(d).journal.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [entree] = B(d).journal.splice(index, 1);
  return { entree, index };
}

export function restaurerEntree(d, { entree, index }) {
  B(d).journal.splice(Math.min(index, B(d).journal.length), 0, entree);
}

function sansAccents(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Les plus récentes d'abord ; recherche sans accents ni majuscules.
export function chercherEntrees(d, texte = '') {
  const mots = sansAccents(texte).split(/\s+/).filter(Boolean);
  return B(d)
    .journal.filter((e) => {
      if (!mots.length) return true;
      const botte = sansAccents(`${e.amorce} ${e.texte}`);
      return mots.every((m) => botte.includes(m));
    })
    .sort((a, b) => (a.date === b.date ? (a.creeLe < b.creeLe ? 1 : -1) : a.date < b.date ? 1 : -1));
}

// ---- Habitudes ----

export function habitudeSurvient(h, date) {
  if (h.archivee) return false;
  if (date < h.debut) return false;
  if (!h.jours || h.jours.length === 0 || h.jours.length === 7) return true;
  return h.jours.includes(jourSemaine(date));
}

export function ajouterHabitude(d, { titre, jours, debut }) {
  const h = {
    id: nouvelId(),
    titre: titre.trim(),
    jours: (jours || []).length === 7 ? [] : [...(jours || [])],
    debut: debut || aujourdhui(),
    archivee: false,
  };
  B(d).habitudes.push(h);
  return h;
}

export function modifierHabitude(d, id, { titre, jours }) {
  const h = B(d).habitudes.find((x) => x.id === id);
  if (!h) return;
  h.titre = titre.trim();
  h.jours = (jours || []).length === 7 ? [] : [...(jours || [])];
}

export function archiverHabitude(d, id, archivee = true) {
  const h = B(d).habitudes.find((x) => x.id === id);
  if (h) h.archivee = archivee;
}

export function supprimerHabitude(d, id) {
  B(d).habitudes = B(d).habitudes.filter((h) => h.id !== id);
  for (const cle of Object.keys(d.coches)) {
    if (cle.startsWith(`habitude|${id}|`)) delete d.coches[cle];
  }
}

// La semaine d'une habitude : pour chaque jour, prévue ? faite ?
export function semaineHabitude(d, h, lundi) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = ajouterJours(lundi, i);
    const prevue = habitudeSurvient({ ...h, archivee: false }, date);
    return { date, prevue, faite: Boolean(d.coches[`habitude|${h.id}|${date}`]) };
  });
}

// ---- Ce qui alimente la journée ----

enregistrerFournisseur((date, donnees) => {
  const items = [];

  for (const h of donnees.bienEtre.habitudes) {
    if (!habitudeSurvient(h, date)) continue;
    const quotidienne = !h.jours || h.jours.length === 0 || h.jours.length === 7;
    items.push({
      source: 'habitude',
      id: h.id,
      date,
      titre: h.titre,
      categorieId: 'bien-etre',
      type: 'tache',
      recurrent: true,
      discret: quotidienne, // une habitude de tous les jours n'encombre pas la vue Semaine
    });
  }

  // Le check-in du jour : proposé aujourd'hui, et pour un jour passé seulement s'il existe.
  const checkin = checkinDuJour(donnees, date);
  if (checkin || date === aujourdhui()) {
    items.push({
      source: 'checkin',
      id: 'checkin',
      date,
      titre: 'Mon check-in du jour',
      categorieId: 'bien-etre',
      type: 'tache',
      fait: Boolean(checkin),
      discret: true,
    });
  }
  return items;
});

// ---- Motivation ----

export function definirPourquoi(d, texte) {
  d.motivation.pourquoi = String(texte || '').trim();
}

export function ajouterPhrase(d, { texte, auteur, type }) {
  const p = { id: nouvelId(), texte: texte.trim(), auteur: (auteur || '').trim(), type: type === 'citation' ? 'citation' : 'phrase' };
  d.motivation.phrases.push(p);
  return p;
}

export function modifierPhrase(d, id, { texte, auteur, type }) {
  const p = d.motivation.phrases.find((x) => x.id === id);
  if (!p) return;
  p.texte = texte.trim();
  p.auteur = (auteur || '').trim();
  p.type = type === 'citation' ? 'citation' : 'phrase';
}

export function supprimerPhrase(d, id) {
  const index = d.motivation.phrases.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [phrase] = d.motivation.phrases.splice(index, 1);
  return { phrase, index };
}

export function restaurerPhrase(d, { phrase, index }) {
  d.motivation.phrases.splice(Math.min(index, d.motivation.phrases.length), 0, phrase);
}

// Toutes les phrases candidates : le « pourquoi » (s'il est écrit) puis les phrases.
export function candidatesMotivation(d) {
  const liste = [];
  if (d.motivation.pourquoi.trim()) {
    liste.push({ id: 'pourquoi', texte: d.motivation.pourquoi.trim(), auteur: '', type: 'pourquoi' });
  }
  return liste.concat(d.motivation.phrases);
}

function numeroDuJour(date) {
  const j = depuisCle(date);
  return Math.floor(Date.UTC(j.getFullYear(), j.getMonth(), j.getDate()) / 86400000);
}

// Petit générateur pseudo-aléatoire (le même tirage pour la même graine).
function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// L'ordre de passage d'un « tour » : une permutation tirée au sort, propre à ce tour.
function ordreDuTour(n, tour) {
  const hasard = generateur(Math.imul(tour + 1, 2654435761) ^ (n * 40503));
  const ordre = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  return ordre;
}

// Tirage au sort : chaque jour, une phrase tirée au hasard. Le tirage se fait « sans remise » :
// toutes les phrases sortent une fois, dans un ordre aléatoire, avant que le tour recommence.
// Ainsi la phrase ne change pas dans la journée, ne se répète jamais deux jours de suite,
// et aucune ne reste dans l'ombre.
export function phraseDuJour(d, date) {
  const candidates = candidatesMotivation(d);
  const n = candidates.length;
  if (n === 0) return null;
  if (n === 1) return candidates[0];
  const jour = numeroDuJour(date);
  if (n === 2) return candidates[((jour % 2) + 2) % 2];

  const tour = Math.floor(jour / n);
  const position = ((jour % n) + n) % n;
  const ordre = ordreDuTour(n, tour);
  // Pas deux jours de suite la même phrase, même à la frontière entre deux tours :
  // si le tour commence par la phrase qui a fini le précédent, on échange les deux premières
  // (l'ordre du tour entier est ainsi le même chaque jour du tour).
  const derniereDuTourPrecedent = ordreDuTour(n, tour - 1)[n - 1];
  if (ordre[0] === derniereDuTourPrecedent) [ordre[0], ordre[1]] = [ordre[1], ordre[0]];
  return candidates[ordre[position]];
}

// ---- Analyse : humeur, énergie, sommeil sur une semaine, un mois ou trois mois ----

export const TYPES_PERIODE = [
  { id: 'semaine', nom: 'Semaine' },
  { id: 'mois', nom: 'Mois' },
  { id: 'trimestre', nom: '3 mois' },
];

// La période (bornes comprises) qui contient la date « ancre ».
export function periode(type, ancre) {
  if (type === 'semaine') {
    const debut = lundiDe(ancre);
    return { type, debut, fin: ajouterJours(debut, 6) };
  }
  if (type === 'mois') return { type, debut: premierDuMois(ancre), fin: dernierDuMois(ancre) };
  return { type: 'trimestre', debut: ajouterMois(ancre, -2), fin: dernierDuMois(ancre) };
}

// Période précédente (sens = -1) ou suivante (sens = +1) : rend la nouvelle ancre.
export function decalerAncre(type, ancre, sens) {
  if (type === 'semaine') return ajouterJours(ancre, 7 * sens);
  if (type === 'mois') return ajouterMois(ancre, sens);
  return ajouterMois(ancre, 3 * sens);
}

function moyenneDe(valeurs) {
  const v = valeurs.filter((x) => typeof x === 'number');
  return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null;
}

// Un tableau jour par jour (les jours sans check-in ont des valeurs nulles) + des synthèses.
export function analysePeriode(d, debut, fin) {
  const jours = joursEntre(debut, fin).map((date) => {
    const c = checkinDuJour(d, date);
    return {
      date,
      renseigne: Boolean(c),
      humeur: c?.humeur ?? null,
      energie: c?.energie ?? null,
      sommeilHeures: c?.sommeilHeures ?? null,
      sommeilQualite: c?.sommeilQualite ?? null,
    };
  });
  const renseignes = jours.filter((j) => j.renseigne);

  // Répartition des humeurs (combien de jours à chaque niveau).
  const repartition = [1, 2, 3, 4, 5].map((v) => ({ v, n: jours.filter((j) => j.humeur === v).length }));

  // Moyennes par semaine (pour la vue 3 mois).
  const semaines = [];
  for (let lundi = lundiDe(debut); lundi <= fin; lundi = ajouterJours(lundi, 7)) {
    const sem = jours.filter((j) => j.date >= lundi && j.date <= ajouterJours(lundi, 6));
    semaines.push({
      lundi,
      humeur: moyenneDe(sem.map((j) => j.humeur)),
      energie: moyenneDe(sem.map((j) => j.energie)),
      sommeilHeures: moyenneDe(sem.map((j) => j.sommeilHeures)),
      n: sem.filter((j) => j.renseigne).length,
    });
  }

  // Le meilleur jour : l'humeur la plus haute (le plus récent en cas d'égalité).
  let meilleur = null;
  for (const j of jours) {
    if (typeof j.humeur !== 'number') continue;
    if (!meilleur || j.humeur >= meilleur.humeur) meilleur = j;
  }

  // Sommeil et énergie : seulement si on a assez de jours des deux côtés, et en restant neutre.
  const avecDeux = jours.filter((j) => typeof j.sommeilHeures === 'number' && typeof j.energie === 'number');
  const longs = avecDeux.filter((j) => j.sommeilHeures >= 7);
  const courts = avecDeux.filter((j) => j.sommeilHeures < 7);
  let sommeilEnergie = null;
  if (longs.length >= 3 && courts.length >= 3) {
    const a = moyenneDe(longs.map((j) => j.energie));
    const b = moyenneDe(courts.map((j) => j.energie));
    if (Math.abs(a - b) >= 0.3) sommeilEnergie = { seuil: 7, longs: { n: longs.length, energie: a }, courts: { n: courts.length, energie: b } };
  }

  return {
    jours,
    semaines,
    repartition,
    nbRenseignes: renseignes.length,
    nbJours: jours.length,
    humeur: moyenneDe(jours.map((j) => j.humeur)),
    energie: moyenneDe(jours.map((j) => j.energie)),
    sommeilHeures: moyenneDe(jours.map((j) => j.sommeilHeures)),
    meilleurJour: meilleur,
    sommeilEnergie,
  };
}

// L'emoji le plus proche d'une moyenne.
export function emojiHumeur(moyenne) {
  if (moyenne == null) return '';
  return HUMEURS[Math.min(4, Math.max(0, Math.round(moyenne) - 1))].emoji;
}

export function emojiEnergie(moyenne) {
  if (moyenne == null) return '';
  return ENERGIES[Math.min(4, Math.max(0, Math.round(moyenne) - 1))].emoji;
}

export { lundiDe };
