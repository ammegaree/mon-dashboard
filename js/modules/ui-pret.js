// Les fenêtres du prêt : un prêt, un paiement.

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as G from './budget-donnees.js';
import * as PR from './pret-donnees.js';
import { lireTaux } from './budget-montants.js';

function montantTexte(n) {
  return n === null || n === undefined || n === '' ? '' : String(n).replace('.', ',');
}

// ---- Un prêt ----

export function ouvrirPret({ id = null, surCreation = null } = {}) {
  const donnees = store.lire();
  const existant = id ? PR.pretParId(donnees, id) : null;
  if (id && !existant) return;

  ouvrirModale({
    titre: existant ? 'Modifier le prêt' : 'Nouveau prêt',
    couleur: 'orange',
    corps: (fermer) => {
      const icone = h('input', { type: 'text', class: 'champ champ-icone', maxLength: 8, value: existant?.icone || '🏦', 'aria-label': 'Emoji' });
      const nom = h('input', { type: 'text', class: 'champ champ-titre', maxLength: 60, placeholder: 'Ex. Prêt étudiant', 'aria-label': 'Nom', value: existant?.nom || '' });
      const capital = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-montant', placeholder: '0', id: 'pr-capital', 'aria-label': 'Montant emprunté en euros', value: existant ? montantTexte(existant.capital) : '' });
      const mensualite = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-montant', placeholder: '0', id: 'pr-mensualite', 'aria-label': 'Mensualité en euros', value: existant ? montantTexte(existant.mensualite) : '' });
      const taux = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-montant', placeholder: '0', id: 'pr-taux', 'aria-label': 'Taux annuel en pourcentage', value: existant && existant.taux ? montantTexte(existant.taux) : '' });
      const debut = h('input', { type: 'date', class: 'champ', id: 'pr-debut', value: existant?.debut || '' });
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const verifs = [
              [nom, () => nom.value.trim() !== '', null],
              [capital, () => (G.lireMontant(capital.value) || 0) > 0, 'Écris le montant emprunté, par exemple 5000.'],
              [mensualite, () => (G.lireMontant(mensualite.value) || 0) > 0, 'Écris la mensualité, par exemple 120.'],
              [taux, () => lireTaux(taux.value) !== null, 'Écris le taux en %, par exemple 1,5, ou laisse vide.'],
            ];
            for (const [champ, ok, message] of verifs) {
              if (!ok()) {
                champ.classList.add('champ-erreur');
                champ.focus();
                if (message) notifier(message);
                return;
              }
            }
            const valeurs = { nom: nom.value, icone: icone.value, capital: capital.value, mensualite: mensualite.value, taux: taux.value, debut: debut.value || null };
            if (existant) store.modifier((d) => PR.modifierPret(d, existant.id, valeurs));
            else {
              let cree = null;
              store.modifier((d) => (cree = PR.ajouterPret(d, valeurs)));
              if (cree) surCreation?.(cree.id);
            }
            fermer();
            if (!existant) notifier('Prêt ajouté ✦');
          },
        },
        h('div', { class: 'rangee-champ' }, icone, nom),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, h('label', { class: 'etiquette etiquette-fixe', for: 'pr-capital' }, 'Emprunté'), capital, h('span', { class: 'champ-montant-unite' }, '€')),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, h('label', { class: 'etiquette etiquette-fixe', for: 'pr-mensualite' }, 'Mensualité'), mensualite, h('span', { class: 'champ-montant-unite' }, '€ par mois')),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, h('label', { class: 'etiquette etiquette-fixe', for: 'pr-taux' }, 'Taux (facultatif)'), taux, h('span', { class: 'champ-montant-unite' }, '% par an')),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette etiquette-fixe', for: 'pr-debut' }, 'Début (facultatif)'), debut),
        h('p', { class: 'doux' }, 'Si tu ne connais pas le taux, laisse vide : le calcul se fait alors sans intérêts. Le reste affiché est un repère, pas le tableau officiel de ta banque.'),
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
                  store.modifier((d) => (retire = PR.supprimerPret(d, existant.id)));
                  fermer();
                  if (retire) notifier('Prêt supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => PR.restaurerPret(d, retire)) } });
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

// ---- Un paiement ----

export function ouvrirPaiement({ pretId, id = null }) {
  const donnees = store.lire();
  const pret = PR.pretParId(donnees, pretId);
  if (!pret) return;
  const existant = id ? pret.paiements.find((p) => p.id === id) : null;
  if (id && !existant) return;

  ouvrirModale({
    titre: existant ? 'Modifier le paiement' : 'Noter un paiement',
    couleur: 'orange',
    corps: (fermer) => {
      const montant = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-titre champ-montant', placeholder: '0,00', 'aria-label': 'Montant en euros', value: montantTexte(existant ? existant.montant : pret.mensualite) });
      const date = h('input', { type: 'date', class: 'champ', id: 'pa-date', value: existant?.date || aujourdhui() });
      const note = h('input', { type: 'text', class: 'champ', maxLength: 120, placeholder: 'Une note (facultatif)', 'aria-label': 'Note', value: existant?.note || '' });
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
              return;
            }
            const valeurs = { montant: m, date: date.value, note: note.value };
            if (existant) store.modifier((d) => PR.modifierPaiement(d, pret.id, existant.id, valeurs));
            else store.modifier((d) => PR.ajouterPaiement(d, pret.id, valeurs));
            fermer();
            notifier(existant ? 'Paiement modifié ✦' : 'Paiement noté ✦');
          },
        },
        h('p', { class: 'meta' }, `${pret.icone} ${pret.nom}`),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, montant, h('span', { class: 'champ-montant-unite', 'aria-hidden': 'true' }, '€')),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'pa-date' }, 'Date'), date),
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
                  store.modifier((d) => (retire = PR.supprimerPaiement(d, pret.id, existant.id)));
                  fermer();
                  if (retire) notifier('Paiement supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => PR.restaurerPaiement(d, retire)) } });
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
