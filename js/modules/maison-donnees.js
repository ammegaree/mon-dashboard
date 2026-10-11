// Maison : ménage et entretien « à rythme souple ».
//
// Une tâche revient un certain temps après la dernière fois où elle a été faite
// (« chaque semaine », « tous les 3 mois »…), et non un jour fixe. Si elle est repoussée,
// rien ne devient « en retard » : elle est simplement « à faire bientôt ».
// Chaque jour, quelques tâches seulement sont proposées dans Aujourd'hui (par défaut 2),
// pour que tout ne tombe jamais en même temps.
// Règles et calculs seulement (pas d'affichage).

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';
import { ajouterJours, aujourdhui, depuisCle } from '../dates.js';

const M = (d) => d.maison;
const PREFIXE = 'maison-tache|';

export const INTERVALLES = [
  { jours: 1, nom: 'Chaque jour' },
  { jours: 2, nom: 'Tous les 2 jours' },
  { jours: 3, nom: 'Tous les 3 jours' },
  { jours: 7, nom: 'Chaque semaine' },
  { jours: 14, nom: 'Toutes les 2 semaines' },
  { jours: 30, nom: 'Chaque mois' },
  { jours: 60, nom: 'Tous les 2 mois' },
  { jours: 90, nom: 'Tous les 3 mois' },
  { jours: 180, nom: 'Tous les 6 mois' },
  { jours: 365, nom: 'Chaque année' },
];

export function nomIntervalle(jours) {
  const connu = INTERVALLES.find((i) => i.jours === jours);
  if (connu) return connu.nom;
  if (jours > 365 && jours % 365 === 0) return `Tous les ${jours / 365} ans`;
  return `Tous les ${jours} jours`;
}

// Des idées pour démarrer : on en choisit, on ne subit rien.
export const MODELES = [
  { zone: 'Cuisine', icone: '🍳', taches: [
    { titre: "Nettoyer le plan de travail et l'évier", intervalleJours: 3, dureeMin: 10 },
    { titre: 'Passer le sol', intervalleJours: 7, dureeMin: 15 },
    { titre: 'Nettoyer le four', intervalleJours: 90, dureeMin: 30 },
    { titre: 'Nettoyer le frigo', intervalleJours: 90, dureeMin: 20 },
  ] },
  { zone: 'Salle de bain', icone: '🚿', taches: [
    { titre: 'Nettoyer lavabo et douche', intervalleJours: 7, dureeMin: 20 },
    { titre: 'Laver les serviettes', intervalleJours: 7, dureeMin: 5 },
    { titre: 'Nettoyer les joints et les robinets', intervalleJours: 30, dureeMin: 20 },
  ] },
  { zone: 'Chambre', icone: '🛏️', taches: [
    { titre: 'Changer les draps', intervalleJours: 14, dureeMin: 15 },
    { titre: 'Aérer et dépoussiérer', intervalleJours: 7, dureeMin: 10 },
    { titre: 'Retourner le matelas', intervalleJours: 180, dureeMin: 10 },
  ] },
  { zone: 'Salon', icone: '🛋️', taches: [
    { titre: "Passer l'aspirateur", intervalleJours: 7, dureeMin: 20 },
    { titre: 'Dépoussiérer les meubles', intervalleJours: 7, dureeMin: 10 },
    { titre: 'Laver les vitres', intervalleJours: 90, dureeMin: 30 },
  ] },
  { zone: 'Entretien', icone: '🔧', taches: [
    { titre: 'Détartrer la bouilloire', intervalleJours: 30, dureeMin: 10 },
    { titre: 'Nettoyer le filtre du lave-linge', intervalleJours: 90, dureeMin: 10 },
    { titre: 'Nettoyer les filtres de la hotte', intervalleJours: 90, dureeMin: 15 },
    { titre: 'Vérifier les piles du détecteur de fumée', intervalleJours: 180, dureeMin: 5 },
  ] },
  { zone: 'Balcon', icone: '🌿', taches: [
    { titre: 'Balayer et nettoyer le balcon', intervalleJours: 14, dureeMin: 15 },
  ] },
];

// ---- Zones ----

export function ajouterZone(d, { nom, icone }) {
  const z = { id: nouvelId(), nom: nom.trim(), icone: (icone || '').trim() || '🏡' };
  M(d).zones.push(z);
  return z;
}

export function modifierZone(d, id, { nom, icone }) {
  const z = M(d).zones.find((x) => x.id === id);
  if (!z) return;
  z.nom = nom.trim();
  z.icone = (icone || '').trim() || '🏡';
}

// Supprime la zone et ses tâches. L'historique des « faits » reste dans les cases cochées.
export function supprimerZone(d, id) {
  M(d).zones = M(d).zones.filter((z) => z.id !== id);
  M(d).taches = M(d).taches.filter((t) => t.zoneId !== id);
}

export function zoneParId(d, id) {
  return M(d).zones.find((z) => z.id === id) || null;
}

// ---- Tâches ----

function intervalleValide(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 3650) : 7;
}

function dureeOuNull(v) {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : null;
}

// `derniereFois` : la dernière fois où c'était fait (facultatif). Inconnue = « à faire dès que possible ».
export function ajouterTacheMaison(d, { zoneId, titre, intervalleJours, dureeMin, derniereFois, debut }) {
  const t = {
    id: nouvelId(),
    zoneId,
    titre: titre.trim(),
    intervalleJours: intervalleValide(intervalleJours),
    dureeMin: dureeOuNull(dureeMin),
    debut: debut || aujourdhui(),
    dernierInitial: derniereFois || null,
    repousseJusqua: null,
    archivee: false,
  };
  M(d).taches.push(t);
  return t;
}

export function modifierTacheMaison(d, id, { zoneId, titre, intervalleJours, dureeMin, derniereFois }) {
  const t = M(d).taches.find((x) => x.id === id);
  if (!t) return;
  t.zoneId = zoneId;
  t.titre = titre.trim();
  t.intervalleJours = intervalleValide(intervalleJours);
  t.dureeMin = dureeOuNull(dureeMin);
  t.dernierInitial = derniereFois || null;
}

export function supprimerTacheMaison(d, id) {
  const index = M(d).taches.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [tache] = M(d).taches.splice(index, 1);
  return { tache, index };
}

export function restaurerTacheMaison(d, { tache, index }) {
  M(d).taches.splice(Math.min(index, M(d).taches.length), 0, tache);
}

// « Plus tard » : la tâche ne sera pas proposée avant cette date.
export function repousser(d, id, jusquA) {
  const t = M(d).taches.find((x) => x.id === id);
  if (t) t.repousseJusqua = jusquA;
}

export function reprendre(d, id) {
  const t = M(d).taches.find((x) => x.id === id);
  if (t) t.repousseJusqua = null;
}

export function marquerFait(d, id, date) {
  d.coches[`${PREFIXE}${id}|${date}`] = new Date().toISOString();
  const t = M(d).taches.find((x) => x.id === id);
  if (t) t.repousseJusqua = null;
}

export function annulerFait(d, id, date) {
  delete d.coches[`${PREFIXE}${id}|${date}`];
}

export function estFait(d, id, date) {
  return Boolean(d.coches[`${PREFIXE}${id}|${date}`]);
}

// ---- Où en est chaque tâche ----

function ecart(a, b) {
  const x = depuisCle(a);
  const y = depuisCle(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
}

// Pour chaque tâche, la dernière date où elle a été faite.
export function derniereFoisMap(d) {
  const m = new Map();
  for (const t of M(d).taches) if (t.dernierInitial) m.set(t.id, t.dernierInitial);
  for (const cle of Object.keys(d.coches)) {
    if (!cle.startsWith(PREFIXE)) continue;
    const [, id, date] = cle.split('|');
    if (!m.has(id) || m.get(id) < date) m.set(id, date);
  }
  return m;
}

// `derniere` : la dernière fois (ou null). `date` : le jour pour lequel on regarde.
export function etatTache(t, date, derniere) {
  const echeance = derniere ? ajouterJours(derniere, t.intervalleJours) : t.debut;
  const joursAvant = ecart(date, echeance); // > 0 : dans N jours ; ≤ 0 : à faire
  const repousse = Boolean(t.repousseJusqua && t.repousseJusqua > date);
  const depuis = derniere ? ecart(derniere, date) : null;
  return {
    derniere,
    echeance,
    joursAvant,
    depuis,
    due: joursAvant <= 0 && !repousse,
    repousse,
    // Plus c'est « ancien » par rapport au rythme, plus c'est proposé tôt.
    ratio: derniere ? depuis / t.intervalleJours : 1 + Math.min(0.5, Math.max(0, ecart(t.debut, date)) / 100),
  };
}

// Un texte doux et court : ce qui a été fait, et ce qui vient.
export function texteStatut(etat) {
  if (etat.repousse) return etat.derniere ? `${faitIlYa(etat)} · repoussé` : 'repoussé';
  if (etat.due) return etat.derniere ? `${faitIlYa(etat)} · à faire bientôt` : 'à faire bientôt';
  const jours = `${etat.joursAvant} jour${etat.joursAvant > 1 ? 's' : ''}`;
  return etat.derniere ? `${faitIlYa(etat)} · prochaine fois dans ${jours}` : `proposée dans ${jours}`;
}

// Version très courte, pour les listes : un seul petit mot par ligne.
export function texteCourt(etat) {
  if (etat.repousse) return 'repoussé';
  if (etat.due) return 'à faire bientôt';
  if (etat.derniere && etat.depuis <= 0) return "fait aujourd'hui";
  const j = etat.joursAvant;
  if (j <= 1) return 'demain';
  if (j >= 60) return `dans ${Math.round(j / 30)} mois`;
  return `dans ${j} jours`;
}

function faitIlYa(etat) {
  if (etat.depuis <= 0) return "fait aujourd'hui";
  if (etat.depuis === 1) return 'fait hier';
  return `fait il y a ${etat.depuis} jours`;
}

// ---- Ce qu'on propose chaque jour ----

// Quelques tâches seulement (par défaut 2), les plus « anciennes » par rapport à leur rythme.
// Celles déjà faites ce jour-là comptent dans ce nombre : cocher n'en fait jamais apparaître une autre.
export function selectionDuJour(d, date, aujourdhuiCle = aujourdhui()) {
  const map = derniereFoisMap(d);
  const actives = M(d).taches.filter((t) => !t.archivee && zoneParId(d, t.zoneId));
  const faites = actives.filter((t) => estFait(d, t.id, date));
  if (date < aujourdhuiCle) return faites;
  if (date > aujourdhuiCle) return [];

  const places = Math.max(0, (M(d).parJour ?? 2) - faites.length);
  const ids = new Set(faites.map((t) => t.id));
  const candidates = actives
    .filter((t) => !ids.has(t.id))
    .map((t) => ({ t, etat: etatTache(t, date, map.get(t.id) || null) }))
    .filter((x) => x.etat.due)
    .sort((a, b) => b.etat.ratio - a.etat.ratio || a.t.titre.localeCompare(b.t.titre, 'fr'))
    .slice(0, places)
    .map((x) => x.t);
  candidates.forEach((t) => ids.add(t.id));
  // Ordre stable (celui de la liste) : rien ne bouge quand on coche.
  return actives.filter((t) => ids.has(t.id));
}

// Toutes les tâches « à faire bientôt » (pour la page Maison), les plus anciennes d'abord.
export function aFaireBientot(d, date = aujourdhui()) {
  const map = derniereFoisMap(d);
  return M(d)
    .taches.filter((t) => !t.archivee && zoneParId(d, t.zoneId))
    .map((t) => ({ t, etat: etatTache(t, date, map.get(t.id) || null) }))
    .filter((x) => x.etat.due)
    .sort((a, b) => b.etat.ratio - a.etat.ratio);
}

// ---- Idées de départ ----

// `choix` : [{ zone, titre }]. Crée les zones qui manquent et les tâches choisies (sans doublon).
// Les tâches arrivent progressivement (autant par jour que « proposées chaque jour »), pour ne jamais
// se retrouver avec tout à faire d'un coup.
export function ajouterModeles(d, choix, aujourdhuiCle = aujourdhui()) {
  let zones = 0;
  let taches = 0;
  const parJour = Math.max(1, M(d).parJour ?? 2);
  for (const c of choix) {
    const modele = MODELES.find((m) => m.zone === c.zone);
    const tache = modele?.taches.find((t) => t.titre === c.titre);
    if (!modele || !tache) continue;
    let zone = M(d).zones.find((z) => z.nom.toLowerCase() === modele.zone.toLowerCase());
    if (!zone) {
      zone = ajouterZone(d, { nom: modele.zone, icone: modele.icone });
      zones++;
    }
    const existe = M(d).taches.some((t) => t.zoneId === zone.id && t.titre.toLowerCase() === tache.titre.toLowerCase());
    if (existe) continue;
    ajouterTacheMaison(d, { zoneId: zone.id, ...tache, debut: ajouterJours(aujourdhuiCle, Math.floor(taches / parJour)) });
    taches++;
  }
  return { zones, taches };
}

// ---- Ce qui alimente la journée ----

enregistrerFournisseur((date, donnees) =>
  selectionDuJour(donnees, date).map((t) => {
    const zone = zoneParId(donnees, t.zoneId);
    return {
      source: 'maison-tache',
      id: t.id,
      date,
      titre: `${zone.icone} ${zone.nom} : ${t.titre}`,
      categorieId: 'maison',
      type: 'tache',
      recurrent: true,
      discret: true, // des suggestions souples, pas des rendez-vous : la vue Semaine reste légère
    };
  })
);
