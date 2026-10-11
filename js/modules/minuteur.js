// Le minuteur de concentration, tel qu'utilisé par la page : un seul minuteur pour
// toute l'application, qui continue de tourner quand on change de page.

import * as store from '../store.js';
import { notifier } from '../ui.js';
import { MoteurMinuteur, formaterCompteARebours } from './minuteur-moteur.js';
import { enregistrerTemps, formaterDuree } from './etudes-donnees.js';

const CLE_STOCKAGE = 'mon-dashboard.minuteur';

let chapitreChoisi = null;
let intervalle = null;
let titrePage = document.title;
const abonnes = new Set();

// ---- Sauvegarde légère (survit à un rechargement de la page) ----

function sauvegarder() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(moteur.exporter()));
  } catch {
    /* le stockage peut être indisponible : le minuteur fonctionne quand même */
  }
}

function lireSauvegarde() {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
  } catch {
    return null;
  }
}

// ---- Son (un petit « ding » doux, sans fichier) ----

let contexteAudio = null;

function ding() {
  try {
    contexteAudio = contexteAudio || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = contexteAudio.currentTime;
    [660, 880].forEach((frequence, i) => {
      const osc = contexteAudio.createOscillator();
      const gain = contexteAudio.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequence;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.5);
      osc.connect(gain).connect(contexteAudio.destination);
      osc.start(t0 + i * 0.22);
      osc.stop(t0 + i * 0.22 + 0.55);
    });
  } catch {
    /* pas de son : ce n'est pas grave */
  }
}

// ---- Moteur ----

const moteur = new MoteurMinuteur({
  surFinTravail: ({ chapitreId, debutISO, secondes }) => {
    store.modifier((d) => enregistrerTemps(d, { chapitreId, debutISO, secondes }));
  },
  surChangement: (type) => {
    if (type !== 'tick') sauvegarder();
    if (type === 'fin-travail') {
      ding();
      const pause = moteur.etat.pauseMin;
      notifier(pause > 0 ? `Session terminée, bravo ✦ Pause de ${pause} min.` : 'Session terminée, bravo ✦');
    } else if (type === 'fin-pause') {
      ding();
      notifier('Pause terminée. Prête pour la suite quand tu veux ✦');
    } else if (type === 'arret') {
      notifier('Session arrêtée — le temps travaillé est enregistré.');
    }
    gererIntervalle();
    appliquerTitre();
    // Copie des abonnés : certains se réabonnent pendant l'envoi (ils redessinent la page).
    [...abonnes].forEach((f) => f({ type }));
  },
});

function gererIntervalle() {
  const doitTourner = moteur.actif() && !moteur.etat.enPause;
  if (doitTourner && !intervalle) intervalle = setInterval(() => moteur.tick(), 250);
  if (!doitTourner && intervalle) {
    clearInterval(intervalle);
    intervalle = null;
  }
}

function appliquerTitre() {
  const e = moteur.etat;
  if (e.phase === 'inactif') {
    document.title = titrePage;
    return;
  }
  const libelle = e.phase === 'travail' ? 'Travail' : 'Pause';
  document.title = `${e.enPause ? '⏸' : '⏱'} ${formaterCompteARebours(moteur.restant())} · ${libelle} — ${titrePage}`;
}

// ---- API ----

// Appelée par l'enveloppe de l'application une fois les données chargées.
export function initialiser() {
  moteur.restaurer(lireSauvegarde());
  gererIntervalle();
}

// Le titre de la page change quand on navigue ; le minuteur y ajoute son compte à rebours.
export function definirTitrePage(titre) {
  titrePage = titre;
  appliquerTitre();
}

export function etat() {
  const e = moteur.etat;
  return {
    phase: e.phase,
    enPause: e.enPause,
    restantMs: moteur.restant(),
    dureePhaseMs: e.dureePhaseMs,
    chapitreId: e.chapitreId,
    travailMin: e.travailMin,
    pauseMin: e.pauseMin,
  };
}

export function abonner(fn) {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

export function chapitreSelectionne() {
  return moteur.actif() ? moteur.etat.chapitreId : chapitreChoisi;
}

export function choisirChapitre(id) {
  chapitreChoisi = id || null;
}

export function demarrer() {
  const reglages = store.lire().etudes.reglages;
  // Le son doit être « débloqué » par un clic : on prépare le contexte audio ici.
  try {
    contexteAudio = contexteAudio || new (window.AudioContext || window.webkitAudioContext)();
    contexteAudio.resume?.();
  } catch {
    /* sans importance */
  }
  moteur.demarrer({ chapitreId: chapitreChoisi, travailMin: reglages.concentrationMin, pauseMin: reglages.pauseMin });
}

export function basculerPause() {
  moteur.basculerPause();
}

export function arreter() {
  return moteur.arreter();
}

export function passerPause() {
  moteur.passerPause();
}

export { formaterCompteARebours, formaterDuree };
