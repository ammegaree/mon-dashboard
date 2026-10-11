// Entre le téléphone et l'ordinateur : envoyer sa copie sous forme de fichier, et fusionner celle de l'autre appareil.
//
// Un fichier d'envoi contient la copie complète ET le « point commun » : la dernière copie de l'autre appareil
// qu'on a fusionnée (c'est ce qui permet de savoir ce qui a été ajouté, modifié ou supprimé de chaque côté).
// Règles seulement (pas d'affichage).

import { validerSauvegarde } from '../schema.js';
import { fusionner, compterChangements, egal } from './fusion.js';
import { lireLocal, ecrireLocal, supprimerLocal } from '../stockage-local.js';

export const FORMAT = 'mon-dashboard-synchro';

const copie = (x) => JSON.parse(JSON.stringify(x));

// Le point commun gardé dans cet appareil (null si aucun échange n'a encore eu lieu).
export async function lirePoint() {
  return (await lireLocal('point')) || null;
}

// `null` : oublier le point commun (par exemple en annulant une fusion).
export async function memoriserPoint(donnees) {
  if (donnees === null) await supprimerLocal('point');
  else await ecrireLocal('point', copie(donnees));
}

// `appareil` : « telephone » ou « ordinateur » (pour nommer le fichier et savoir d'où il vient).
export async function creerFichierEnvoi(donnees, appareil) {
  return {
    format: FORMAT,
    version: 1,
    de: appareil,
    creeLe: new Date().toISOString(),
    base: await lirePoint(),
    donnees: copie(donnees),
  };
}

export function nomFichierEnvoi(appareil, date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `dashboard-${appareil}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

// Lit le texte d'un fichier : un fichier d'envoi (avec point commun) ou une simple sauvegarde (sans).
// Rend { donnees, base, de } ou { erreurs }.
export function lireFichier(texte) {
  let brut;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { erreurs: ["Ce fichier n'est pas lisible : ce n'est pas un fichier du dashboard."] };
  }
  const estEnvoi = brut && typeof brut === 'object' && brut.format === FORMAT;
  const contenu = estEnvoi ? brut.donnees : brut;
  const verdict = validerSauvegarde(contenu);
  if (verdict.erreurs) return { erreurs: verdict.erreurs };
  let base = null;
  if (estEnvoi && brut.base && typeof brut.base === 'object' && brut.base.meta) {
    const v = validerSauvegarde(brut.base);
    if (!v.erreurs) base = v.donnees;
  }
  return { donnees: verdict.donnees, base, de: estEnvoi ? brut.de || null : null, simpleSauvegarde: !estEnvoi };
}

// Calcule la fusion sans rien enregistrer : { fusionnee, changements, rienDeNouveau }.
export function preparerFusion(ma, fichier) {
  const fusionnee = fusionner(fichier.base || {}, ma, fichier.donnees);
  const changements = compterChangements(ma, fusionnee);
  const rienDeNouveau = egal({ ...fusionnee, meta: 0 }, { ...ma, meta: 0 });
  return { fusionnee, changements, rienDeNouveau };
}
