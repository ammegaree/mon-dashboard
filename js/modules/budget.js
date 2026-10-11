// Page du domaine « Budget » : la vue d'ensemble (budget et dépenses du mois), les économies, et le remboursement d'un prêt.

import { h, vider } from '../ui.js';
import { enregistrerPageDomaine, elementsDuJour } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours, formatLong } from '../dates.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { cartesDuDomaine } from './domaine.js';
import { categorieDe } from './actions-taches.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';
import { reinitialiserBudget } from './budget-commun.js';
import { rendreEnsemble } from './budget-ensemble.js';
import { rendreEpargne } from './budget-epargne.js';
import { rendrePret } from './budget-pret.js';
import { ouvrirDepense } from './ui-budget.js';

const ONGLETS = [
  { id: 'jour', titre: "Vue d'ensemble", icone: '💶' },
  { id: 'epargne', titre: 'Économies', icone: '💰' },
  { id: 'pret', titre: 'Prêt', icone: '🏦' },
];

let onglet = 'jour';
enregistrerReinitialisationOnglets(() => {
  onglet = 'jour';
  reinitialiserBudget();
});

// Les tâches / rendez-vous rangés dans « Budget » (par exemple « Payer le loyer ») : on n'affiche leurs cartes
// que s'il y en a, pour ne pas ajouter de cartes vides.
function aDuContenu(donnees, categorieId) {
  const reel = aujourdhui();
  for (let i = 0; i <= 7; i++) {
    const items = elementsDuJour(ajouterJours(reel, i), donnees);
    if (items.some((x) => !x.groupe && !x.discret && categorieDe(donnees, x.categorieId).id === categorieId)) return true;
  }
  return false;
}

function rendreEnsembleComplet(conteneur, ctx) {
  rendreEnsemble(conteneur, ctx);
  const donnees = store.lire();
  if (!aDuContenu(donnees, ctx.categorieId)) return;
  conteneur.firstChild.append(...cartesDuDomaine(donnees, categorieDe(donnees, ctx.categorieId)));
}

const RENDUS = { jour: rendreEnsembleComplet, epargne: rendreEpargne, pret: rendrePret };

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
          h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirDepense({}) }, '＋ Dépense')
        )
      ),
      barreOnglets({ onglets: ONGLETS, actif: onglet, surChoix: aller }),
      contenu
    )
  );
}

enregistrerPageDomaine('budget', rendre);
