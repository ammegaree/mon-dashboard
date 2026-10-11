// La « Vue d'ensemble » d'une catégorie : ce qui est prévu aujourd'hui et dans les 7 prochains jours,
// avec éventuellement un petit résumé propre à la catégorie. Toujours le premier onglet.

import { h, vider } from '../ui.js';
import * as store from '../store.js';
import { cartesDuDomaine } from './domaine.js';
import { categorieDe } from './actions-taches.js';

// `extras` : des éléments (ou une fonction `(donnees, cat) => éléments`) affichés au-dessus des cartes.
export function rendreVueEnsemble(extras = null) {
  return (conteneur, ctx) => {
    const donnees = store.lire();
    const cat = categorieDe(donnees, ctx.categorieId);
    const en_plus = typeof extras === 'function' ? extras(donnees, cat, ctx) : extras || [];
    vider(conteneur);
    conteneur.append(h('div', { class: 'pile pile-large' }, ...[en_plus].flat().filter(Boolean), ...cartesDuDomaine(donnees, cat)));
  };
}
