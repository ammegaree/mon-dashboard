// Stockage : garde les données en mémoire et les enregistre quelques instants après chaque modification.
// Deux façons de les ranger :
//   - « serveur » : dans le fichier de l'ordinateur, via le petit serveur (le cas normal) ;
//   - « autonome » : dans l'appareil lui-même (IndexedDB), quand le dashboard est publié comme un site,
//     sans serveur : c'est ce qui permet de l'utiliser sur le téléphone sans Wi-Fi ni ordinateur allumé.

import { donneesParDefaut, migrer } from './schema.js';
import { lireLocal, ecrireLocal, clesLocales, supprimerLocal, demanderStockagePersistant } from './stockage-local.js';

// La page publiée porte <meta name="dashboard-mode" content="autonome"> ; le serveur local, non.
let mode = document.querySelector('meta[name="dashboard-mode"]')?.content === 'autonome' ? 'autonome' : 'serveur';
const SAUVEGARDES_LOCALES = 7;

export function modeStockage() {
  return mode;
}

let donnees = null;
const abonnes = new Set();
const abonnesEtat = new Set();
let minuteur = null;
let enCours = false;
let aEnregistrer = false;
let etat = 'ok'; // 'ok' | 'enregistrement' | 'erreur' | 'conflit'
let copieAvantImport = false; // le prochain enregistrement garde d'abord une copie de l'ancien fichier

const DELAI = 400;

export function lire() {
  return donnees;
}

export function etatEnregistrement() {
  return etat;
}

function changerEtat(nouveau) {
  if (etat === nouveau) return;
  etat = nouveau;
  abonnesEtat.forEach((f) => f(etat));
}

export async function charger() {
  if (mode === 'autonome') return chargerLocal();
  const reponse = await fetch('/api/donnees', { cache: 'no-store' });
  if (!reponse.ok) throw new Error('Impossible de lire les données.');
  const recu = await reponse.json();
  if (recu && recu.meta) {
    donnees = migrer(recu);
  } else {
    // Premier lancement : on crée le fichier.
    donnees = donneesParDefaut();
    planifier(0);
  }
  return donnees;
}

async function chargerLocal() {
  const gardees = await lireLocal('donnees');
  if (gardees && gardees.meta) {
    donnees = migrer(gardees);
  } else {
    // Premier lancement sur cet appareil : un dashboard tout neuf, qu'on enregistre tout de suite.
    donnees = donneesParDefaut();
    planifier(0);
  }
  demanderStockagePersistant();
  return donnees;
}

// Une copie par jour dans l'appareil (les 7 dernières), faite avant la première modification de la journée.
async function sauvegardeLocaleDuJour() {
  const jour = new Date().toISOString().slice(0, 10);
  const cle = `sauvegarde:${jour}`;
  if ((await lireLocal(cle)) !== undefined) return;
  const ancienne = await lireLocal('donnees');
  if (!ancienne) return;
  await ecrireLocal(cle, ancienne);
  const toutes = (await clesLocales()).filter((k) => typeof k === 'string' && k.startsWith('sauvegarde:')).sort();
  while (toutes.length > SAUVEGARDES_LOCALES) await supprimerLocal(toutes.shift());
}

// Les copies gardées dans cet appareil : [{ jour, donnees }], la plus récente d'abord.
export async function sauvegardesLocales() {
  const cles = (await clesLocales()).filter((k) => typeof k === 'string' && k.startsWith('sauvegarde:')).sort().reverse();
  const liste = [];
  for (const k of cles) liste.push({ jour: k.slice('sauvegarde:'.length), donnees: await lireLocal(k) });
  return liste;
}

// Modifie les données. `rendre: false` évite de redessiner la page
// (utile quand on tape dans un champ).
export function modifier(fn, { rendre = true } = {}) {
  fn(donnees);
  aEnregistrer = true;
  planifier(DELAI);
  if (rendre) abonnes.forEach((f) => f());
}

// Remplace toutes les données par celles d'une sauvegarde (déjà validée). L'ancien fichier est
// copié dans sauvegardes/ par le serveur avant d'être remplacé.
export async function remplacer(nouvellesDonnees) {
  // Dans l'appareil (mode autonome), il n'y a pas de dossier « sauvegardes » : on garde la dernière version avant remplacement.
  if (mode === 'autonome') {
    try {
      await ecrireLocal('avant-import', JSON.parse(JSON.stringify(donnees)));
    } catch {
      // la copie de sécurité est un confort : on continue
    }
  }
  const rev = donnees.meta.rev;
  donnees = migrer(nouvellesDonnees);
  donnees.meta.rev = rev;
  donnees.meta.importeLe = new Date().toISOString();
  aEnregistrer = true;
  copieAvantImport = true;
  clearTimeout(minuteur);
  abonnes.forEach((f) => f());
  await enregistrer();
  return etat;
}

export function abonner(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

export function abonnerEtat(fn) {
  abonnesEtat.add(fn);
  return () => abonnesEtat.delete(fn);
}

function planifier(delai) {
  clearTimeout(minuteur);
  minuteur = setTimeout(enregistrer, delai);
}

async function enregistrer({ urgent = false } = {}) {
  if (etat === 'conflit') return;
  if (enCours) {
    aEnregistrer = true;
    return;
  }
  enCours = true;
  aEnregistrer = false;
  changerEtat('enregistrement');
  try {
    if (mode === 'autonome') {
      await sauvegardeLocaleDuJour();
      donnees.meta.rev = (donnees.meta.rev || 0) + 1;
      await ecrireLocal('donnees', JSON.parse(JSON.stringify(donnees)));
      copieAvantImport = false;
      changerEtat('ok');
      return;
    }
    const corps = JSON.stringify(donnees);
    const reponse = await fetch('/api/donnees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(copieAvantImport ? { 'X-Avant-Import': '1' } : {}) },
      body: corps,
      keepalive: urgent && corps.length < 60000,
    });
    if (reponse.status === 409) {
      changerEtat('conflit');
      return;
    }
    if (!reponse.ok) throw new Error('Échec');
    const { rev } = await reponse.json();
    donnees.meta.rev = rev;
    copieAvantImport = false;
    changerEtat('ok');
  } catch {
    aEnregistrer = true;
    changerEtat('erreur');
    planifier(3000);
  } finally {
    enCours = false;
    if (aEnregistrer && etat !== 'conflit' && etat !== 'erreur') planifier(0);
  }
}

// Plusieurs appareils (ordinateur et téléphone) : en revenant sur la page, on reprend la dernière version enregistrée,
// à condition qu'il n'y ait rien de non enregistré ici (sinon, rien n'est écrasé : le serveur signalera le conflit).
export async function rafraichir() {
  if (mode !== 'serveur' || !donnees || aEnregistrer || enCours || etat !== 'ok') return false;
  try {
    const reponse = await fetch('/api/donnees', { cache: 'no-store' });
    if (!reponse.ok) return false;
    const recu = await reponse.json();
    if (!recu || !recu.meta || recu.meta.rev === donnees.meta.rev) return false;
    // Pendant la lecture, une modification a pu commencer ici : on ne touche à rien.
    if (aEnregistrer || enCours) return false;
    donnees = migrer(recu);
    abonnes.forEach((f) => f());
    return true;
  } catch {
    return false;
  }
}

// Avant de quitter la page : on enregistre sans attendre.
function viderMaintenant() {
  if (donnees && aEnregistrer && etat !== 'conflit') {
    clearTimeout(minuteur);
    enregistrer({ urgent: true });
  }
}
window.addEventListener('pagehide', viderMaintenant);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') viderMaintenant();
  else rafraichir();
});
window.addEventListener('focus', () => rafraichir());
