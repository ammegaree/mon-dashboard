// Champs de formulaire partagés.

import { h } from '../ui.js';
import * as store from '../store.js';
import { categoriesAgenda } from './agenda-donnees.js';
import { formulaireNouvelleCategorieAgenda, ouvrirCategoriesAgenda } from './ui-agenda.js';

let compteur = 0;

// Choix de la catégorie sous forme de pastilles colorées : les domaines, puis les catégories du calendrier
// (avec de quoi en ajouter ou les modifier sans quitter le formulaire).
export function champCategories({ donnees, valeur, surChangement }) {
  const nom = `choix-categorie-${++compteur}`;
  const racine = h('div', { class: 'champ-categories' });
  let choisie = valeur;
  let ajoutOuvert = false;

  const puce = (cat) =>
    h(
      'label',
      { class: 'puce', style: `--cat: var(--${cat.couleur})` },
      h('input', {
        type: 'radio',
        name: nom,
        value: cat.id,
        checked: cat.id === choisie,
        onchange: () => {
          choisie = cat.id;
          surChangement(cat.id);
        },
      }),
      h('span', null, `${cat.icone} ${cat.nom}`)
    );

  const dessiner = (d = donnees) => {
    const domaines = d.categories.filter((c) => !c.archivee || c.id === choisie);
    const agenda = categoriesAgenda(d);

    const zoneAjout = ajoutOuvert
      ? (() => {
          const f = formulaireNouvelleCategorieAgenda({
            surAjout: (cat) => {
              choisie = cat.id;
              ajoutOuvert = false;
              surChangement(cat.id);
              dessiner(store.lire());
            },
            surAnnulation: () => {
              ajoutOuvert = false;
              dessiner(store.lire());
            },
          });
          setTimeout(() => f.focus(), 0);
          return f.element;
        })()
      : null;

    racine.replaceChildren(
      ...[
        h('div', { class: 'puces', role: 'radiogroup', 'aria-label': 'Catégorie' }, domaines.map(puce)),
        h(
          'div',
          { class: 'puces puces-agenda', role: 'radiogroup', 'aria-label': 'Catégories du calendrier' },
          h('span', { class: 'etiquette-puces mono' }, 'Calendrier'),
          agenda.map(puce),
          h(
            'button',
            {
              class: 'puce-action',
              type: 'button',
              onclick: () => {
                ajoutOuvert = !ajoutOuvert;
                dessiner(store.lire());
              },
            },
            '＋ Nouvelle'
          ),
          agenda.length > 0 &&
            h(
              'button',
              {
                class: 'puce-action',
                type: 'button',
                title: 'Renommer, changer la couleur ou supprimer',
                onclick: () =>
                  ouvrirCategoriesAgenda({
                    surFermeture: () => {
                      const apres = store.lire();
                      const existe = [...apres.categories, ...categoriesAgenda(apres)].some((c) => c.id === choisie);
                      if (!existe) {
                        choisie = (apres.categories.find((c) => c.id === 'autre') || apres.categories[0]).id; // comme les éléments de la catégorie supprimée
                        surChangement(choisie);
                      }
                      dessiner(apres);
                    },
                  }),
              },
              '✎ Gérer'
            )
        ),
        zoneAjout,
      ].filter(Boolean)
    );
  };

  dessiner();
  return racine;
}
