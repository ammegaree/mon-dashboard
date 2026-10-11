// Maison › Plantes du balcon : arrosage, engrais, rempotage, taille.
//
// Même idée que le ménage : un soin revient un certain temps après la dernière fois, sans jamais
// être « en retard ». En plus, chaque soin a un rythme pour l'été et un autre pour l'hiver
// (ou pas de soin du tout en hiver), et le dashboard bascule tout seul selon la saison.
// Dans Aujourd'hui, tous les arrosages du jour forment UNE seule ligne (« J'ai arrosé le balcon »).
// Règles et calculs seulement (pas d'affichage).

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';
import { ajouterJours, aujourdhui } from '../dates.js';
import { etatTache, nomIntervalle, texteCourt } from './maison-donnees.js';

const M = (d) => d.maison;
const PREFIXE = 'maison-soin|';

export const TYPES_SOIN = [
  { id: 'arrosage', nom: 'Arrosage', verbe: 'Arroser', icone: '💧', defaut: { ete: 3, hiver: 10 } },
  { id: 'engrais', nom: 'Engrais', verbe: 'Donner de l’engrais', icone: '🌱', defaut: { ete: 14, hiver: 0 } },
  { id: 'rempotage', nom: 'Rempotage', verbe: 'Rempoter', icone: '🪴', defaut: { ete: 365, hiver: null } },
  { id: 'taille', nom: 'Taille', verbe: 'Tailler', icone: '✂️', defaut: { ete: 365, hiver: null } },
];

export function typeSoin(id) {
  return TYPES_SOIN.find((t) => t.id === id) || TYPES_SOIN[0];
}

// Les rythmes proposés dans les listes (on peut aussi choisir un nombre de jours précis).
export const RYTHMES_PLANTES = [1, 2, 3, 4, 5, 7, 10, 14, 21, 30, 60, 90, 180, 365, 730];

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Des idées pour démarrer. joursHiver : null = comme l'été, 0 = pas de soin en hiver.
// Ce sont des rythmes indicatifs : à ajuster selon le soleil, le pot, la météo.
export const IDEES_PLANTES = [
  { nom: 'Géranium', icone: '🌺', soins: [{ type: 'arrosage', joursEte: 3, joursHiver: 14 }, { type: 'engrais', joursEte: 14, joursHiver: 0 }] },
  { nom: 'Lavande', icone: '💜', soins: [{ type: 'arrosage', joursEte: 7, joursHiver: 21 }, { type: 'taille', joursEte: 365, joursHiver: null }] },
  { nom: 'Basilic', icone: '🌿', soins: [{ type: 'arrosage', joursEte: 2, joursHiver: 7 }, { type: 'engrais', joursEte: 14, joursHiver: 0 }] },
  { nom: 'Menthe', icone: '🍃', soins: [{ type: 'arrosage', joursEte: 2, joursHiver: 10 }] },
  { nom: 'Romarin', icone: '🌱', soins: [{ type: 'arrosage', joursEte: 7, joursHiver: 21 }] },
  { nom: 'Tomates cerises', icone: '🍅', soins: [{ type: 'arrosage', joursEte: 1, joursHiver: 0 }, { type: 'engrais', joursEte: 10, joursHiver: 0 }] },
  { nom: 'Fraisier', icone: '🍓', soins: [{ type: 'arrosage', joursEte: 2, joursHiver: 14 }, { type: 'engrais', joursEte: 14, joursHiver: 0 }] },
  { nom: 'Succulentes', icone: '🌵', soins: [{ type: 'arrosage', joursEte: 14, joursHiver: 30 }, { type: 'rempotage', joursEte: 730, joursHiver: null }] },
];

// ---- Saison ----

export function reglagesSaison(d) {
  const s = M(d).saison || {};
  return { debutEte: s.debutEte || 4, debutHiver: s.debutHiver || 10 };
}

// 'ete' ou 'hiver' pour une date « AAAA-MM-JJ ».
export function saisonDe(d, date) {
  const mois = Number(date.slice(5, 7));
  const { debutEte, debutHiver } = reglagesSaison(d);
  const ete = debutEte <= debutHiver ? mois >= debutEte && mois < debutHiver : mois >= debutEte || mois < debutHiver;
  return ete ? 'ete' : 'hiver';
}

export function definirSaison(d, { debutEte, debutHiver }) {
  const e = Math.min(12, Math.max(1, Math.round(Number(debutEte)) || 4));
  const h = Math.min(12, Math.max(1, Math.round(Number(debutHiver)) || 10));
  if (e === h) return false;
  M(d).saison = { debutEte: e, debutHiver: h };
  return true;
}

// ---- Plantes ----

export function ajouterPlante(d, { nom, emplacement, note, icone }) {
  const p = {
    id: nouvelId(),
    nom: nom.trim(),
    emplacement: (emplacement || '').trim(),
    note: (note || '').trim(),
    icone: (icone || '').trim() || '🪴',
    soins: [],
  };
  M(d).plantes.push(p);
  return p;
}

export function modifierPlante(d, id, { nom, emplacement, note, icone }) {
  const p = M(d).plantes.find((x) => x.id === id);
  if (!p) return;
  p.nom = nom.trim();
  p.emplacement = (emplacement || '').trim();
  p.note = (note || '').trim();
  p.icone = (icone || '').trim() || '🪴';
}

export function supprimerPlante(d, id) {
  const index = M(d).plantes.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [plante] = M(d).plantes.splice(index, 1);
  return { plante, index };
}

export function restaurerPlante(d, { plante, index }) {
  M(d).plantes.splice(Math.min(index, M(d).plantes.length), 0, plante);
}

export function planteParId(d, id) {
  return M(d).plantes.find((p) => p.id === id) || null;
}

// ---- Soins ----

function joursValides(v, defaut) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 3650) : defaut;
}

// joursHiver : un nombre de jours, 0 (« pas de soin en hiver ») ou null/vide (« comme l'été »).
function joursHiverValides(v) {
  if (v === null || v === undefined || v === '' || v === 'pareil') return null;
  if (v === 0 || v === '0' || v === 'aucun') return 0;
  return joursValides(v, null);
}

export function ajouterSoin(d, planteId, { type, joursEte, joursHiver, derniereFois, debut }) {
  const p = planteParId(d, planteId);
  if (!p) return null;
  const t = typeSoin(type).id;
  if (p.soins.some((s) => s.type === t)) return null; // un seul soin de chaque sorte par plante
  const s = {
    id: nouvelId(),
    type: t,
    joursEte: joursValides(joursEte, 7),
    joursHiver: joursHiverValides(joursHiver),
    // Un soin rare (rempotage, taille…) sans « dernière fois » n'est pas proposé tout de suite :
    // il arrive dans un mois, le temps de voir venir. Un arrosage, lui, est proposé aujourd'hui.
    debut: debut || (!derniereFois && joursValides(joursEte, 7) >= 90 ? ajouterJours(aujourdhui(), 30) : aujourdhui()),
    dernierInitial: derniereFois || null,
    repousseJusqua: null,
  };
  p.soins.push(s);
  return s;
}

export function soinParId(d, id) {
  for (const plante of M(d).plantes) {
    const soin = plante.soins.find((s) => s.id === id);
    if (soin) return { plante, soin };
  }
  return null;
}

export function modifierSoin(d, id, { type, joursEte, joursHiver, derniereFois }) {
  const r = soinParId(d, id);
  if (!r) return;
  const t = typeSoin(type).id;
  if (t !== r.soin.type && !r.plante.soins.some((s) => s.type === t)) r.soin.type = t;
  r.soin.joursEte = joursValides(joursEte, r.soin.joursEte);
  r.soin.joursHiver = joursHiverValides(joursHiver);
  r.soin.dernierInitial = derniereFois || null;
}

export function supprimerSoin(d, id) {
  for (const plante of M(d).plantes) {
    const index = plante.soins.findIndex((s) => s.id === id);
    if (index !== -1) {
      const [soin] = plante.soins.splice(index, 1);
      return { planteId: plante.id, soin, index };
    }
  }
  return null;
}

export function restaurerSoin(d, { planteId, soin, index }) {
  const p = planteParId(d, planteId);
  if (p) p.soins.splice(Math.min(index, p.soins.length), 0, soin);
}

export function repousserSoin(d, id, jusquA) {
  const r = soinParId(d, id);
  if (r) r.soin.repousseJusqua = jusquA;
}

export function marquerSoinFait(d, id, date) {
  d.coches[`${PREFIXE}${id}|${date}`] = new Date().toISOString();
  const r = soinParId(d, id);
  if (r) r.soin.repousseJusqua = null;
}

export function annulerSoinFait(d, id, date) {
  delete d.coches[`${PREFIXE}${id}|${date}`];
}

export function soinFait(d, id, date) {
  return Boolean(d.coches[`${PREFIXE}${id}|${date}`]);
}

// ---- Où en est chaque soin ----

export function derniereFoisSoins(d) {
  const m = new Map();
  for (const p of M(d).plantes) for (const s of p.soins) if (s.dernierInitial) m.set(s.id, s.dernierInitial);
  for (const cle of Object.keys(d.coches)) {
    if (!cle.startsWith(PREFIXE)) continue;
    const [, id, date] = cle.split('|');
    if (!m.has(id) || m.get(id) < date) m.set(id, date);
  }
  return m;
}

// Le rythme qui compte à cette date : un nombre de jours, ou 0 (« pas de soin en hiver »).
export function rythmePour(soin, saison) {
  if (saison === 'ete') return soin.joursEte;
  return soin.joursHiver === null || soin.joursHiver === undefined ? soin.joursEte : soin.joursHiver;
}

export function etatSoin(d, soin, date, derniere) {
  const saison = saisonDe(d, date);
  const jours = rythmePour(soin, saison);
  if (!jours) return { pause: true, due: false, repousse: false, derniere, depuis: null, joursAvant: 0, saison, jours: 0, ratio: 0 };
  const base = etatTache({ intervalleJours: jours, debut: soin.debut, repousseJusqua: soin.repousseJusqua }, date, derniere);
  return { ...base, pause: false, saison, jours };
}

export function texteSoin(etat) {
  return etat.pause ? 'en pause cet hiver' : texteCourt(etat);
}

// La ligne d'information d'un soin : où il en est, et son rythme (sans répéter la pause).
export function statutSoin(soin, etat) {
  if (etat.pause) return `en pause cet hiver · ${nomIntervalle(soin.joursEte).toLowerCase()} en été`;
  return `${texteCourt(etat)} · ${resumeRythme(soin)}`;
}

// « Chaque semaine en été · tous les 14 jours en hiver » (court, pour la fiche d'un soin).
export function resumeRythme(soin) {
  const ete = nomIntervalle(soin.joursEte).toLowerCase();
  if (soin.joursHiver === null || soin.joursHiver === undefined) return ete;
  if (soin.joursHiver === 0) return `${ete} en été · en pause l'hiver`;
  return `${ete} en été · ${nomIntervalle(soin.joursHiver).toLowerCase()} en hiver`;
}

// ---- Ce qu'on propose chaque jour ----

// Les soins d'un type pour une date : ceux déjà faits ce jour-là, puis ceux « à faire bientôt ».
// Aucune limite par jour : un arrosage ne se repousse pas comme un coup de balai. Tout est regroupé en une ligne.
export function soinsDuJour(d, typeId, date, aujourdhuiCle = aujourdhui()) {
  const map = derniereFoisSoins(d);
  const liste = [];
  for (const plante of M(d).plantes) {
    if (plante.archivee) continue;
    for (const soin of plante.soins) {
      if (soin.type !== typeId) continue;
      const fait = soinFait(d, soin.id, date);
      const etat = etatSoin(d, soin, date, map.get(soin.id) || null);
      if (fait || (date === aujourdhuiCle && etat.due)) liste.push({ plante, soin, etat, fait });
    }
  }
  return liste;
}

// Combien de soins de la maison attendent aujourd'hui (pour les résumés).
export function aFaireAujourdhui(d, date = aujourdhui()) {
  return TYPES_SOIN.flatMap((t) => soinsDuJour(d, t.id, date, date).filter((x) => !x.fait).map((x) => ({ ...x, type: t })));
}

function nomsCourts(plantes) {
  const noms = plantes.map((p) => p.nom);
  return noms.length <= 3 ? noms.join(', ') : `${noms.slice(0, 3).join(', ')} + ${noms.length - 3}`;
}

export function titreGroupe(typeId, liste) {
  const t = typeSoin(typeId);
  return `${t.icone} ${t.verbe} : ${nomsCourts(liste.map((x) => x.plante))}`;
}

// Tout cocher / tout décocher pour un type de soin, un jour donné.
export function cocherGroupe(d, typeId, date, aujourdhuiCle = aujourdhui()) {
  const liste = soinsDuJour(d, typeId, date, aujourdhuiCle);
  const toutFait = liste.length > 0 && liste.every((x) => x.fait);
  for (const x of liste) {
    if (toutFait) annulerSoinFait(d, x.soin.id, date);
    else if (!x.fait) marquerSoinFait(d, x.soin.id, date);
  }
}

// ---- Idées de départ ----

export function ajouterIdeesPlantes(d, noms) {
  let n = 0;
  for (const nom of noms) {
    const idee = IDEES_PLANTES.find((i) => i.nom === nom);
    if (!idee) continue;
    if (M(d).plantes.some((p) => p.nom.toLowerCase() === idee.nom.toLowerCase())) continue;
    const p = ajouterPlante(d, { nom: idee.nom, icone: idee.icone, emplacement: 'Balcon' });
    for (const s of idee.soins) ajouterSoin(d, p.id, s);
    n++;
  }
  return n;
}

// ---- Ce qui alimente la journée ----

enregistrerFournisseur((date, donnees) => {
  if (!donnees.maison?.plantes?.length) return [];
  return TYPES_SOIN.flatMap((t) => {
    const liste = soinsDuJour(donnees, t.id, date);
    if (!liste.length) return [];
    return [
      {
        source: 'maison-plantes',
        id: t.id,
        date,
        titre: titreGroupe(t.id, liste),
        categorieId: 'maison',
        type: 'tache',
        recurrent: true,
        discret: true, // propre à la maison : la vue Semaine reste légère
        fait: liste.every((x) => x.fait),
      },
    ];
  });
});

