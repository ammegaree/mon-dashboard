// Page du domaine « Maison » : vue d'ensemble, ménage et entretien (à rythme souple).
// Onglets : vue d'ensemble, ménage, plantes, projets.
// Elle remplace la page générique des domaines pour la catégorie « maison ».

import { h, vider, pastilles } from '../ui.js';
import { enregistrerPageDomaine } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, formatLong } from '../dates.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { cartesDuDomaine } from './domaine.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';
import { ouvrirAjoutTache, categorieDe } from './actions-taches.js';
import { rendreMenage } from './maison-menage.js';
import { rendrePlantes } from './maison-plantes.js';
import { rendreProjets } from './maison-projets.js';
import './ui-projets.js';
import './ui-plantes.js';
import { aFaireBientot } from './maison-donnees.js';

const ONGLETS = [
  { id: 'jour', titre: "Vue d'ensemble", icone: '🏡' },
  { id: 'menage', titre: 'Ménage et entretien', icone: '🧹' },
  { id: 'plantes', titre: 'Plantes', icone: '🪴' },
  { id: 'projets', titre: 'Projets', icone: '🧱' },
];

let onglet = 'jour';
enregistrerReinitialisationOnglets(() => (onglet = 'jour'));

function rendreVueEnsemble(conteneur, ctx) {
  const donnees = store.lire();
  const cat = categorieDe(donnees, ctx.categorieId);
  const bientot = aFaireBientot(donnees, aujourdhui()).length;
  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      ...cartesDuDomaine(donnees, cat),
      bientot > 0 &&
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--turquoise)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ménage et entretien')),
          h(
            'div',
            { class: 'fenetre-corps pile' },
            h('p', null, `${bientot} petite${bientot > 1 ? 's' : ''} chose${bientot > 1 ? 's' : ''} à faire bientôt. Quelques-unes seulement te sont proposées chaque jour.`),
            h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ctx.aller('menage') }, 'Voir ma liste'))
          )
        )
    )
  );
}

const RENDUS = { jour: rendreVueEnsemble, menage: rendreMenage, plantes: rendrePlantes, projets: rendreProjets };

function rendre(racine, { redessiner, categorieId }) {
  const donnees = store.lire();
  const cat = categorieDe(donnees, categorieId);
  const aller = (id) => {
    onglet = id;
    redessiner();
  };
  const contenu = h('div', { class: 'etudes-contenu' });
  RENDUS[onglet](contenu, { redessiner, aller, categorieId });

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
      barreOnglets({ onglets: ONGLETS, actif: onglet, surChoix: aller }),
      contenu
    )
  );
}

enregistrerPageDomaine('maison', rendre);
