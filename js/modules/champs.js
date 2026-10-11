// Champs de formulaire partagés.

import { h } from '../ui.js';

let compteur = 0;

// Choix de la catégorie sous forme de pastilles colorées.
export function champCategories({ donnees, valeur, surChangement }) {
  const nom = `choix-categorie-${++compteur}`;
  const categories = donnees.categories.filter((c) => !c.archivee || c.id === valeur);
  return h(
    'div',
    { class: 'puces', role: 'radiogroup', 'aria-label': 'Catégorie' },
    categories.map((cat) =>
      h(
        'label',
        { class: 'puce', style: `--cat: var(--${cat.couleur})` },
        h('input', {
          type: 'radio',
          name: nom,
          value: cat.id,
          checked: cat.id === valeur,
          onchange: () => surChangement(cat.id),
        }),
        h('span', null, `${cat.icone} ${cat.nom}`)
      )
    )
  );
}
