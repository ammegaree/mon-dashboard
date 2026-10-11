// Le check-in du jour : formulaire complet, version guidée (une question à la fois),
// et rappel : à partir d'une heure choisie, une fenêtre propose de le remplir.

import { h, vider, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur, enregistrerActionCoche } from '../registry.js';
import { aujourdhui, formatLong } from '../dates.js';
import * as B from './bien-etre-donnees.js';

// ---- Une échelle à cinq niveaux (humeur, énergie, qualité du sommeil) ----

export function echelle({ valeurs, valeur, surChangement, libelle }) {
  let courante = valeur;
  const conteneur = h('div', { class: 'echelle', role: 'radiogroup', 'aria-label': libelle });
  const dessiner = () => {
    vider(conteneur);
    conteneur.append(
      ...valeurs.map((o) =>
        h(
          'button',
          {
            class: 'echelle-bouton' + (courante === o.v ? ' actif' : ''),
            type: 'button',
            role: 'radio',
            'aria-checked': String(courante === o.v),
            title: o.nom,
            // Un second clic sur la valeur choisie l'efface.
            onclick: () => {
              courante = courante === o.v ? null : o.v;
              surChangement(courante);
              dessiner();
            },
          },
          o.emoji ? h('span', { class: 'echelle-emoji', 'aria-hidden': 'true' }, o.emoji) : h('span', { class: 'mono' }, String(o.v)),
          h('span', { class: 'echelle-nom' }, o.nom)
        )
      )
    );
  };
  dessiner();
  return conteneur;
}

// ---- Le formulaire complet (pour modifier un check-in existant) ----

export function formulaireCheckin({ date, existant, surEnregistrer, surAnnuler = null, texteBouton = 'Enregistrer' }) {
  const etat = {
    humeur: existant?.humeur ?? null,
    energie: existant?.energie ?? null,
    sommeilQualite: existant?.sommeilQualite ?? null,
  };
  const heures = h('input', {
    type: 'text',
    inputmode: 'decimal',
    class: 'champ champ-court',
    value: existant?.sommeilHeures != null ? String(existant.sommeilHeures).replace('.', ',') : '',
    placeholder: '7,5',
    id: `checkin-heures-${date}`,
    'aria-label': 'Heures de sommeil',
  });
  const note = h('input', { type: 'text', class: 'champ', value: existant?.note || '', placeholder: 'Un mot sur ta journée (facultatif)', maxLength: 200, 'aria-label': 'Note du jour' });

  return h(
    'form',
    {
      class: 'pile',
      onsubmit: (e) => {
        e.preventDefault();
        surEnregistrer({ date, humeur: etat.humeur, energie: etat.energie, sommeilHeures: heures.value, sommeilQualite: etat.sommeilQualite, note: note.value });
      },
    },
    h('div', { class: 'pile pile-serre' }, h('strong', null, 'Mon humeur'), echelle({ valeurs: B.HUMEURS, valeur: etat.humeur, libelle: 'Humeur', surChangement: (v) => (etat.humeur = v) })),
    h('div', { class: 'pile pile-serre' }, h('strong', null, 'Mon énergie'), echelle({ valeurs: B.ENERGIES, valeur: etat.energie, libelle: 'Énergie', surChangement: (v) => (etat.energie = v) })),
    h(
      'div',
      { class: 'pile pile-serre' },
      h('strong', null, 'Mon sommeil'),
      h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: `checkin-heures-${date}` }, 'Cette nuit'), heures, h('span', { class: 'meta' }, 'heures')),
      echelle({ valeurs: B.QUALITES_SOMMEIL, valeur: etat.sommeilQualite, libelle: 'Qualité du sommeil', surChangement: (v) => (etat.sommeilQualite = v) })
    ),
    note,
    h(
      'div',
      { class: 'rangee droite' },
      surAnnuler && h('button', { class: 'bouton', type: 'button', onclick: surAnnuler }, 'Annuler'),
      h('button', { class: 'bouton bouton-jaune', type: 'submit' }, texteBouton)
    )
  );
}

function ouvrirFormulaire({ date }) {
  const existant = B.checkinDuJour(store.lire(), date);
  ouvrirModale({
    titre: date === aujourdhui() ? 'Mon check-in du jour' : `Check-in · ${formatLong(date)}`,
    couleur: 'rose',
    corps: (fermer) =>
      formulaireCheckin({
        date,
        existant,
        surAnnuler: fermer,
        surEnregistrer: (valeurs) => {
          store.modifier((d) => B.enregistrerCheckin(d, valeurs));
          fermer();
          notifier('Check-in enregistré ✦');
        },
      }),
  });
}

// ---- Le rappel : mémoire légère (pas de donnée de santé), par navigateur ----

const CLE_RAPPEL = 'mon-dashboard.checkin-rappel';

function lireRappel() {
  try {
    return JSON.parse(localStorage.getItem(CLE_RAPPEL) || '{}') || {};
  } catch {
    return {};
  }
}

function ecrireRappel(etat) {
  try {
    localStorage.setItem(CLE_RAPPEL, JSON.stringify(etat));
  } catch {
    /* sans importance : le rappel reviendra simplement */
  }
}

function snoozer(minutes) {
  ecrireRappel({ ...lireRappel(), jusqua: Date.now() + minutes * 60000 });
}

function ignorerAujourdhui() {
  ecrireRappel({ ...lireRappel(), jour: aujourdhui() });
}

// ---- La version guidée : une question à la fois ----

export function ouvrirCheckinGuide({ date = aujourdhui(), rappel = false } = {}) {
  // Une seule fenêtre de check-in à la fois.
  if (document.querySelector('dialog[open] .guide')) return;

  const existant = B.checkinDuJour(store.lire(), date);
  const etat = {
    humeur: existant?.humeur ?? null,
    energie: existant?.energie ?? null,
    heures: existant?.sommeilHeures != null ? String(existant.sommeilHeures).replace('.', ',') : '',
    qualite: existant?.sommeilQualite ?? null,
    note: existant?.note ?? '',
  };
  const ETAPES = ['humeur', 'energie', 'sommeil', 'note'];
  let etape = 0;
  let enregistre = false;

  const { surFermeture } = ouvrirModale({
    titre: rappel ? 'Check-in du soir 🌙' : date === aujourdhui() ? 'Mon check-in du jour' : `Check-in · ${formatLong(date)}`,
    couleur: 'rose',
    corps: (fermer) => {
      const zone = h('div', { class: 'pile guide' });

      const enregistrer = () => {
        const valeurs = { date, humeur: etat.humeur, energie: etat.energie, sommeilHeures: etat.heures, sommeilQualite: etat.qualite, note: etat.note };
        const vide = etat.humeur == null && etat.energie == null && !String(etat.heures).trim() && etat.qualite == null && !etat.note.trim();
        enregistre = true;
        if (vide) {
          if (rappel) ignorerAujourdhui();
          fermer();
          notifier("Pas de souci, ce sera pour une prochaine fois ✦");
          return;
        }
        store.modifier((d) => B.enregistrerCheckin(d, valeurs));
        fermer();
        notifier('Merci, à demain ✦');
      };

      const aller = (n) => {
        etape = Math.max(0, Math.min(ETAPES.length - 1, n));
        dessiner();
      };
      const suivant = () => (etape === ETAPES.length - 1 ? enregistrer() : aller(etape + 1));

      const dessiner = () => {
        vider(zone);
        const id = ETAPES[etape];
        let contenu;
        let question;
        let autoAvance = false;

        if (id === 'humeur') {
          question = rappel ? "Comment s'est passée ta journée ?" : 'Comment te sens-tu ?';
          autoAvance = true;
          contenu = echelle({ valeurs: B.HUMEURS, valeur: etat.humeur, libelle: 'Humeur', surChangement: (v) => { etat.humeur = v; if (v != null) setTimeout(suivant, 260); } });
        } else if (id === 'energie') {
          question = 'Et ton énergie ?';
          autoAvance = true;
          contenu = echelle({ valeurs: B.ENERGIES, valeur: etat.energie, libelle: 'Énergie', surChangement: (v) => { etat.energie = v; if (v != null) setTimeout(suivant, 260); } });
        } else if (id === 'sommeil') {
          question = 'Comment as-tu dormi cette nuit ?';
          const heures = h('input', {
            type: 'text',
            inputmode: 'decimal',
            class: 'champ champ-court',
            value: etat.heures,
            placeholder: '7,5',
            'aria-label': 'Heures de sommeil',
            oninput: (e) => (etat.heures = e.target.value),
            onkeydown: (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                suivant();
              }
            },
          });
          contenu = h(
            'div',
            { class: 'pile' },
            h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette' }, 'Environ'), heures, h('span', { class: 'meta' }, 'heures')),
            echelle({ valeurs: B.QUALITES_SOMMEIL, valeur: etat.qualite, libelle: 'Qualité du sommeil', surChangement: (v) => (etat.qualite = v) })
          );
          setTimeout(() => heures.focus(), 0);
        } else {
          question = 'Un mot sur ta journée ? (facultatif)';
          const note = h('input', {
            type: 'text',
            class: 'champ champ-titre',
            value: etat.note,
            maxLength: 200,
            placeholder: 'Ce que tu veux garder en tête…',
            'aria-label': 'Un mot sur ta journée',
            oninput: (e) => (etat.note = e.target.value),
            onkeydown: (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                enregistrer();
              }
            },
          });
          contenu = note;
          setTimeout(() => note.focus(), 0);
        }

        zone.append(
          ...[
          h(
            'div',
            { class: 'guide-progression', 'aria-label': `Question ${etape + 1} sur ${ETAPES.length}` },
            ETAPES.map((_, i) => h('span', { class: 'guide-point' + (i === etape ? ' actif' : i < etape ? ' fait' : '') }))
          ),
          h('h3', { class: 'guide-question' }, question),
          contenu,
          h(
            'div',
            { class: 'rangee rangee-souple' },
            etape > 0 && h('button', { class: 'bouton', type: 'button', onclick: () => aller(etape - 1) }, '← Précédente'),
            h('span', { class: 'espaceur' }),
            etape < ETAPES.length - 1 && h('button', { class: 'bouton', type: 'button', onclick: () => aller(etape + 1) }, 'Passer'),
            (!autoAvance || etape === ETAPES.length - 1) &&
              h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: suivant }, etape === ETAPES.length - 1 ? 'Enregistrer ✦' : 'Suivant →')
          ),
          rappel &&
            h(
              'div',
              { class: 'rangee rangee-centre guide-pied' },
              h('button', { class: 'lien-bouton', type: 'button', onclick: () => { snoozer(60); enregistre = true; fermer(); } }, 'Me le rappeler dans 1 h'),
              h('button', { class: 'lien-bouton', type: 'button', onclick: () => { ignorerAujourdhui(); enregistre = true; fermer(); } }, "Pas aujourd'hui")
            ),
          ].filter(Boolean)
        );
      };

      dessiner();
      return zone;
    },
  });

  surFermeture(() => {
    // Fermée sans rien choisir : on ne revient pas tout de suite à la charge.
    if (rappel && !enregistre) snoozer(60);
  });
}

// ---- Point d'entrée unique ----
// Pas encore de check-in : la version guidée. Déjà fait : le formulaire, pour le modifier.
export function ouvrirCheckin({ date = aujourdhui() } = {}) {
  if (B.checkinDuJour(store.lire(), date)) ouvrirFormulaire({ date });
  else ouvrirCheckinGuide({ date });
}

enregistrerActionCoche('checkin', (item) => ouvrirCheckin({ date: item.date }));
enregistrerEditeur('checkin', (item) => ouvrirCheckin({ date: item.date }));

// ---- Le rappel quotidien ----

function heureEnMinutes(texte) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texte || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 18 * 60;
}

function verifierRappel() {
  const donnees = store.lire();
  if (!donnees) return;
  const reglage = donnees.reglages?.checkin ?? { actif: true, heure: '18:00' };
  if (!reglage.actif || document.visibilityState !== 'visible') return;

  const maintenant = new Date();
  if (maintenant.getHours() * 60 + maintenant.getMinutes() < heureEnMinutes(reglage.heure)) return;

  const aujourdhuiCle = aujourdhui();
  if (B.checkinDuJour(donnees, aujourdhuiCle)) return;
  if (document.querySelector('dialog[open]')) return; // on n'interrompt pas une fenêtre ouverte

  const etat = lireRappel();
  if (etat.jour === aujourdhuiCle) return;
  if (etat.jusqua && Date.now() < etat.jusqua) return;

  ouvrirCheckinGuide({ date: aujourdhuiCle, rappel: true });
}

let rappelDemarre = false;

// Appelée une fois par l'application, une fois les données chargées.
export function demarrerRappelCheckin() {
  if (rappelDemarre) return;
  rappelDemarre = true;
  setTimeout(verifierRappel, 1500); // laisse la page s'afficher d'abord
  setInterval(verifierRappel, 60 * 1000);
  document.addEventListener('visibilitychange', () => setTimeout(verifierRappel, 500));
}

