// Les fenêtres des échéances : une échéance, des idées pour démarrer, et les gestes depuis Aujourd'hui / Semaine.

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur, enregistrerActionCoche } from '../registry.js';
import { aujourdhui } from '../dates.js';
import * as E from './echeances-donnees.js';

// Cocher une échéance (Aujourd'hui, Semaine) = « c'est réglé » ; décocher = revenir en arrière.
enregistrerActionCoche('maison-echeance', (item) => {
  const reel = aujourdhui();
  store.modifier((d) => {
    const e = E.echeanceParId(d, item.id);
    if (!e) return;
    if (E.faiteLe(e, reel) && item.fait) E.annulerFaite(d, item.id);
    else if (!item.fait) E.marquerFaite(d, item.id, reel);
  });
});
enregistrerEditeur('maison-echeance', (item) => ouvrirEcheance({ id: item.id }));

// `titre` : un titre de départ (idée du brain dump) ; `surEnregistrement` : appelé une fois l'échéance enregistrée.
// `date` / `repeteMois` / `rappelJours` : des valeurs de départ (par exemple la fin d'une garantie).
export function ouvrirEcheance({ id = null, titre: titreInitial = '', date: dateInitiale = '', repeteMois: repeteInitial = 12, rappelJours: rappelInitial = 14, surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existante = id ? E.echeanceParId(donnees, id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? "Modifier l'échéance" : 'Nouvelle échéance',
    couleur: 'turquoise',
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: existante?.titre || titreInitial, placeholder: 'Ex. Assurance habitation : renouvellement', maxLength: 120, 'aria-label': 'Titre' });
      const date = h('input', { type: 'date', class: 'champ', id: 'ec-date', value: existante?.date || dateInitiale });
      const repete = h('select', { class: 'champ', id: 'ec-repete' }, E.REPETITIONS.map((r) => h('option', { value: String(r.mois), selected: r.mois === (existante ? existante.repeteMois : repeteInitial) }, r.nom)));
      const rappel = h('select', { class: 'champ', id: 'ec-rappel' }, E.RAPPELS.map((r) => h('option', { value: String(r.jours), selected: r.jours === (existante ? existante.rappelJours : rappelInitial) }, r.nom)));
      const note = h('textarea', { class: 'champ champ-note', rows: 3, maxLength: 600, placeholder: 'Où est le papier, quel contrat, que faire (facultatif)…', 'aria-label': 'Note' }, existante?.note || '');
      // Une valeur de rappel inhabituelle (ancienne sauvegarde) reste choisissable.
      if (existante && !E.RAPPELS.some((r) => r.jours === existante.rappelJours)) {
        rappel.prepend(h('option', { value: String(existante.rappelJours), selected: true }, E.nomRappel(existante.rappelJours)));
      }

      const faitesPassees = existante ? existante.faits.length : 0;

      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!titre.value.trim()) {
              titre.classList.add('champ-erreur');
              titre.focus();
              return;
            }
            const valeurs = { titre: titre.value, date: date.value || null, repeteMois: repete.value, rappelJours: rappel.value, note: note.value };
            if (existante) store.modifier((d) => E.modifierEcheance(d, existante.id, valeurs));
            else store.modifier((d) => E.ajouterEcheance(d, valeurs));
            surEnregistrement?.();
            fermer();
            if (!existante) notifier('Échéance ajoutée ✦');
          },
        },
        titre,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ec-date' }, 'Date'), date),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ec-repete' }, 'Elle revient'), repete),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ec-rappel' }, 'Me prévenir'), rappel),
        note,
        h('p', { class: 'doux' }, "Pas de mot de passe ni de numéro de compte ici : seulement des repères (où est le papier, quel contrat)."),
        existante &&
          existante.archivee &&
          h('p', { class: 'meta' }, '✓ Cette échéance est réglée.'),
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            faitesPassees > 0 &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  store.modifier((d) => E.annulerFaite(d, existante.id));
                  fermer();
                  notifier('Remis à faire.');
                },
              },
              'Annuler le dernier « réglé »'
            ),
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retiree = null;
                  store.modifier((d) => (retiree = E.supprimerEcheance(d, existante.id)));
                  fermer();
                  if (retiree) notifier('Échéance supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => E.restaurerEcheance(d, retiree)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
  setTimeout(() => document.querySelector('dialog[open] input.champ-titre')?.focus(), 0);
}

// ---- Des idées ----

export function ouvrirIdeesEcheances() {
  const donnees = store.lire();
  const dejaLa = (titre) => donnees.administratif.echeances.some((e) => e.titre.toLowerCase() === titre.toLowerCase());
  ouvrirModale({
    titre: 'Des idées d’échéances',
    couleur: 'jaune',
    corps: (fermer) => {
      const coches = new Map();
      const lignes = E.IDEES_ECHEANCES.map((idee) => {
        const present = dejaLa(idee.titre);
        const c = h('input', { type: 'checkbox', checked: false, disabled: present });
        coches.set(idee.titre, c);
        return h(
          'label',
          { class: 'idee' },
          c,
          h('span', { class: 'ligne-bloc' }, idee.titre),
          h('span', { class: 'meta mono' }, present ? 'déjà là' : E.nomRepetition(idee.repeteMois).toLowerCase())
        );
      });
      return h(
        'div',
        { class: 'pile' },
        h('p', { class: 'doux' }, 'Coche ce qui te concerne. Je ne devine aucune date : tu la choisis ensuite, en cliquant sur l’échéance.'),
        h('div', { class: 'groupe-idees' }, lignes),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h(
            'button',
            {
              class: 'bouton bouton-jaune',
              type: 'button',
              onclick: () => {
                const titres = [...coches.entries()].filter(([, c]) => c.checked && !c.disabled).map(([t]) => t);
                let n = 0;
                store.modifier((d) => (n = E.ajouterIdeesEcheances(d, titres)));
                fermer();
                notifier(n ? `${n} échéance${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} ✦ Pense à choisir leur date.` : 'Rien de nouveau à ajouter.');
              },
            },
            'Ajouter la sélection'
          )
        )
      );
    },
  });
}

