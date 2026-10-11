// Budget › Vue d'ensemble : le bloc repliable « Régler mon budget » (ce qui rentre, ce qui sort, mes enveloppes).
// Ces montants valent pour tous les mois ; on les change quand la vie change.

import { h, pastilles } from '../ui.js';
import * as G from './budget-donnees.js';
import { moisVu, ecran } from './budget-commun.js';
import { ouvrirLigne, ouvrirEnveloppe, ouvrirIdeesEnveloppes } from './ui-budget.js';

const e = G.formaterEuros;

function blocLignes({ liste, titre, couleur, lignes, total, vide, bouton }) {
  return h(
    'section',
    { class: 'fenetre', style: `--cat: var(--${couleur})` },
    h(
      'div',
      { class: 'fenetre-barre' },
      pastilles(),
      h('h3', { class: 'fenetre-titre' }, titre),
      lignes.length > 0 && h('span', { class: 'mono' }, e(total)),
      h('button', { class: 'bouton-icone', type: 'button', title: bouton, 'aria-label': bouton, onclick: () => ouvrirLigne({ liste }) }, '＋')
    ),
    lignes.length
      ? h(
          'ul',
          { class: 'fenetre-corps liste' },
          lignes.map((l) =>
            h(
              'li',
              { class: 'ligne ligne-depense' },
              h('div', { class: 'ligne-bloc' }, h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier', onclick: () => ouvrirLigne({ liste, id: l.id }) }, l.nom)),
              h('strong', { class: 'montant mono' }, e(l.montant))
            )
          )
        )
      : h('div', { class: 'fenetre-corps pile' }, h('p', { class: 'vide' }, vide), h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirLigne({ liste }) }, bouton)))
  );
}

export function blocReglage(donnees) {
  const b = G.bilanDuMois(donnees, moisVu());
  const { revenus, fixes, postes } = donnees.budget;

  return h(
    'details',
    {
      class: 'repliable-discret',
      id: 'budget-reglage',
      open: ecran.reglageOuvert,
      ontoggle: (ev) => {
        ecran.reglageOuvert = ev.target.open;
      },
    },
    h('summary', null, '⚙️ Régler mon budget : revenus, charges fixes, enveloppes'),
    h(
      'div',
      { class: 'pile pile-large' },
      h('p', { class: 'doux' }, 'Ces montants valent pour chaque mois. Tu peux les changer quand ta situation change.'),
      blocLignes({ liste: 'revenus', titre: 'Ce qui rentre chaque mois', couleur: 'vert', lignes: revenus, total: b.revenus, vide: 'Bourse, salaire, aide de la famille… note ce que tu reçois en moyenne.', bouton: '＋ Revenu' }),
      blocLignes({ liste: 'fixes', titre: 'Mes charges fixes', couleur: 'orange', lignes: fixes, total: b.fixes, vide: 'Loyer, internet, téléphone, abonnements… ce qui part chaque mois quoi qu’il arrive.', bouton: '＋ Charge fixe' }),
      h(
        'div',
        { class: 'pile' },
        h('h3', { class: 'titre-section' }, 'Mes enveloppes'),
        postes.length === 0
          ? h(
              'div',
              { class: 'pile' },
              h('p', { class: 'doux' }, 'Courses, sorties, transport… Une enveloppe range tes dépenses et peut avoir un montant par mois.'),
              h(
                'div',
                { class: 'rangee rangee-souple' },
                h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: ouvrirIdeesEnveloppes }, "💡 Partir d'idées"),
                h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirEnveloppe({}) }, '＋ Créer une enveloppe')
              )
            )
          : [
              h(
                'div',
                { class: 'grille-zones' },
                postes.map((p) =>
                  h(
                    'button',
                    { class: 'carte-zone', type: 'button', onclick: () => ouvrirEnveloppe({ id: p.id }) },
                    h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, p.icone),
                    h('span', { class: 'carte-zone-texte' }, h('strong', null, p.nom), h('span', { class: 'meta' }, p.plafond ? `${e(p.plafond)} par mois` : 'Sans montant'))
                  )
                )
              ),
              b.plafonds > 0 &&
                h(
                  'p',
                  { class: 'doux' },
                  b.aRepartir >= 0
                    ? `Tes enveloppes totalisent ${e(b.plafonds)} : il reste ${e(b.aRepartir)} à répartir après tes charges fixes.`
                    : `Tes enveloppes totalisent ${e(b.plafonds)}, soit ${e(-b.aRepartir)} de plus que ce qui reste après tes charges fixes.`
                ),
              h(
                'div',
                { class: 'barre-discrete' },
                h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirEnveloppe({}) }, '＋ Enveloppe'),
                h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ouvrirIdeesEnveloppes }, '💡 Des idées')
              ),
            ]
      )
    )
  );
}
