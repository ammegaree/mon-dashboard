// Page du domaine « Administratif » : la vue d'ensemble, les échéances (assurance, impôts, contrats…)
// et les fiches (contacts, garanties, références). Elle remplace la page générique des domaines.

import { h, vider } from '../ui.js';
import { enregistrerPageDomaine } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, formatLong } from '../dates.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { cartesDuDomaine } from './domaine.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';
import { ouvrirAjoutTache, categorieDe } from './actions-taches.js';
import { rendreEcheances } from './administratif-echeances.js';
import { rendreFiches, reinitialiserFiches } from './administratif-fiches.js';
import './ui-echeances.js';
import './ui-fiches.js';

const ONGLETS = [
  { id: 'jour', titre: "Vue d'ensemble", icone: '🗂️' },
  { id: 'echeances', titre: 'Échéances', icone: '📅' },
  { id: 'fiches', titre: 'Fiches', icone: '📇' },
];

let onglet = 'jour';
enregistrerReinitialisationOnglets(() => {
  onglet = 'jour';
  reinitialiserFiches();
});

function rendreVueEnsemble(conteneur, ctx) {
  const donnees = store.lire();
  const cat = categorieDe(donnees, ctx.categorieId);
  vider(conteneur);
  conteneur.append(h('div', { class: 'pile pile-large' }, ...cartesDuDomaine(donnees, cat)));
}

const RENDUS = { jour: rendreVueEnsemble, echeances: rendreEcheances, fiches: rendreFiches };

function rendre(racine, { redessiner, categorieId }) {
  const donnees = store.lire();
  const cat = categorieDe(donnees, categorieId);
  const contenu = h('div', { class: 'etudes-contenu' });
  RENDUS[onglet](contenu, { redessiner, categorieId });

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
          h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirAjoutTache({ categorieId }) }, `＋ Ajouter en ${cat.nom}`)
        )
      ),
      barreOnglets({
        onglets: ONGLETS,
        actif: onglet,
        surChoix: (id) => {
          onglet = id;
          redessiner();
        },
      }),
      contenu
    )
  );
}

enregistrerPageDomaine('administratif', rendre);
