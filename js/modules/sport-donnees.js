// Sport : types de séances, planning (hebdomadaire ou ponctuel), journal des séances faites.
// Règles et calculs seulement (pas d'affichage).
// Ton : on compte ce qui est fait, jamais ce qui manque.

import { enregistrerFournisseur, enregistrerReportable } from '../registry.js';
import { nouvelId } from '../schema.js';
import { jourSemaine, lundiDe, ajouterJours } from '../dates.js';

const S = (d) => d.sport;

export const RESSENTIS = [
  { v: 1, emoji: '😮‍💨', nom: 'Dur' },
  { v: 2, emoji: '😐', nom: 'Moyen' },
  { v: 3, emoji: '🙂', nom: 'Bien' },
  { v: 4, emoji: '😄', nom: 'Très bien' },
  { v: 5, emoji: '🤩', nom: 'Au top' },
];

// Des idées pour démarrer : un clic les ajoute à « mes séances ».
export const SUGGESTIONS_TYPES = [
  { nom: 'Yoga', icone: '🧘‍♀️', dureeMin: 30 },
  { nom: 'Renforcement musculaire', icone: '💪', dureeMin: 30 },
  { nom: 'Marche', icone: '🚶‍♀️', dureeMin: 30 },
  { nom: 'Natation', icone: '🏊‍♀️', dureeMin: 45 },
  { nom: 'Étirements', icone: '🤸‍♀️', dureeMin: 15 },
  { nom: 'Danse', icone: '💃', dureeMin: 30 },
  { nom: 'Vélo', icone: '🚴‍♀️', dureeMin: 30 },
];

// ---- Types de séances ----

export function typeParId(d, id) {
  return S(d).types.find((t) => t.id === id) || null;
}

function dureeOuNull(v) {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : null;
}

export function ajouterType(d, { nom, icone, dureeMin }) {
  const t = { id: nouvelId(), nom: nom.trim(), icone: (icone || '').trim() || '🏃‍♀️', dureeMin: dureeOuNull(dureeMin) };
  S(d).types.push(t);
  return t;
}

export function modifierType(d, id, { nom, icone, dureeMin }) {
  const t = typeParId(d, id);
  if (!t) return;
  t.nom = nom.trim();
  t.icone = (icone || '').trim() || '🏃‍♀️';
  t.dureeMin = dureeOuNull(dureeMin);
}

// Supprime le type et ce qui le planifie. Le journal des séances déjà faites est conservé
// (chaque séance garde le nom et l'icône du type au moment où elle a été faite).
export function supprimerType(d, id) {
  S(d).types = S(d).types.filter((t) => t.id !== id);
  // Les circuits du type restent, rangés « sans catégorie » (on ne perd jamais un circuit construit).
  for (const c of S(d).circuits) if (c.typeId === id) c.typeId = null;
  S(d).plan = S(d).plan.filter((p) => p.typeId !== id);
  S(d).ponctuelles = S(d).ponctuelles.filter((p) => p.typeId !== id);
}

// ---- Circuits personnalisés ----
// Un circuit = une suite d'exercices que je me suis composée, rangée dans un type de séance
// (la « catégorie de sport » : renforcement, yoga…). Chaque exercice a un titre et un détail libre
// (« 3 × 12 », « 45 s », « côté droit puis gauche »…). Aucun chiffre imposé, aucun objectif.

export function circuitParId(d, id) {
  return S(d).circuits.find((c) => c.id === id) || null;
}

export function circuitsDuType(d, typeId) {
  return S(d).circuits.filter((c) => (c.typeId || null) === (typeId || null));
}

// Tous les circuits, regroupés par catégorie de sport (dans l'ordre des types, puis « sans catégorie »).
// Les groupes sans circuit n'apparaissent pas.
export function circuitsParType(d) {
  const groupes = S(d).types.map((t) => ({ type: t, circuits: circuitsDuType(d, t.id) }));
  groupes.push({ type: null, circuits: circuitsDuType(d, null) });
  return groupes.filter((g) => g.circuits.length > 0);
}

export function ajouterCircuit(d, { nom, typeId, note }) {
  const c = { id: nouvelId(), nom: String(nom || '').trim(), typeId: typeId && typeParId(d, typeId) ? typeId : null, note: String(note || '').trim(), exercices: [] };
  S(d).circuits.push(c);
  return c;
}

export function modifierCircuit(d, id, { nom, typeId, note }) {
  const c = circuitParId(d, id);
  if (!c) return;
  c.nom = String(nom || '').trim();
  c.typeId = typeId && typeParId(d, typeId) ? typeId : null;
  c.note = String(note || '').trim();
}

export function supprimerCircuit(d, id) {
  const index = S(d).circuits.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const [circuit] = S(d).circuits.splice(index, 1);
  // Les séances prévues qui l'utilisaient restent, simplement sans circuit.
  for (const p of [...S(d).plan, ...S(d).ponctuelles]) if (p.circuitId === id) p.circuitId = null;
  return { circuit, index };
}

export function restaurerCircuit(d, { circuit, index }) {
  S(d).circuits.splice(Math.min(index, S(d).circuits.length), 0, circuit);
}

function nombreOuNull(v, max) {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
}

// Un exercice : un titre, et des champs séparés (tous facultatifs) :
// séries, répétitions, durée (en secondes, pour un gainage par exemple), repos (en secondes),
// plus une remarque libre (« côté droit puis gauche », « avec haltères »…).
function exerciceNettoye(e) {
  return {
    id: e.id || nouvelId(),
    titre: String(e.titre || '').trim(),
    series: nombreOuNull(e.series, 99),
    repetitions: nombreOuNull(e.repetitions, 999),
    dureeSec: nombreOuNull(e.dureeSec, 3600),
    reposSec: nombreOuNull(e.reposSec, 3600),
    detail: String(e.detail || '').trim(),
  };
}

export function ajouterExercice(d, circuitId, exercice) {
  const c = circuitParId(d, circuitId);
  if (!c || !String(exercice?.titre || '').trim()) return null;
  const e = exerciceNettoye({ ...exercice, id: null });
  c.exercices.push(e);
  return e;
}

// Remplace la liste des exercices (l'éditeur du circuit enregistre tout d'un coup). Les exercices vides sont ignorés.
export function enregistrerExercices(d, circuitId, brouillon) {
  const c = circuitParId(d, circuitId);
  if (!c) return;
  c.exercices = (brouillon || []).map(exerciceNettoye).filter((e) => e.titre);
}

// « 45 s », « 1 min 30 », « 2 min »
export function formaterSecondes(s) {
  if (!s) return '';
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`;
}

// Le résumé d'un exercice, lisible d'un coup d'œil : « 3 × 12 · repos 30 s · avec haltères ».
export function resumeExercice(e) {
  const morceaux = [];
  if (e.series && e.repetitions) morceaux.push(`${e.series} × ${e.repetitions}`);
  else if (e.series && e.dureeSec) morceaux.push(`${e.series} × ${formaterSecondes(e.dureeSec)}`);
  else if (e.repetitions) morceaux.push(`${e.repetitions} répétition${e.repetitions > 1 ? 's' : ''}`);
  else if (e.dureeSec) morceaux.push(formaterSecondes(e.dureeSec));
  else if (e.series) morceaux.push(`${e.series} série${e.series > 1 ? 's' : ''}`);
  if (e.series && e.repetitions && e.dureeSec) morceaux.push(formaterSecondes(e.dureeSec));
  if (e.reposSec) morceaux.push(`repos ${formaterSecondes(e.reposSec)}`);
  if (e.detail) morceaux.push(e.detail);
  return morceaux.join(' · ');
}

// ---- Planning ----

export function planSurvient(plan, date) {
  if (plan.archivee || date < plan.debut) return false;
  return (plan.jours || []).includes(jourSemaine(date));
}

export function ajouterPlan(d, { typeId, jours, heure, dureeMin, debut, circuitId }) {
  const p = {
    id: nouvelId(),
    typeId,
    circuitId: circuitId || null,
    jours: [...new Set(jours || [])].sort((a, b) => a - b),
    heure: heure || '',
    dureeMin: dureeOuNull(dureeMin),
    debut,
    archivee: false,
  };
  S(d).plan.push(p);
  return p;
}

export function modifierPlan(d, id, { typeId, jours, heure, dureeMin, circuitId }) {
  const p = S(d).plan.find((x) => x.id === id);
  if (!p) return;
  p.typeId = typeId;
  p.circuitId = circuitId || null;
  p.jours = [...new Set(jours || [])].sort((a, b) => a - b);
  p.heure = heure || '';
  p.dureeMin = dureeOuNull(dureeMin);
}

export function archiverPlan(d, id, archivee = true) {
  const p = S(d).plan.find((x) => x.id === id);
  if (p) p.archivee = archivee;
}

export function supprimerPlan(d, id) {
  S(d).plan = S(d).plan.filter((p) => p.id !== id);
}

export function ajouterPonctuelle(d, { typeId, date, heure, dureeMin, note, circuitId }) {
  const p = { id: nouvelId(), typeId, circuitId: circuitId || null, date, heure: heure || '', dureeMin: dureeOuNull(dureeMin), note: (note || '').trim(), abandonnee: false };
  S(d).ponctuelles.push(p);
  return p;
}

export function modifierPonctuelle(d, id, { typeId, date, heure, dureeMin, note, circuitId }) {
  const p = S(d).ponctuelles.find((x) => x.id === id);
  if (!p) return;
  p.typeId = typeId;
  p.circuitId = circuitId || null;
  p.date = date;
  p.heure = heure || '';
  p.dureeMin = dureeOuNull(dureeMin);
  p.note = (note || '').trim();
}

export function supprimerPonctuelle(d, id) {
  S(d).ponctuelles = S(d).ponctuelles.filter((p) => p.id !== id);
}

// Les séances prévues un jour donné (hebdomadaires et ponctuelles), avec leur état.
// `id` : « p:<plan> » ou « u:<ponctuelle> » ; `cle` : la clé qui relie la séance prévue à la séance faite.
export function seancesPrevues(d, date) {
  const prevues = [];
  for (const p of S(d).plan) {
    if (!planSurvient(p, date)) continue;
    const type = typeParId(d, p.typeId);
    if (!type) continue;
    prevues.push({ id: `p:${p.id}`, genre: 'plan', source: p.id, typeId: p.typeId, circuitId: p.circuitId || null, type, heure: p.heure, dureeMin: p.dureeMin ?? type.dureeMin, date });
  }
  for (const p of S(d).ponctuelles) {
    if (p.date !== date || p.abandonnee) continue;
    const type = typeParId(d, p.typeId);
    if (!type) continue;
    prevues.push({ id: `u:${p.id}`, genre: 'ponctuelle', source: p.id, typeId: p.typeId, circuitId: p.circuitId || null, type, heure: p.heure, dureeMin: p.dureeMin ?? type.dureeMin, date });
  }
  return prevues
    .map((x) => ({ ...x, cle: `seance-prevue|${x.id}|${date}` }))
    .map((x) => ({ ...x, seance: S(d).seances.find((s) => s.prevueCle === x.cle) || null }))
    .sort((a, b) => (a.heure || '99') < (b.heure || '99') ? -1 : 1);
}

// ---- Journal des séances faites ----

export function enregistrerSeance(d, { typeId, date, dureeMin, ressenti, note, prevueCle, circuitId }) {
  const type = typeParId(d, typeId);
  const circuit = circuitId ? circuitParId(d, circuitId) : null;
  const maintenant = new Date().toISOString();
  const s = {
    id: nouvelId(),
    typeId: typeId || null,
    typeNom: type?.nom || 'Séance',
    icone: type?.icone || '🏃‍♀️',
    date,
    dureeMin: dureeOuNull(dureeMin),
    ressenti: ressenti >= 1 && ressenti <= 5 ? Number(ressenti) : null,
    note: (note || '').trim(),
    prevueCle: prevueCle || null,
    circuitId: circuit ? circuit.id : null,
    circuitNom: circuit ? circuit.nom : null,
    creeLe: maintenant,
    modifieLe: maintenant,
  };
  S(d).seances.push(s);
  return s;
}

export function modifierSeance(d, id, { typeId, date, dureeMin, ressenti, note, circuitId }) {
  const s = S(d).seances.find((x) => x.id === id);
  if (!s) return;
  if (circuitId !== undefined) {
    const circuit = circuitId ? circuitParId(d, circuitId) : null;
    if ((circuit ? circuit.id : null) !== s.circuitId) {
      s.circuitId = circuit ? circuit.id : null;
      s.circuitNom = circuit ? circuit.nom : null;
    }
  }
  const type = typeParId(d, typeId);
  if (typeId !== s.typeId) {
    s.typeId = typeId || null;
    s.typeNom = type?.nom || s.typeNom;
    s.icone = type?.icone || s.icone;
  }
  s.date = date;
  s.dureeMin = dureeOuNull(dureeMin);
  s.ressenti = ressenti >= 1 && ressenti <= 5 ? Number(ressenti) : null;
  s.note = (note || '').trim();
  s.modifieLe = new Date().toISOString();
}

export function supprimerSeance(d, id) {
  const index = S(d).seances.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [seance] = S(d).seances.splice(index, 1);
  return { seance, index };
}

export function restaurerSeance(d, { seance, index }) {
  S(d).seances.splice(Math.min(index, S(d).seances.length), 0, seance);
}

export function seancesDeLaPeriode(d, debut, fin) {
  return S(d).seances.filter((s) => s.date >= debut && s.date <= fin);
}

export function journalTrie(d, { typeId = '' } = {}) {
  return S(d)
    .seances.filter((s) => !typeId || s.typeId === typeId)
    .sort((a, b) => (a.date === b.date ? (a.creeLe < b.creeLe ? 1 : -1) : a.date < b.date ? 1 : -1));
}

// Totaux « positifs » : ce qui a été fait. Pas de série, pas d'objectif manqué.
export function statsSport(d, aujourdhuiCle) {
  const total = (liste) => ({ n: liste.length, minutes: liste.reduce((t, s) => t + (s.dureeMin || 0), 0) });
  const lundi = lundiDe(aujourdhuiCle);
  const debutMois = `${aujourdhuiCle.slice(0, 8)}01`;
  const toutes = S(d).seances;
  return {
    cetteSemaine: total(toutes.filter((s) => s.date >= lundi && s.date <= ajouterJours(lundi, 6))),
    ceMois: total(toutes.filter((s) => s.date >= debutMois && s.date <= aujourdhuiCle.slice(0, 8) + '31')),
    total: total(toutes),
  };
}

// Un message d'encouragement, toujours bienveillant, selon le nombre de séances de la semaine.
export function messageSemaine(n) {
  if (n <= 0) return 'Une nouvelle semaine, de nouvelles occasions de bouger à ton rythme ✦';
  if (n === 1) return 'Une séance cette semaine : c\'est un vrai pas, bravo ✦';
  if (n === 2) return 'Deux séances cette semaine : tu trouves ton rythme ✦';
  return `${n} séances cette semaine : quelle belle énergie ✦`;
}

const FELICITATIONS = [
  'Bravo, belle séance ✦',
  'Chaque séance compte. Bien joué ✦',
  'Ton corps te dit merci ✦',
  "C'est fait, et c'est ce qui compte ✦",
  'Super, continue à ton rythme ✦',
];

export function felicitation(graine = 0) {
  return FELICITATIONS[Math.abs(Math.floor(graine)) % FELICITATIONS.length];
}

// ---- Ce qui alimente la journée ----

function titrePrevue(x) {
  return `${x.type.icone} ${x.type.nom}${x.dureeMin ? ` (${x.dureeMin} min)` : ''}`;
}

enregistrerFournisseur((date, donnees) =>
  seancesPrevues(donnees, date).map((x) => ({
    source: 'seance-prevue',
    id: x.id,
    date,
    titre: titrePrevue(x),
    categorieId: 'sport',
    type: 'tache',
    heure: x.heure || '',
    fait: Boolean(x.seance),
    recurrent: x.genre === 'plan',
  }))
);

// Une séance ponctuelle passée et non faite est proposée en report (jamais déplacée toute seule).
// Une séance hebdomadaire n'est pas « reportée » : la suivante arrive le jour prévu.
enregistrerReportable('seance-prevue', {
  lister: (donnees, reel) =>
    donnees.sport.ponctuelles
      .filter((p) => !p.abandonnee && p.date < reel)
      .filter((p) => !donnees.sport.seances.some((s) => s.prevueCle === `seance-prevue|u:${p.id}|${p.date}`))
      .map((p) => {
        const type = typeParId(donnees, p.typeId);
        return type ? { source: 'seance-prevue', id: `u:${p.id}`, titre: titrePrevue({ type, dureeMin: p.dureeMin ?? type.dureeMin }), categorieId: 'sport', date: p.date } : null;
      })
      .filter(Boolean),
  reporter: (donnees, id, date) => {
    const p = donnees.sport.ponctuelles.find((x) => `u:${x.id}` === id);
    if (p) p.date = date;
  },
  abandonner: (donnees, id) => {
    const p = donnees.sport.ponctuelles.find((x) => `u:${x.id}` === id);
    if (p) p.abandonnee = true;
  },
});
