// Études : modules, chapitres, sessions planifiées, temps de concentration, QCM.
// Ce fichier ne touche pas à l'affichage : ce sont les règles et les calculs.

import { enregistrerFournisseur, enregistrerReportable } from '../registry.js';
import { nouvelId } from '../schema.js';
import { ajouterJours, lundiDe, versCle } from '../dates.js';

export const STATUTS = [
  { id: 'pas-commence', nom: 'Pas commencé', couleur: 'blanc' },
  { id: 'en-cours', nom: 'En cours', couleur: 'jaune' },
  { id: 'termine', nom: 'Terminé', couleur: 'turquoise' },
  { id: 'revise', nom: 'Révisé', couleur: 'violet' },
];

const E = (d) => d.etudes;

// ---- Modules ----

export function ajouterModule(d, titre) {
  const module = { id: nouvelId(), titre: titre.trim() };
  E(d).modules.push(module);
  return module;
}

export function renommerModule(d, id, titre) {
  const m = E(d).modules.find((x) => x.id === id);
  if (m) m.titre = titre.trim();
}

// Supprime le module, ses chapitres et les sessions planifiées de ces chapitres.
// Les QCM et le temps déjà enregistrés sont conservés (ils restent dans le suivi).
export function supprimerModule(d, id) {
  const chapitres = E(d).chapitres.filter((c) => c.moduleId === id);
  const ids = new Set(chapitres.map((c) => c.id));
  E(d).modules = E(d).modules.filter((m) => m.id !== id);
  E(d).chapitres = E(d).chapitres.filter((c) => c.moduleId !== id);
  E(d).sessions = E(d).sessions.filter((s) => !ids.has(s.chapitreId));
  return { chapitres: chapitres.length };
}

function echanger(tableau, i, j) {
  if (i < 0 || j < 0 || i >= tableau.length || j >= tableau.length) return false;
  [tableau[i], tableau[j]] = [tableau[j], tableau[i]];
  return true;
}

export function deplacerModule(d, id, delta) {
  const t = E(d).modules;
  const i = t.findIndex((m) => m.id === id);
  if (i !== -1) echanger(t, i, i + delta);
}

// ---- Chapitres ----

export function chapitresDuModule(d, moduleId) {
  return E(d).chapitres.filter((c) => c.moduleId === moduleId);
}

export function ajouterChapitre(d, moduleId, titre, statut = 'pas-commence') {
  const chapitre = { id: nouvelId(), moduleId, titre: titre.trim(), statut };
  E(d).chapitres.push(chapitre);
  return chapitre;
}

// Une ligne de texte = un chapitre. Les puces (« - », « • », « * ») sont retirées.
export function ajouterChapitres(d, moduleId, texte) {
  const lignes = String(texte)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*–]\s+/, '').trim())
    .filter(Boolean);
  return lignes.map((titre) => ajouterChapitre(d, moduleId, titre));
}

export function modifierChapitre(d, id, { titre, statut, moduleId }) {
  const c = E(d).chapitres.find((x) => x.id === id);
  if (!c) return;
  if (titre !== undefined) c.titre = titre.trim();
  if (statut !== undefined) {
    // On retient quand le statut a changé : le bilan de la semaine s'en sert.
    if (statut !== c.statut) c.statutLe = new Date().toISOString();
    c.statut = statut;
  }
  if (moduleId !== undefined) c.moduleId = moduleId;
}

export function definirStatut(d, id, statut) {
  modifierChapitre(d, id, { statut });
}

export function supprimerChapitre(d, id) {
  E(d).chapitres = E(d).chapitres.filter((c) => c.id !== id);
  E(d).sessions = E(d).sessions.filter((s) => s.chapitreId !== id);
}

// Monte (-1) ou descend (+1) un chapitre parmi les chapitres de son module.
export function deplacerChapitre(d, id, delta) {
  const t = E(d).chapitres;
  const c = t.find((x) => x.id === id);
  if (!c) return;
  const freres = t.map((x, i) => ({ x, i })).filter((o) => o.x.moduleId === c.moduleId);
  const pos = freres.findIndex((o) => o.x.id === id);
  const cible = freres[pos + delta];
  if (cible) echanger(t, freres[pos].i, cible.i);
}

// ---- Progression ----
// « Avancé » = terminé ou révisé.

export function progression(d, moduleId = null) {
  const chapitres = moduleId ? chapitresDuModule(d, moduleId) : E(d).chapitres;
  const total = chapitres.length;
  const compte = (...statuts) => chapitres.filter((c) => statuts.includes(c.statut)).length;
  const termines = compte('termine', 'revise');
  return {
    total,
    termines,
    enCours: compte('en-cours'),
    revises: compte('revise'),
    pasCommences: compte('pas-commence'),
    pourcent: total ? Math.round((termines / total) * 100) : 0,
  };
}

export function chapitreParId(d, id) {
  return E(d).chapitres.find((c) => c.id === id) || null;
}

// « Module › Chapitre »
export function nomChapitre(d, id) {
  const c = chapitreParId(d, id);
  if (!c) return 'Sans chapitre précis';
  const m = E(d).modules.find((x) => x.id === c.moduleId);
  return m ? `${m.titre} › ${c.titre}` : c.titre;
}

// ---- Sessions planifiées (travail ou révision) ----

export function ajouterSession(d, { chapitreId, type, date, heure, dureeMin, note }) {
  const s = {
    id: nouvelId(),
    chapitreId: chapitreId || null,
    type: type === 'revision' ? 'revision' : 'travail',
    date,
    heure: heure || '',
    dureeMin: dureeMin ? Number(dureeMin) : null,
    note: (note || '').trim(),
    abandonnee: false,
  };
  E(d).sessions.push(s);
  return s;
}

export function modifierSession(d, id, valeurs) {
  const s = E(d).sessions.find((x) => x.id === id);
  if (!s) return;
  s.chapitreId = valeurs.chapitreId || null;
  s.type = valeurs.type === 'revision' ? 'revision' : 'travail';
  s.date = valeurs.date;
  s.heure = valeurs.heure || '';
  s.dureeMin = valeurs.dureeMin ? Number(valeurs.dureeMin) : null;
  s.note = (valeurs.note || '').trim();
}

export function supprimerSession(d, id) {
  E(d).sessions = E(d).sessions.filter((s) => s.id !== id);
}

export function titreSession(d, s) {
  const verbe = s.type === 'revision' ? 'Réviser' : 'Travailler';
  const c = chapitreParId(d, s.chapitreId);
  const base = c ? `${verbe} · ${c.titre}` : s.type === 'revision' ? 'Session de révision' : 'Session de travail';
  return s.dureeMin ? `${base} (${s.dureeMin} min)` : base;
}

// Les sessions planifiées alimentent Aujourd'hui et Semaine comme des choses à faire.
enregistrerFournisseur((date, donnees) =>
  donnees.etudes.sessions
    .filter((s) => s.date === date && !s.abandonnee)
    .map((s) => ({
      source: 'session-etude',
      id: s.id,
      date,
      titre: titreSession(donnees, s),
      categorieId: 'etudes',
      type: 'tache',
      heure: s.heure || '',
      chapitreId: s.chapitreId,
    }))
);

// Une session passée et non faite est proposée en report (jamais reportée toute seule).
enregistrerReportable('session-etude', {
  lister: (donnees, reel) =>
    donnees.etudes.sessions
      .filter((s) => !s.abandonnee && s.date < reel && !donnees.coches[`session-etude|${s.id}|${s.date}`])
      .map((s) => ({ source: 'session-etude', id: s.id, titre: titreSession(donnees, s), categorieId: 'etudes', date: s.date })),
  reporter: (donnees, id, date) => {
    const s = donnees.etudes.sessions.find((x) => x.id === id);
    if (s) s.date = date;
  },
  abandonner: (donnees, id) => {
    const s = donnees.etudes.sessions.find((x) => x.id === id);
    if (s) s.abandonnee = true;
  },
});

// ---- Temps de concentration ----

export function enregistrerTemps(d, { chapitreId, debutISO, secondes }) {
  const entree = {
    id: nouvelId(),
    chapitreId: chapitreId || null,
    date: versCle(new Date(debutISO)),
    debut: debutISO,
    secondes: Math.max(0, Math.round(secondes)),
  };
  E(d).temps.push(entree);
  return entree;
}

export function formaterDuree(secondes) {
  const minutes = Math.round(secondes / 60);
  if (secondes > 0 && minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// Totaux pour le suivi. `aujourdhuiCle` : « AAAA-MM-JJ ».
export function statsTemps(d, aujourdhuiCle) {
  const temps = E(d).temps;
  const somme = (liste) => liste.reduce((t, e) => t + e.secondes, 0);
  const debutSemaine = lundiDe(aujourdhuiCle);
  const finSemaine = ajouterJours(debutSemaine, 6);

  const sept = Array.from({ length: 7 }, (_, i) => ajouterJours(aujourdhuiCle, i - 6));
  const parChapitre = new Map();
  for (const e of temps) parChapitre.set(e.chapitreId, (parChapitre.get(e.chapitreId) || 0) + e.secondes);

  return {
    total: somme(temps),
    aujourdhui: somme(temps.filter((e) => e.date === aujourdhuiCle)),
    cetteSemaine: somme(temps.filter((e) => e.date >= debutSemaine && e.date <= finSemaine)),
    derniersJours: sept.map((date) => ({ date, secondes: somme(temps.filter((e) => e.date === date)) })),
    parChapitre,
    nbSessions: temps.length,
  };
}

export function tempsDuModule(d, moduleId, parChapitre) {
  return chapitresDuModule(d, moduleId).reduce((t, c) => t + (parChapitre.get(c.id) || 0), 0);
}

// ---- QCM et résultats ----

export function ajouterQcm(d, { chapitreId, qcm }) {
  const entree = {
    id: nouvelId(),
    chapitreId: chapitreId || null,
    titre: qcm.titre,
    description: qcm.description || '',
    questions: qcm.questions,
    importeLe: new Date().toISOString(),
  };
  E(d).qcm.push(entree);
  return entree;
}

export function supprimerQcm(d, id) {
  E(d).qcm = E(d).qcm.filter((q) => q.id !== id);
  E(d).resultats = E(d).resultats.filter((r) => r.qcmId !== id);
}

// detail : [{ questionId, choisis: [indices], juste }]
export function enregistrerResultat(d, { qcmId, detail, partiel }) {
  const r = {
    id: nouvelId(),
    qcmId,
    date: new Date().toISOString(),
    total: detail.length,
    juste: detail.filter((x) => x.juste).length,
    partiel: Boolean(partiel),
    detail,
  };
  E(d).resultats.push(r);
  return r;
}

export function historiqueQcm(d, qcmId) {
  return E(d)
    .resultats.filter((r) => r.qcmId === qcmId)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Questions dont la réponse la plus récente était fausse.
export function questionsRatees(d, qcmId) {
  const dernier = new Map();
  for (const r of historiqueQcm(d, qcmId)) {
    for (const x of r.detail) dernier.set(x.questionId, x.juste);
  }
  return [...dernier.entries()].filter(([, juste]) => !juste).map(([id]) => id);
}

// Meilleur et dernier score sur les passages complets (hors « seulement les ratées »).
export function resumeScores(d, qcmId) {
  const complets = historiqueQcm(d, qcmId).filter((r) => !r.partiel);
  if (!complets.length) return null;
  const pct = (r) => Math.round((r.juste / r.total) * 100);
  const dernier = complets[complets.length - 1];
  return {
    essais: complets.length,
    dernier: { juste: dernier.juste, total: dernier.total, pourcent: pct(dernier) },
    meilleur: Math.max(...complets.map(pct)),
  };
}

// ---- Recherche personnelle : des notes avec leurs sources (liens ou textes) ----

// Une source par ligne ; les lignes vides et les doublons sont retirés.
export function lireSources(texte) {
  const vues = new Set();
  return String(texte || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*–]\s+/, '').trim())
    .filter((l) => {
      if (!l || vues.has(l)) return false;
      vues.add(l);
      return true;
    });
}

export function ajouterRecherche(d, { titre, note, sources, chapitreId }) {
  const maintenant = new Date().toISOString();
  const r = {
    id: nouvelId(),
    titre: titre.trim(),
    note: (note || '').trim(),
    sources: Array.isArray(sources) ? sources : lireSources(sources),
    chapitreId: chapitreId || null,
    creeLe: maintenant,
    modifieLe: maintenant,
  };
  E(d).recherches.push(r);
  return r;
}

export function modifierRecherche(d, id, { titre, note, sources, chapitreId }) {
  const r = E(d).recherches.find((x) => x.id === id);
  if (!r) return;
  r.titre = titre.trim();
  r.note = (note || '').trim();
  r.sources = Array.isArray(sources) ? sources : lireSources(sources);
  r.chapitreId = chapitreId || null;
  r.modifieLe = new Date().toISOString();
}

export function supprimerRecherche(d, id) {
  const index = E(d).recherches.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [recherche] = E(d).recherches.splice(index, 1);
  return { recherche, index };
}

export function restaurerRecherche(d, { recherche, index }) {
  E(d).recherches.splice(Math.min(index, E(d).recherches.length), 0, recherche);
}

function sansAccents(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Filtre par texte (titre, note, sources ; sans tenir compte des accents ni des majuscules)
// et par chapitre. Les plus récemment modifiées d'abord.
export function chercherRecherches(d, { texte = '', chapitreId = '' } = {}) {
  const mots = sansAccents(texte).split(/\s+/).filter(Boolean);
  return E(d)
    .recherches.filter((r) => !chapitreId || r.chapitreId === chapitreId)
    .filter((r) => {
      if (!mots.length) return true;
      const botte = sansAccents([r.titre, r.note, ...r.sources].join(' '));
      return mots.every((m) => botte.includes(m));
    })
    .sort((a, b) => (a.modifieLe < b.modifieLe ? 1 : -1));
}
