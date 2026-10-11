// Budget › Vue d'ensemble : le bloc « Dépenses du mois », jour par jour, filtrable par enveloppe.

import { h, pastilles } from '../ui.js';
import { formatLong } from '../dates.js';
import * as G from './budget-donnees.js';
import { moisVu, posteFiltre, choisirPoste, ecran } from './budget-commun.js';
import { ouvrirDepense } from './ui-budget.js';
import { ligneDepense } from './budget-lignes.js';

const NB_VISIBLES = 8;

export function blocDepenses(donnees, ctx) {
  const mois = moisVu();
  let filtre = posteFiltre();
  // Une enveloppe supprimée entre-temps : on revient à « toutes ».
  if (filtre && filtre !== 'aucune' && !G.posteParId(donnees, filtre)) {
    choisirPoste('');
    filtre = '';
  }
  const toutes = G.depensesDuMois(donnees, mois, filtre);
  const total = G.arrondir(toutes.reduce((t, x) => t + Math.round(x.montant * 100), 0) / 100);
  const liste = ecran.toutesDepenses ? toutes : toutes.slice(0, NB_VISIBLES);

  // Regroupées par jour (la liste est déjà triée du plus récent au plus ancien).
  const jours = [];
  for (const dep of liste) {
    const dernier = jours[jours.length - 1];
    if (dernier && dernier.date === dep.date) dernier.liste.push(dep);
    else jours.push({ date: dep.date, liste: [dep] });
  }

  const select = h(
    'select',
    {
      class: 'champ champ-filtre',
      'aria-label': 'Filtrer par enveloppe',
      onchange: (ev) => {
        choisirPoste(ev.target.value);
        ctx.redessiner();
      },
    },
    h('option', { value: '', selected: filtre === '' }, 'Toutes les enveloppes'),
    donnees.budget.postes.map((p) => h('option', { value: p.id, selected: filtre === p.id }, `${p.icone} ${p.nom}`)),
    h('option', { value: 'aucune', selected: filtre === 'aucune' }, 'Sans enveloppe')
  );

  return h(
    'section',
    { class: 'fenetre', id: 'budget-depenses' },
    h(
      'div',
      { class: 'fenetre-barre', style: '--cat: var(--rose)' },
      pastilles(),
      h('h2', { class: 'fenetre-titre' }, 'Dépenses du mois'),
      toutes.length > 0 && h('span', { class: 'mono' }, `${toutes.length} · ${G.formaterEuros(total)}`),
      h('button', { class: 'bouton-icone', type: 'button', title: 'Ajouter une dépense', 'aria-label': 'Ajouter une dépense', onclick: () => ouvrirDepense({ posteId: filtre && filtre !== 'aucune' ? filtre : null }) }, '＋')
    ),
    h(
      'div',
      { class: 'fenetre-corps pile' },
      h('div', { class: 'rangee rangee-souple' }, select),
      toutes.length === 0
        ? h('p', { class: 'vide' }, filtre ? 'Rien dans cette enveloppe ce mois-ci.' : 'Rien de noté ce mois-ci. Le bouton « ＋ Dépense » prend dix secondes.')
        : h(
            'ul',
            { class: 'liste liste-sans-cadre' },
            jours.flatMap((j) => [
              h(
                'li',
                { class: 'separateur-jour mono' },
                h('span', null, formatLong(j.date)),
                h('span', null, G.formaterEuros(G.arrondir(j.liste.reduce((t, x) => t + Math.round(x.montant * 100), 0) / 100)))
              ),
              ...j.liste.map((dep) => ligneDepense(donnees, dep)),
            ])
          ),
      toutes.length > NB_VISIBLES &&
        h(
          'div',
          null,
          h(
            'button',
            {
              class: 'bouton bouton-petit',
              type: 'button',
              onclick: () => {
                ecran.toutesDepenses = !ecran.toutesDepenses;
                ctx.redessiner();
              },
            },
            ecran.toutesDepenses ? 'Voir moins' : `Voir les ${toutes.length} dépenses`
          )
        )
    )
  );
}
