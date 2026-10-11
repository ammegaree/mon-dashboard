// Page du domaine « Loisirs » : mes envies en listes (à lire, à voir, à essayer…) et mes avis une fois terminées.

import { h, vider } from '../ui.js';
import { enregistrerPageDomaine, elementsDuJour } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours, formatLong } from '../dates.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { cartesDuDomaine } from './domaine.js';
import { categorieDe } from './actions-taches.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';
import { rendreListes, reinitialiserLoisirs } from './loisirs-listes.js';
import { rendreAvis, reinitialiserAvis } from './loisirs-avis.js';
import { ouvrirEnvie } from './ui-loisirs.js';

const ONGLETS = [
  { id: 'jour', titre: "Vue d'ensemble", icone: '🎬' },
  { id: 'avis', titre: 'Mes avis', icone: '⭐' },
];

let onglet = 'jour';
enregistrerReinitialisationOnglets(() => {
  onglet = 'jour';
  reinitialiserLoisirs();
  reinitialiserAvis();
});

// Les tâches / rendez-vous rangés dans « Loisirs » (par exemple « Réserver le ciné ») : on n'affiche leurs
// cartes que s'il y en a.
function aDuContenu(donnees, categorieId) {
  const reel = aujourdhui();
  for (let i = 0; i <= 7; i++) {
    const items = elementsDuJour(ajouterJours(reel, i), donnees);
    if (items.some((x) => !x.groupe && !x.discret && categorieDe(donnees, x.categorieId).id === categorieId)) return true;
  }
  return false;
}

function rendreEnsemble(conteneur, ctx) {
  rendreListes(conteneur, ctx);
  const donnees = store.lire();
  if (!aDuContenu(donnees, ctx.categorieId)) return;
  const pile = conteneur.querySelector('.pile-large') || conteneur;
  pile.append(...cartesDuDomaine(donnees, categorieDe(donnees, ctx.categorieId)));
}

const RENDUS = { jour: rendreEnsemble, avis: rendreAvis };

function rendre(racine, { redessiner, categorieId }) {
  const donnees = store.lire();
  const cat = categorieDe(donnees, categorieId);
  const contenu = h('div', { class: 'etudes-contenu' });
  const aller = (id) => {
    onglet = id;
    redessiner();
  };
  RENDUS[onglet](contenu, { redessiner, categorieId, aller });

  vider(racine);
  racine.append(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'entete-page' },
        h('div', null, h('h1', null, `${cat.icone} ${cat.nom}`), h('p', { class: 'sous-titre mono' }, formatLong(aujourdhui()))),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirBrainDump({ categorieId }) }, libelleBrainDump(store.lire(), categorieId)),
          h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirEnvie({}) }, '＋ Envie')
        )
      ),
      barreOnglets({
        onglets: ONGLETS,
        actif: onglet,
        surChoix: aller,
      }),
      contenu
    )
  );
}

enregistrerPageDomaine('loisirs', rendre);
