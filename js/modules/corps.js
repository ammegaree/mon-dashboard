// Page du domaine « Corps » : ma courbe de poids (facultative) et la vue d'ensemble des tâches du domaine.
// Le suivi est facultatif, neutre (pas d'objectif, pas de jugement) et n'apparaît jamais sur l'accueil.

import { h, vider } from '../ui.js';
import { enregistrerPageDomaine } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, formatLong } from '../dates.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { cartesDuDomaine } from './domaine.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';
import { ouvrirAjoutTache, categorieDe } from './actions-taches.js';
import { rendreCorps } from './carnet-corps.js';

const ONGLETS = [
  { id: 'jour', titre: "Vue d'ensemble", icone: '🌿' },
  { id: 'courbe', titre: 'Courbe de poids', icone: '📈' },
];

let onglet = 'jour';
enregistrerReinitialisationOnglets(() => (onglet = 'jour'));

function rendreVueEnsemble(conteneur, ctx) {
  const donnees = store.lire();
  const cat = categorieDe(donnees, ctx.categorieId);
  vider(conteneur);
  conteneur.append(h('div', { class: 'pile pile-large' }, ...cartesDuDomaine(donnees, cat)));
}

const RENDUS = { courbe: rendreCorps, jour: rendreVueEnsemble };

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

enregistrerPageDomaine('corps', rendre);
