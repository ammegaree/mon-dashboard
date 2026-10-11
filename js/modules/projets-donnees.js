// Maison › Projets : un grand « à faire » découpé en petites étapes (ranger l'entrée, repeindre…).
//
// Une seule étape à la fois : seule la PROCHAINE étape d'un projet « en cours » apparaît dans Aujourd'hui.
// Cocher une étape n'en fait pas apparaître une autre le même jour : la suivante arrive demain.
// Aucune date limite, rien n'est jamais « en retard » : un projet avance à ton rythme.
// Règles et calculs seulement (pas d'affichage).

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';
import { aujourdhui } from '../dates.js';

const M = (d) => d.maison;

// Des idées de projets, déjà découpés. On en choisit, on modifie ensuite.
export const IDEES_PROJETS = [
  { titre: "Ranger l'entrée", icone: '🚪', etapes: [
    { titre: "Vider un meuble, une étagère ou un sac", dureeMin: 10 },
    { titre: 'Trier : garder, donner, jeter', dureeMin: 15 },
    { titre: 'Nettoyer les surfaces', dureeMin: 10 },
    { titre: 'Remettre en place ce qui reste', dureeMin: 10 },
  ] },
  { titre: 'Grand tri d’un placard', icone: '🧺', etapes: [
    { titre: 'Choisir un seul placard' },
    { titre: 'Tout sortir', dureeMin: 10 },
    { titre: 'Trier : garder, donner, jeter', dureeMin: 20 },
    { titre: "Nettoyer l'intérieur", dureeMin: 10 },
    { titre: 'Tout remettre, par familles', dureeMin: 15 },
    { titre: 'Déposer ce qui est donné' },
  ] },
  { titre: 'Repeindre une pièce', icone: '🎨', etapes: [
    { titre: 'Choisir la couleur et la quantité' },
    { titre: 'Acheter peinture et matériel' },
    { titre: 'Dégager et protéger les meubles' },
    { titre: 'Reboucher et poncer' },
    { titre: 'Peindre : première couche' },
    { titre: 'Peindre : deuxième couche' },
    { titre: 'Remettre la pièce en place' },
  ] },
  { titre: 'Installer un nouveau meuble', icone: '🛋️', etapes: [
    { titre: "Mesurer l'emplacement", dureeMin: 10 },
    { titre: 'Choisir et comparer' },
    { titre: 'Commander' },
    { titre: 'Préparer la place', dureeMin: 15 },
    { titre: 'Monter ou installer' },
    { titre: "Évacuer l'emballage", dureeMin: 10 },
  ] },
  { titre: 'Aménager le balcon', icone: '🌿', etapes: [
    { titre: "Faire le point sur ce que j'ai" },
    { titre: 'Choisir ce que je veux ajouter' },
    { titre: 'Acheter pots et terreau' },
    { titre: 'Installer et planter' },
  ] },
  { titre: 'Mettre mes papiers en ordre', icone: '🗂️', etapes: [
    { titre: 'Rassembler tous les papiers au même endroit', dureeMin: 10 },
    { titre: 'Trier : à garder, à jeter', dureeMin: 20 },
    { titre: 'Classer par catégories', dureeMin: 20 },
    { titre: "Numériser l'essentiel" },
    { titre: 'Ranger le classeur', dureeMin: 5 },
  ] },
];

function dureeOuNull(v) {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : null;
}

// ---- Projets ----

export function projetParId(d, id) {
  return M(d).projets.find((p) => p.id === id) || null;
}

export function ajouterProjet(d, { titre, icone, note }) {
  // Un projet neuf se lance tout de suite s'il y en a moins de deux en cours : une chose à la fois.
  const enCours = M(d).projets.filter((p) => p.enCours && !termine(p)).length < 2;
  const p = { id: nouvelId(), titre: titre.trim(), icone: (icone || '').trim() || '🧱', note: (note || '').trim(), enCours, etapes: [] };
  M(d).projets.push(p);
  return p;
}

export function modifierProjet(d, id, { titre, icone, note }) {
  const p = projetParId(d, id);
  if (!p) return;
  p.titre = titre.trim();
  p.icone = (icone || '').trim() || '🧱';
  p.note = (note || '').trim();
}

export function definirEnCours(d, id, valeur) {
  const p = projetParId(d, id);
  if (p) p.enCours = Boolean(valeur);
}

export function supprimerProjet(d, id) {
  const index = M(d).projets.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const [projet] = M(d).projets.splice(index, 1);
  return { projet, index };
}

export function restaurerProjet(d, { projet, index }) {
  M(d).projets.splice(Math.min(index, M(d).projets.length), 0, projet);
}

// ---- Étapes ----

export function ajouterEtape(d, projetId, { titre, dureeMin }) {
  const p = projetParId(d, projetId);
  if (!p || !String(titre || '').trim()) return null;
  const e = { id: nouvelId(), titre: titre.trim(), dureeMin: dureeOuNull(dureeMin), faitLe: null };
  p.etapes.push(e);
  return e;
}

// Une étape par ligne.
export function ajouterEtapes(d, projetId, texte) {
  return String(texte || '')
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean)
    .map((titre) => ajouterEtape(d, projetId, { titre }))
    .filter(Boolean);
}

export function etapeParId(d, id) {
  for (const projet of M(d).projets) {
    const etape = projet.etapes.find((e) => e.id === id);
    if (etape) return { projet, etape };
  }
  return null;
}

export function modifierEtape(d, id, { titre, dureeMin }) {
  const r = etapeParId(d, id);
  if (!r || !String(titre || '').trim()) return;
  r.etape.titre = titre.trim();
  r.etape.dureeMin = dureeOuNull(dureeMin);
}

export function supprimerEtape(d, id) {
  for (const projet of M(d).projets) {
    const index = projet.etapes.findIndex((e) => e.id === id);
    if (index !== -1) {
      const [etape] = projet.etapes.splice(index, 1);
      return { projetId: projet.id, etape, index };
    }
  }
  return null;
}

export function restaurerEtape(d, { projetId, etape, index }) {
  const p = projetParId(d, projetId);
  if (p) p.etapes.splice(Math.min(index, p.etapes.length), 0, etape);
}

export function deplacerEtape(d, id, delta) {
  const r = etapeParId(d, id);
  if (!r) return;
  const i = r.projet.etapes.indexOf(r.etape);
  const j = i + delta;
  if (j < 0 || j >= r.projet.etapes.length) return;
  [r.projet.etapes[i], r.projet.etapes[j]] = [r.projet.etapes[j], r.projet.etapes[i]];
}

export function cocherEtape(d, id, date = aujourdhui()) {
  const r = etapeParId(d, id);
  if (r) r.etape.faitLe = date;
}

export function decocherEtape(d, id) {
  const r = etapeParId(d, id);
  if (r) r.etape.faitLe = null;
}

// ---- Où en est un projet ----

export function progression(p) {
  const total = p.etapes.length;
  const faites = p.etapes.filter((e) => e.faitLe).length;
  return { total, faites, pourcent: total ? Math.round((faites / total) * 100) : 0 };
}

export function termine(p) {
  return p.etapes.length > 0 && p.etapes.every((e) => e.faitLe);
}

// La prochaine étape : la première, dans l'ordre, qui n'est pas faite.
export function prochaineEtape(p) {
  return p.etapes.find((e) => !e.faitLe) || null;
}

// Ce qui est proposé un jour donné : pour chaque projet « en cours », sa prochaine étape ;
// si une de ses étapes a été faite ce jour-là, on montre celle-là (cochée) et pas la suivante.
export function etapesDuJour(d, date, aujourdhuiCle = aujourdhui()) {
  const liste = [];
  for (const projet of M(d).projets) {
    const faitesCeJour = projet.etapes.filter((e) => e.faitLe === date);
    for (const etape of faitesCeJour) liste.push({ projet, etape, fait: true });
    if (faitesCeJour.length === 0 && date === aujourdhuiCle && projet.enCours) {
      const suivante = prochaineEtape(projet);
      if (suivante) liste.push({ projet, etape: suivante, fait: false });
    }
  }
  return liste;
}

// ---- Idées de départ ----

export function ajouterIdeesProjets(d, titres) {
  let n = 0;
  for (const titre of titres) {
    const idee = IDEES_PROJETS.find((i) => i.titre === titre);
    if (!idee) continue;
    if (M(d).projets.some((p) => p.titre.toLowerCase() === idee.titre.toLowerCase())) continue;
    const p = ajouterProjet(d, { titre: idee.titre, icone: idee.icone });
    for (const e of idee.etapes) ajouterEtape(d, p.id, e);
    n++;
  }
  return n;
}

// ---- Ce qui alimente la journée ----

enregistrerFournisseur((date, donnees) =>
  etapesDuJour(donnees, date).map(({ projet, etape, fait }) => ({
    source: 'maison-etape',
    id: etape.id,
    date,
    titre: `${projet.icone} ${projet.titre} : ${etape.titre}`,
    categorieId: 'maison',
    type: 'tache',
    fait,
    discret: true, // une étape n'a pas de jour fixe : la vue Semaine reste légère
  }))
);
