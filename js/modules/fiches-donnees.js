// Administratif › Fiches : les repères qu'on cherche toujours au mauvais moment.
//   - Contacts : plombier, propriétaire, syndic, voisine… (rôle, téléphone, e-mail)
//   - Garanties : un appareil, où et quand il a été acheté, jusqu'à quand il est garanti
//   - Références : une teinte de peinture, un modèle de store, une dimension…
// Jamais de mot de passe ni de numéro de compte : seulement des repères.
// Règles et calculs seulement (pas d'affichage).

import { nouvelId } from '../schema.js';
import { aujourdhui, ajouterJours, depuisCle } from '../dates.js';
import { ajouterMoisSurJour } from './echeances-donnees.js';

const M = (d) => d.administratif;

export const TYPES_FICHE = [
  { id: 'contact', nom: 'Contacts', un: 'contact', icone: '📞', exemple: 'Ex. Plombier, propriétaire, syndic…' },
  { id: 'garantie', nom: 'Garanties', un: 'garantie', icone: '🧾', exemple: 'Ex. Lave-linge, bouilloire, canapé…' },
  { id: 'reference', nom: 'Références', un: 'référence', icone: '🏷️', exemple: 'Ex. Peinture du salon, modèle du store…' },
];

export function typeFiche(id) {
  return TYPES_FICHE.find((t) => t.id === id) || TYPES_FICHE[0];
}

// Les champs propres à chaque sorte de fiche (tout le reste est ignoré).
const CHAMPS = {
  contact: ['role', 'telephone', 'email'],
  garantie: ['magasin', 'dateAchat', 'dureeMois', 'reference'],
  reference: ['valeur', 'ou'],
};

function texte(v) {
  return String(v ?? '').trim();
}

function dateOuVide(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '';
}

function mois(v) {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : null;
}

function nettoyer(type, v) {
  const t = typeFiche(type).id;
  const f = { type: t, titre: texte(v.titre), note: texte(v.note) };
  for (const c of CHAMPS[t]) {
    if (c === 'dateAchat') f[c] = dateOuVide(v[c]);
    else if (c === 'dureeMois') f[c] = mois(v[c]);
    else f[c] = texte(v[c]);
  }
  return f;
}

export function ajouterFiche(d, type, valeurs) {
  const f = { id: nouvelId(), ...nettoyer(type, valeurs), creeLe: new Date().toISOString() };
  if (!f.titre) return null;
  M(d).fiches.push(f);
  return f;
}

export function modifierFiche(d, id, valeurs) {
  const f = ficheParId(d, id);
  if (!f) return;
  const n = nettoyer(f.type, valeurs);
  if (!n.titre) return;
  Object.assign(f, n);
}

export function ficheParId(d, id) {
  return M(d).fiches.find((f) => f.id === id) || null;
}

export function supprimerFiche(d, id) {
  const index = M(d).fiches.findIndex((f) => f.id === id);
  if (index === -1) return null;
  const [fiche] = M(d).fiches.splice(index, 1);
  return { fiche, index };
}

export function restaurerFiche(d, { fiche, index }) {
  M(d).fiches.splice(Math.min(index, M(d).fiches.length), 0, fiche);
}

function sansAccents(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Les fiches d'un type, triées par titre, éventuellement filtrées par un mot (sans accents).
export function fichesDuType(d, type, recherche = '') {
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  return M(d)
    .fiches.filter((f) => f.type === type)
    .filter((f) => !mots.length || mots.every((m) => sansAccents(Object.values(f).filter((v) => typeof v === 'string').join(' ')).includes(m)))
    .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
}

// ---- Garanties ----

// La date de fin de garantie, ou null si on ne la connaît pas.
export function finGarantie(f) {
  if (!f.dateAchat || !f.dureeMois) return null;
  return ajouterMoisSurJour(f.dateAchat, f.dureeMois);
}

function jours(a, b) {
  const x = depuisCle(a);
  const y = depuisCle(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
}

// { fin, active, bientot, joursRestants } — « bientôt » : dans les deux mois qui viennent.
export function etatGarantie(f, aujourdhuiCle = aujourdhui()) {
  const fin = finGarantie(f);
  if (!fin) return { fin: null, active: null, bientot: false, joursRestants: null };
  const joursRestants = jours(aujourdhuiCle, fin);
  return { fin, active: joursRestants >= 0, bientot: joursRestants >= 0 && joursRestants <= 60, joursRestants };
}

export function texteGarantie(f, aujourdhuiCle = aujourdhui()) {
  const e = etatGarantie(f, aujourdhuiCle);
  if (!e.fin) return f.dateAchat || f.dureeMois ? 'durée ou date d’achat à compléter' : '';
  const lisible = depuisCle(e.fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return e.active ? `sous garantie jusqu’au ${lisible}` : `garantie terminée le ${lisible}`;
}

// La date où il serait utile d'être prévenue : un mois avant la fin (jamais dans le passé).
export function dateRappelGarantie(f, aujourdhuiCle = aujourdhui()) {
  const fin = finGarantie(f);
  if (!fin) return null;
  const avant = ajouterJours(fin, -30);
  return avant > aujourdhuiCle ? avant : fin >= aujourdhuiCle ? fin : null;
}
