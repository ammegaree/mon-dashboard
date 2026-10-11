// La synchronisation automatique entre tes appareils, par un dépôt GitHub privé, avec des données chiffrées.
//
// Ce module ne fait que « brancher » les pièces (chiffrement.js, depot-github.js, nuage-coeur.js) sur le dashboard :
// la configuration gardée dans l'appareil, les moments où l'on synchronise, l'état affiché.
// Ton : discret. Une erreur n'efface jamais rien ; sans internet, tout reste local et reprend au retour du réseau.

import * as store from '../store.js';
import { lireLocal, ecrireLocal, supprimerLocal } from '../stockage-local.js';
import { deriverCle, nouveauSel, dechiffrer, enBase64, deBase64, ITERATIONS_PAR_DEFAUT } from './chiffrement.js';
import { lireFichier, ecrireFichier, verifierDepot, depotValide } from './depot-github.js';
import { tourDeSynchro } from './nuage-coeur.js';

const CHEMIN = 'donnees.enc.json';
const DELAI_APRES_MODIFICATION = 5000;
const INTERVALLE = 2 * 60 * 1000;

// config : { depot, jeton, cle (base 64), sel, iterations } ou null
let config = null;
// statut : 'inactif' | 'synchro' | 'ok' | 'hors-ligne' | 'erreur' | 'bloque' (code d'accès ou mot de passe à revoir)
let etat = { statut: 'inactif', dernierLe: null, message: '' };
const abonnes = new Set();
let minuteur = null;
let enCours = false;
let rejouer = false;
let demarre = false;

export function etatNuage() {
  return { ...etat, depot: config?.depot || null };
}

export function nuageActif() {
  return Boolean(config);
}

export function abonnerNuage(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

function changer(partiel) {
  etat = { ...etat, ...partiel };
  abonnes.forEach((f) => f(etatNuage()));
}

function appareil() {
  return store.modeStockage() === 'autonome' ? 'telephone' : 'ordinateur';
}

export async function chargerConfig() {
  const c = await lireLocal('nuage');
  config = c && c.depot && c.jeton && c.cle && c.sel ? c : null;
  changer({ statut: config ? (etat.statut === 'inactif' ? 'ok' : etat.statut) : 'inactif' });
  return config;
}

function distant() {
  return {
    lire: async () => {
      const r = await lireFichier({ depot: config.depot, jeton: config.jeton, chemin: CHEMIN });
      return r ? { sha: r.sha, enveloppe: JSON.parse(r.texte) } : null;
    },
    ecrire: ({ enveloppe, sha }) =>
      ecrireFichier({ depot: config.depot, jeton: config.jeton, chemin: CHEMIN, texte: JSON.stringify(enveloppe), sha, message: `Synchronisation (${appareil()})` }),
  };
}

const local = {
  lire: () => ({ donnees: store.lire(), numero: store.numeroModifications() }),
  appliquer: (donnees, numero) => store.appliquerExterne(donnees, numero),
};

const point = {
  lire: async () => (await lireLocal('point-nuage')) || null,
  ecrire: (donnees) => ecrireLocal('point-nuage', donnees),
};

// Une synchronisation maintenant. Une seule à la fois : si on la redemande pendant qu'elle tourne, on la rejoue ensuite.
export async function synchroniser() {
  if (!config) return null;
  if (etat.statut === 'bloque') return null;
  if (enCours) {
    rejouer = true;
    return null;
  }
  enCours = true;
  changer({ statut: 'synchro', message: '' });
  try {
    const r = await tourDeSynchro({
      distant: distant(),
      local,
      point,
      cle: { cle: config.cle, sel: config.sel, iterations: config.iterations, appareil: appareil() },
    });
    changer({ statut: 'ok', dernierLe: new Date().toISOString(), message: '' });
    return r;
  } catch (e) {
    const code = e && e.code;
    if (code === 'hors-ligne') changer({ statut: 'hors-ligne', message: 'Pas de connexion : la synchronisation reprendra toute seule.' });
    else if (code === 'jeton' || code === 'mot-de-passe' || code === 'introuvable' || code === 'format')
      changer({ statut: 'bloque', message: (e && e.message) || 'Accès refusé.' });
    else changer({ statut: 'erreur', message: (e && e.message) || 'La synchronisation a échoué, nouvel essai bientôt.' });
    return null;
  } finally {
    enCours = false;
    if (rejouer) {
      rejouer = false;
      planifier(1000);
    }
  }
}

function planifier(delai) {
  clearTimeout(minuteur);
  minuteur = setTimeout(synchroniser, delai);
}

// À appeler une fois au démarrage : branche les moments de synchronisation (retour sur la page, réseau, modifications…).
export async function demarrerNuage() {
  await chargerConfig();
  if (demarre) return;
  demarre = true;
  window.addEventListener('online', () => config && planifier(0));
  window.addEventListener('focus', () => config && planifier(0));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && config && planifier(0));
  store.abonnerModifications(() => config && planifier(DELAI_APRES_MODIFICATION));
  setInterval(() => {
    if (config && document.visibilityState === 'visible') planifier(0);
  }, INTERVALLE);
  if (config) planifier(500);
}

// ---- Activer / désactiver ----

// Active la synchronisation sur cet appareil. Lève une erreur au message clair si quelque chose ne va pas.
export async function activer({ depot, jeton, motDePasse, confirmation = '' }) {
  depot = String(depot || '').trim();
  jeton = String(jeton || '').trim();
  if (!depotValide(depot)) throw new Error('Le nom du dépôt doit ressembler à « ton-nom/mon-dashboard-donnees ».');
  if (!jeton) throw new Error('Colle le code d’accès GitHub.');
  if (String(motDePasse || '').length < 8) throw new Error('Choisis un mot de passe d’au moins 8 caractères.');

  const infos = await verifierDepot({ depot, jeton });
  if (!infos.prive) throw new Error('Ce dépôt est PUBLIC : tout le monde pourrait télécharger ton fichier chiffré. Crée un dépôt privé.');

  const recu = await lireFichier({ depot, jeton, chemin: CHEMIN });
  let sel;
  let iterations;
  if (recu) {
    // Un autre appareil a déjà commencé : on reprend son sel et on vérifie le mot de passe.
    const enveloppe = JSON.parse(recu.texte);
    sel = enveloppe.sel;
    iterations = enveloppe.iterations || ITERATIONS_PAR_DEFAUT;
    const cle = await deriverCle(motDePasse, sel, iterations);
    await dechiffrer(cle, enveloppe); // lève « mot de passe incorrect » si ça ne convient pas
    config = { depot, jeton, cle, sel, iterations };
  } else {
    if (confirmation !== motDePasse) throw new Error('Pour le premier appareil, écris le mot de passe deux fois, à l’identique.');
    sel = nouveauSel();
    iterations = ITERATIONS_PAR_DEFAUT;
    config = { depot, jeton, cle: await deriverCle(motDePasse, sel, iterations), sel, iterations };
  }
  await ecrireLocal('nuage', config);
  await supprimerLocal('point-nuage');
  changer({ statut: 'ok', message: '' });
  if (!demarre) await demarrerNuage();
  return synchroniser();
}

export async function desactiver() {
  config = null;
  clearTimeout(minuteur);
  await supprimerLocal('nuage');
  await supprimerLocal('point-nuage');
  changer({ statut: 'inactif', message: '', dernierLe: null });
}

// Après un message « code d'accès expiré » : on change seulement le code, sans toucher au reste.
export async function changerJeton(jeton) {
  if (!config) throw new Error('La synchronisation n’est pas activée ici.');
  const j = String(jeton || '').trim();
  if (!j) throw new Error('Colle le nouveau code d’accès.');
  await verifierDepot({ depot: config.depot, jeton: j });
  config = { ...config, jeton: j };
  await ecrireLocal('nuage', config);
  changer({ statut: 'ok', message: '' });
  return synchroniser();
}

// ---- Le « code de configuration » : le nom du dépôt et le code d'accès, pour les autres appareils ----
// (le mot de passe de chiffrement n'y est PAS : on le retape sur chaque appareil)

export function codeDeConfiguration() {
  if (!config) return '';
  return `dashboard-sync:${enBase64(new TextEncoder().encode(JSON.stringify({ v: 1, depot: config.depot, jeton: config.jeton })))}`;
}

export function lireCodeDeConfiguration(texte) {
  const t = String(texte || '').trim();
  if (!t.startsWith('dashboard-sync:')) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(deBase64(t.slice('dashboard-sync:'.length))));
    return o && o.v === 1 && depotValide(o.depot) && o.jeton ? { depot: o.depot, jeton: o.jeton } : null;
  } catch {
    return null;
  }
}
