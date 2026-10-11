// Catégories du calendrier : des étiquettes (Perso, Social, Rendez-vous…) qui servent seulement
// à ranger les rendez-vous et les tâches du calendrier.
//
// Ce ne sont PAS des domaines de vie : elles n'ont ni page, ni entrée dans le menu.
// Elles vivent à côté des domaines (donnees.categories), dans donnees.categoriesAgenda.
// Règles seulement (pas d'affichage).

import { PALETTE, nouvelId } from '../schema.js';

const COULEURS = PALETTE.map((p) => p.id);

export function categoriesAgenda(d) {
  return Array.isArray(d.categoriesAgenda) ? d.categoriesAgenda : [];
}

// Les domaines puis les catégories du calendrier.
export function toutesLesCategories(d) {
  return [...d.categories, ...categoriesAgenda(d)];
}

// La catégorie d'un élément : un domaine, une catégorie du calendrier, ou « Autre » si elle a disparu.
export function categorieParId(d, id) {
  return toutesLesCategories(d).find((c) => c.id === id) || d.categories.find((c) => c.id === 'autre') || d.categories[0];
}

export function estCategorieAgenda(d, id) {
  return categoriesAgenda(d).some((c) => c.id === id);
}

const texte = (v, max) => String(v ?? '').trim().slice(0, max);

function fabriquerId(nom, d) {
  const base =
    nom
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'categorie';
  const pris = new Set(toutesLesCategories(d).map((c) => c.id));
  let id = `agenda-${base}`;
  let n = 2;
  while (pris.has(id)) id = `agenda-${base}-${n++}`;
  return id;
}

// Une catégorie du calendrier porte-t-elle déjà ce nom ? (sans tenir compte des majuscules)
export function nomDejaPris(d, nom, sauf = null) {
  const n = texte(nom, 40).toLowerCase();
  return categoriesAgenda(d).some((c) => c.id !== sauf && c.nom.toLowerCase() === n);
}

export function ajouterCategorieAgenda(d, { nom, couleur, icone }) {
  const n = texte(nom, 40);
  if (!n || nomDejaPris(d, n)) return null;
  if (!Array.isArray(d.categoriesAgenda)) d.categoriesAgenda = [];
  const cat = {
    id: fabriquerId(n, d),
    nom: n,
    couleur: COULEURS.includes(couleur) ? couleur : 'rose',
    icone: texte(icone, 8) || '🏷️',
  };
  d.categoriesAgenda.push(cat);
  return cat;
}

export function modifierCategorieAgenda(d, id, { nom, couleur, icone }) {
  const cat = categoriesAgenda(d).find((c) => c.id === id);
  const n = texte(nom, 40);
  if (!cat || !n || nomDejaPris(d, n, id)) return null;
  cat.nom = n;
  if (COULEURS.includes(couleur)) cat.couleur = couleur;
  cat.icone = texte(icone, 8) || cat.icone;
  return cat;
}

// Supprime la catégorie. Les rendez-vous et tâches qui l'utilisent ne sont pas supprimés :
// ils passent en « Autre ». Rend de quoi tout remettre (voir `restaurerCategorieAgenda`).
export function supprimerCategorieAgenda(d, id) {
  const liste = categoriesAgenda(d);
  const i = liste.findIndex((c) => c.id === id);
  if (i === -1) return null;
  const [categorie] = liste.splice(i, 1);
  const rdvIds = [];
  const tacheIds = [];
  for (const r of d.rendezvous || []) {
    if (r.categorieId === id) {
      r.categorieId = 'autre';
      rdvIds.push(r.id);
    }
  }
  for (const t of d.taches || []) {
    if (t.categorieId === id) {
      t.categorieId = 'autre';
      tacheIds.push(t.id);
    }
  }
  return { categorie, index: i, rdvIds, tacheIds };
}

export function restaurerCategorieAgenda(d, retire) {
  if (!retire) return;
  if (!Array.isArray(d.categoriesAgenda)) d.categoriesAgenda = [];
  if (d.categoriesAgenda.some((c) => c.id === retire.categorie.id)) return;
  d.categoriesAgenda.splice(Math.min(retire.index, d.categoriesAgenda.length), 0, retire.categorie);
  for (const r of d.rendezvous || []) if (retire.rdvIds.includes(r.id)) r.categorieId = retire.categorie.id;
  for (const t of d.taches || []) if (retire.tacheIds.includes(t.id)) t.categorieId = retire.categorie.id;
}

// Combien de rendez-vous et de tâches utilisent cette catégorie (pour prévenir avant de supprimer).
export function usagesCategorieAgenda(d, id) {
  return {
    rdv: (d.rendezvous || []).filter((r) => r.categorieId === id).length,
    taches: (d.taches || []).filter((t) => t.categorieId === id).length,
  };
}

// Ne garde que les éléments dont la catégorie est dans `ids` (un Set). Un Set vide = pas de filtre, on garde tout.
export function filtrerParCategories(d, elements, ids) {
  if (!ids || ids.size === 0) return elements;
  return elements.filter((e) => ids.has(categorieParId(d, e.categorieId).id));
}
