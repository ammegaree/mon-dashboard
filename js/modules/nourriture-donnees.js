// Nourriture : planning des repas de la semaine et liste de courses.
// Aucun compteur de calories ni de macros : on planifie, on ne mesure pas.
// Règles et calculs seulement (pas d'affichage).

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';
import { ajouterJours } from '../dates.js';

const N = (d) => d.nourriture;

export const MOMENTS = [
  { id: 'petit-dejeuner', nom: 'Petit-déjeuner', court: 'Petit-déj', icone: '🥣' },
  { id: 'dejeuner', nom: 'Déjeuner', court: 'Déjeuner', icone: '🥗' },
  { id: 'diner', nom: 'Dîner', court: 'Dîner', icone: '🍲' },
  { id: 'collation', nom: 'Collation', court: 'Collation', icone: '🍎' },
];

export function momentParId(id) {
  return MOMENTS.find((m) => m.id === id) || MOMENTS[1];
}

function ordreMoment(id) {
  const i = MOMENTS.findIndex((m) => m.id === id);
  return i === -1 ? 99 : i;
}

// Une ligne = un ingrédient. Lignes vides, puces et doublons retirés.
export function lireIngredients(texte) {
  const vus = new Set();
  return String(texte || '')
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*[-•*–]\s+/, '').trim())
    .filter((l) => {
      const cle = normaliser(l);
      if (!l || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
}

function normaliser(texte) {
  return String(texte).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// ---- Repas ----

export function ajouterRepas(d, { date, moment, texte, ingredients }) {
  const r = {
    id: nouvelId(),
    date,
    moment: MOMENTS.some((m) => m.id === moment) ? moment : 'dejeuner',
    texte: texte.trim(),
    ingredients: Array.isArray(ingredients) ? ingredients : lireIngredients(ingredients),
  };
  N(d).repas.push(r);
  return r;
}

export function modifierRepas(d, id, { date, moment, texte, ingredients }) {
  const r = N(d).repas.find((x) => x.id === id);
  if (!r) return;
  r.date = date;
  r.moment = MOMENTS.some((m) => m.id === moment) ? moment : r.moment;
  r.texte = texte.trim();
  r.ingredients = Array.isArray(ingredients) ? ingredients : lireIngredients(ingredients);
}

export function supprimerRepas(d, id) {
  const index = N(d).repas.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [repas] = N(d).repas.splice(index, 1);
  for (const cle of Object.keys(d.coches)) if (cle.startsWith(`repas|${id}|`)) delete d.coches[cle];
  return { repas, index };
}

export function restaurerRepas(d, { repas, index }) {
  N(d).repas.splice(Math.min(index, N(d).repas.length), 0, repas);
}

export function repasDuJour(d, date) {
  return N(d)
    .repas.filter((r) => r.date === date)
    .sort((a, b) => ordreMoment(a.moment) - ordreMoment(b.moment));
}

// Les repas d'une semaine (du lundi), rangés : { 'AAAA-MM-JJ': { moment: [repas…] } }
export function planningSemaine(d, lundi) {
  const grille = {};
  for (let i = 0; i < 7; i++) {
    const date = ajouterJours(lundi, i);
    grille[date] = Object.fromEntries(MOMENTS.map((m) => [m.id, []]));
  }
  for (const r of N(d).repas) {
    if (grille[r.date]) grille[r.date][r.moment]?.push(r);
  }
  return grille;
}

// ---- Liste de courses ----

export function ajouterCourse(d, { texte, origine = 'main' }) {
  const t = texte.trim();
  if (!t) return null;
  const c = { id: nouvelId(), texte: t, coche: false, origine, creeLe: new Date().toISOString() };
  N(d).courses.push(c);
  return c;
}

export function basculerCourse(d, id) {
  const c = N(d).courses.find((x) => x.id === id);
  if (c) c.coche = !c.coche;
  return c ? c.coche : null;
}

export function supprimerCourse(d, id) {
  const index = N(d).courses.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [course] = N(d).courses.splice(index, 1);
  return { course, index };
}

export function restaurerCourse(d, { course, index }) {
  N(d).courses.splice(Math.min(index, N(d).courses.length), 0, course);
}

// Retire les articles cochés ; rend de quoi les remettre.
export function retirerCochees(d) {
  const retirees = N(d).courses.map((c, index) => ({ course: c, index })).filter((x) => x.course.coche);
  N(d).courses = N(d).courses.filter((c) => !c.coche);
  return retirees;
}

export function restaurerCochees(d, retirees) {
  for (const { course, index } of [...retirees].sort((a, b) => a.index - b.index)) {
    N(d).courses.splice(Math.min(index, N(d).courses.length), 0, course);
  }
}

// Ajoute à la liste des ingrédients (sans doublon avec ce qui reste à acheter). Rend le nombre ajouté.
export function ajouterIngredients(d, ingredients, origine = 'repas') {
  const dejaLa = new Set(N(d).courses.filter((c) => !c.coche).map((c) => normaliser(c.texte)));
  let ajoutes = 0;
  for (const ing of ingredients) {
    const cle = normaliser(ing);
    if (!cle || dejaLa.has(cle)) continue;
    dejaLa.add(cle);
    ajouterCourse(d, { texte: ing, origine });
    ajoutes++;
  }
  return ajoutes;
}

// Tous les ingrédients des repas d'une semaine.
export function ingredientsDeLaSemaine(d, lundi) {
  const fin = ajouterJours(lundi, 6);
  return N(d)
    .repas.filter((r) => r.date >= lundi && r.date <= fin)
    .flatMap((r) => r.ingredients);
}

export function ajouterDepuisPlanning(d, lundi) {
  return ajouterIngredients(d, ingredientsDeLaSemaine(d, lundi), 'repas');
}

// ---- Recettes ----
// Une recette garde son titre, ses ingrédients (une ligne chacun) et ses étapes (texte libre).
// Depuis une recette : ingrédients → liste de courses, ou recette → planning des repas.

export function ajouterRecette(d, { titre, ingredients, etapes }) {
  const maintenant = new Date().toISOString();
  const r = {
    id: nouvelId(),
    titre: String(titre || '').trim(),
    ingredients: Array.isArray(ingredients) ? ingredients : lireIngredients(ingredients),
    etapes: String(etapes || '').trim(),
    creeLe: maintenant,
    modifieLe: maintenant,
  };
  N(d).recettes.push(r);
  return r;
}

export function modifierRecette(d, id, { titre, ingredients, etapes }) {
  const r = N(d).recettes.find((x) => x.id === id);
  if (!r) return;
  r.titre = String(titre || '').trim();
  r.ingredients = Array.isArray(ingredients) ? ingredients : lireIngredients(ingredients);
  r.etapes = String(etapes || '').trim();
  r.modifieLe = new Date().toISOString();
}

export function supprimerRecette(d, id) {
  const index = N(d).recettes.findIndex((x) => x.id === id);
  if (index === -1) return null;
  const [recette] = N(d).recettes.splice(index, 1);
  return { recette, index };
}

export function restaurerRecette(d, { recette, index }) {
  N(d).recettes.splice(Math.min(index, N(d).recettes.length), 0, recette);
}

// Recettes triées par titre, éventuellement filtrées par un mot (sans accents).
export function recettesTriees(d, texte = '') {
  const mots = normaliser(texte).split(' ').filter(Boolean);
  return N(d)
    .recettes.filter((r) => !mots.length || mots.every((m) => normaliser(`${r.titre} ${r.ingredients.join(' ')}`).includes(m)))
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
}

// « lait, pain; citrons » → ['lait', 'pain', 'citrons'] (pour transformer une idée en liste de courses).
export function lireListeEnVrac(texte) {
  return lireIngredients(String(texte || '').replace(/,/g, '\n'));
}

// ---- Ce qui alimente la journée ----
// Les repas du planning apparaissent dans la catégorie Nourriture comme de simples repères
// (type « info » : pas de case à cocher, pas comptés dans la progression). Ils restent
// « discrets » : la vue Semaine ne s'en encombre pas (le planning des repas a sa propre grille).

enregistrerFournisseur((date, donnees) =>
  repasDuJour(donnees, date).map((r) => {
    const m = momentParId(r.moment);
    return {
      source: 'repas',
      id: r.id,
      date,
      titre: `${m.icone} ${m.court} : ${r.texte}`,
      categorieId: 'nourriture',
      type: 'info',
      discret: true,
    };
  })
);
