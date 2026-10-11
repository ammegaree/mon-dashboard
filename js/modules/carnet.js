// Page « Brain dump » : on note tout ce qui passe par la tête, sans trier ; on range ensuite dans une
// catégorie, ou on en fait une tâche, une recette, un projet… (voir idees-actions.js).

import { h, vider, pastilles } from '../ui.js';
import { enregistrerPage } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, formatCourt } from '../dates.js';
import * as C from './carnet-donnees.js';
import { selectCategorie, ouvrirIdee } from './ui-carnet.js';
import { categorieDe } from './actions-taches.js';

let filtre = ''; // '' = tout ; SANS_CATEGORIE = pas encore rangées ; sinon une catégorie
let recherche = '';

// Une idée : le texte (qui s'ouvre), où elle est rangée, et une seule action : en faire une tâche.
function ligneIdee(n, donnees) {
  const cat = n.categorieId ? categorieDe(donnees, n.categorieId) : null;
  return h(
    'li',
    { class: 'ligne ligne-tache-maison' + (cat ? '' : ' a-faire') },
    h(
      'div',
      { class: 'ligne-bloc' },
      h('button', { class: 'titre-cliquable', type: 'button', title: 'Ranger ou modifier', onclick: () => ouvrirIdee({ id: n.id }) }, n.texte),
      h('span', { class: 'meta' }, `${cat ? `${cat.icone} ${cat.nom}` : 'à ranger'} · ${formatCourt(n.date)}`)
    ),
    h('div', { class: 'actions-ligne' }, h('button', { class: 'bouton bouton-petit', type: 'button', title: 'Ranger, transformer en tâche, recette, projet…', onclick: () => ouvrirIdee({ id: n.id }) }, 'Adapter ›'))
  );
}

function rendreNotes(conteneur, ctx) {
  const donnees = store.lire();
  const compte = C.compteParDomaine(donnees);
  const total = donnees.carnet.notes.length;
  const categories = donnees.categories.filter((c) => !c.archivee || compte.get(c.id));

  // Saisie : une ligne, Entrée pour noter. On peut coller plusieurs lignes d'un coup.
  const champ = h('textarea', { class: 'champ champ-saisie', rows: 3, placeholder: 'Ce qui te passe par la tête…', 'aria-label': 'Nouvelle idée' });
  const categorieSaisie = selectCategorie({ donnees, valeur: filtre && filtre !== C.SANS_CATEGORIE ? filtre : null, id: 'bd-page-categorie' });
  const noter = () => {
    if (!champ.value.trim()) return;
    store.modifier((d) => C.ajouterIdees(d, { texte: champ.value, categorieId: categorieSaisie.value || null, date: aujourdhui() }));
    setTimeout(() => document.querySelector('.champ-saisie')?.focus(), 0);
  };
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      noter();
    }
  });

  const zoneListe = h('div', { class: 'pile' });
  const dessinerListe = () => {
    const liste = C.notesFiltrees(donnees, { categorieId: filtre, texte: recherche });
    vider(zoneListe);
    if (!liste.length) {
      zoneListe.append(
        h('p', { class: 'vide' }, recherche || filtre ? 'Aucune idée ne correspond.' : "Ta tête est vide, c'est parfait ✦ Note ici tout ce qui te passe par la tête, tu rangeras après.")
      );
      return;
    }
    zoneListe.append(h('ul', { class: 'liste-simple' }, liste.map((n) => ligneIdee(n, donnees))));
  };

  dessinerListe();
  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'section',
        { class: 'fenetre carte-saisie', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Note vite')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          champ,
          h(
            'div',
            { class: 'rangee-saisie' },
            h(
              'div',
              { class: 'saisie-rangement' },
              h('label', { class: 'etiquette', for: 'bd-page-categorie' }, 'Ranger dans'),
              categorieSaisie
            ),
            h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: noter }, 'Noter')
          ),
          h('p', { class: 'meta aide-saisie' }, 'Touche Entrée pour noter. Colle plusieurs lignes : une idée par ligne.')
        )
      ),
      total > 0 &&
        h(
          'div',
          { class: 'barre-discrete' },
          h(
            'label',
            { class: 'reglage-discret', style: 'margin-left: 0' },
            h('span', null, 'Voir :'),
            h(
              'select',
              {
                class: 'champ',
                'aria-label': 'Filtrer',
                onchange: (e) => {
                  filtre = e.target.value;
                  ctx.redessiner();
                },
              },
              h('option', { value: '' }, `Tout (${total})`),
              compte.get(C.SANS_CATEGORIE) ? h('option', { value: C.SANS_CATEGORIE, selected: filtre === C.SANS_CATEGORIE }, `À ranger (${compte.get(C.SANS_CATEGORIE)})`) : null,
              categories.filter((c) => compte.get(c.id)).map((c) => h('option', { value: c.id, selected: filtre === c.id }, `${c.icone} ${c.nom} (${compte.get(c.id)})`))
            )
          ),
          total >= 10 &&
            h('input', {
              type: 'search',
              class: 'champ champ-recherche',
              placeholder: 'Chercher…',
              value: recherche,
              'aria-label': 'Chercher dans mon brain dump',
              oninput: (e) => {
                recherche = e.target.value;
                dessinerListe();
              },
            })
        ),
      zoneListe
    )
  );
}

function rendre(racine, { redessiner }) {
  const contenu = h('div', { class: 'etudes-contenu' });
  rendreNotes(contenu, { redessiner });

  vider(racine);
  racine.append(
    h(
      'div',
      { class: 'page' },
      h('header', { class: 'entete-page' }, h('div', null, h('h1', null, '🧠 Brain dump'), h('p', { class: 'sous-titre' }, 'Vide ta tête, range après.'))),
      contenu
    )
  );
}

enregistrerPage('carnet', rendre);
