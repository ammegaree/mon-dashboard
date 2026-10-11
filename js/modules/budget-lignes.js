// Budget : une ligne de dépense (utilisée par la vue d'ensemble).

import { h } from '../ui.js';
import { formatCourt } from '../dates.js';
import * as G from './budget-donnees.js';
import { ouvrirDepense } from './ui-budget.js';

export function ligneDepense(donnees, dep, avecDate = false) {
  const poste = dep.posteId ? G.posteParId(donnees, dep.posteId) : null;
  const titre = dep.note || (poste ? poste.nom : 'Dépense');
  const morceaux = [];
  if (avecDate) morceaux.push(formatCourt(dep.date));
  if (poste && dep.note) morceaux.push(poste.nom);
  return h(
    'li',
    { class: 'ligne ligne-depense' },
    h(
      'div',
      { class: 'ligne-bloc' },
      h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier cette dépense', onclick: () => ouvrirDepense({ id: dep.id }) }, `${poste ? poste.icone + ' ' : ''}${titre}`),
      morceaux.length > 0 && h('span', { class: 'meta' }, morceaux.join(' · '))
    ),
    h('strong', { class: 'montant mono' }, G.formaterEuros(dep.montant))
  );
}
