// Les fenêtres des économies : un objectif, un versement.

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as G from './budget-donnees.js';
import * as EP from './epargne-donnees.js';

function montantTexte(n) {
  return n === null || n === undefined || n === '' ? '' : String(n).replace('.', ',');
}

// ---- Un objectif ----

export function ouvrirObjectif({ id = null, surCreation = null } = {}) {
  const donnees = store.lire();
  const existant = id ? EP.objectifParId(donnees, id) : null;
  if (id && !existant) return;

  ouvrirModale({
    titre: existant ? "Modifier l'objectif" : 'Nouvel objectif',
    couleur: 'jaune',
    corps: (fermer) => {
      const icone = h('input', { type: 'text', class: 'champ champ-icone', maxLength: 8, value: existant?.icone || '🎯', 'aria-label': 'Emoji' });
      const nom = h('input', { type: 'text', class: 'champ champ-titre', maxLength: 60, placeholder: 'Ex. Vacances, ordinateur, imprévus…', 'aria-label': 'Nom', value: existant?.nom || '' });
      nom.setAttribute('list', 'ob-idees');
      const cible = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-montant', placeholder: 'Facultatif', 'aria-label': 'Montant visé en euros', value: existant ? montantTexte(existant.cible) : '' });
      const echeance = h('input', { type: 'date', class: 'champ', id: 'ob-date', value: existant?.echeance || '' });
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!nom.value.trim()) {
              nom.classList.add('champ-erreur');
              nom.focus();
              return;
            }
            if (cible.value.trim() && G.lireMontant(cible.value) === null) {
              cible.classList.add('champ-erreur');
              cible.focus();
              notifier('Écris un montant, par exemple 600, ou laisse vide.');
              return;
            }
            const valeurs = { nom: nom.value, icone: icone.value, cible: cible.value, echeance: echeance.value || null };
            if (existant) store.modifier((d) => EP.modifierObjectif(d, existant.id, valeurs));
            else {
              let cree = null;
              store.modifier((d) => (cree = EP.ajouterObjectif(d, valeurs)));
              if (cree) surCreation?.(cree.id);
            }
            fermer();
            if (!existant) notifier('Objectif ajouté ✦');
          },
        },
        h('div', { class: 'rangee-champ' }, icone, nom),
        h('datalist', { id: 'ob-idees' }, EP.IDEES_OBJECTIFS.map((i) => h('option', { value: i.nom }))),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, h('label', { class: 'etiquette', for: 'ob-cible' }, 'Montant visé'), cible, h('span', { class: 'champ-montant-unite' }, '€')),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ob-date' }, 'Pour le (facultatif)'), echeance),
        h('p', { class: 'doux' }, 'Sans montant ni date, c’est juste une tirelire : tu vois ce que tu y as mis. Avec les deux, je te dis ce que ça représente par mois.'),
        h(
          'div',
          { class: 'rangee droite' },
          existant &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = EP.supprimerObjectif(d, existant.id)));
                  fermer();
                  if (retire) notifier('Objectif supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => EP.restaurerObjectif(d, retire)) } });
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

// ---- Un versement (mettre de côté / reprendre) ----

export function ouvrirVersement({ objectifId, id = null, retrait: retraitInitial = false }) {
  const donnees = store.lire();
  const objectif = EP.objectifParId(donnees, objectifId);
  if (!objectif) return;
  const existant = id ? objectif.versements.find((v) => v.id === id) : null;
  if (id && !existant) return;
  const etat = { retrait: existant ? existant.montant < 0 : retraitInitial };

  ouvrirModale({
    titre: existant ? 'Modifier' : etat.retrait ? 'Reprendre de l’argent' : 'Mettre de côté',
    couleur: 'jaune',
    corps: (fermer) => {
      const montant = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-titre champ-montant', placeholder: '0,00', 'aria-label': 'Montant en euros', value: existant ? montantTexte(Math.abs(existant.montant)) : '' });
      const date = h('input', { type: 'date', class: 'champ', id: 'vs-date', value: existant?.date || aujourdhui() });
      const note = h('input', { type: 'text', class: 'champ', maxLength: 120, placeholder: 'Une note (facultatif)', 'aria-label': 'Note', value: existant?.note || '' });
      const sens = (valeur, texte) =>
        h('label', { class: 'puce', style: '--cat: var(--jaune)' }, h('input', { type: 'radio', name: 'vs-sens', checked: etat.retrait === valeur, onchange: () => (etat.retrait = valeur) }), h('span', null, texte));
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const m = G.lireMontant(montant.value);
            if (m === null || m === 0) {
              montant.classList.add('champ-erreur');
              montant.focus();
              notifier('Écris un montant, par exemple 25.');
              return;
            }
            const valeurs = { montant: m, date: date.value, note: note.value, retrait: etat.retrait };
            let ok;
            if (existant) store.modifier((d) => (ok = EP.modifierVersement(d, objectif.id, existant.id, valeurs)));
            else store.modifier((d) => (ok = EP.ajouterVersement(d, objectif.id, valeurs)));
            if (!ok) {
              notifier(`Tu ne peux pas reprendre plus que ce qui est de côté (${G.formaterEuros(EP.totalObjectif(store.lire().budget.objectifs.find((o) => o.id === objectif.id)))}).`);
              return;
            }
            fermer();
            notifier(etat.retrait ? 'Noté ✦' : `${G.formaterEuros(m)} mis de côté ✦`);
          },
        },
        h('p', { class: 'meta' }, `${objectif.icone} ${objectif.nom}`),
        h('div', { class: 'puces', role: 'radiogroup', 'aria-label': 'Sens' }, sens(false, '➕ Je mets de côté'), sens(true, '↩ Je reprends')),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, montant, h('span', { class: 'champ-montant-unite', 'aria-hidden': 'true' }, '€')),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'vs-date' }, 'Date'), date),
        note,
        h(
          'div',
          { class: 'rangee droite' },
          existant &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = EP.supprimerVersement(d, objectif.id, existant.id)));
                  fermer();
                  if (retire) notifier('Supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => EP.restaurerVersement(d, retire)) } });
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
  setTimeout(() => document.querySelector('dialog[open] .champ-montant')?.focus(), 0);
}
