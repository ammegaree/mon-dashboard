// Page du domaine « Bien-être » : Mon jour, Journal, Habitudes, Motivation.
// Elle remplace la page générique des domaines pour la catégorie « bien-etre ».

import { h, vider } from '../ui.js';
import { enregistrerPageDomaine } from '../registry.js';
import * as store from '../store.js';
import { formatLong, aujourdhui } from '../dates.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { rendreJour } from './bien-etre-jour.js';
import { rendreAnalyse } from './bien-etre-analyse.js';
import { ouvrirCheckin } from './bien-etre-checkin.js';
import { checkinDuJour } from './bien-etre-donnees.js';
import { rendreJournal } from './bien-etre-journal.js';
import { rendreHabitudes } from './bien-etre-habitudes.js';
import { rendreMotivation } from './bien-etre-motivation.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';

const ONGLETS = [
  { id: 'jour', titre: "Vue d'ensemble", icone: '🌸' },
  { id: 'analyse', titre: 'Analyse', icone: '📊' },
  { id: 'journal', titre: 'Journal', icone: '📖' },
  { id: 'habitudes', titre: 'Habitudes', icone: '🔁' },
  { id: 'motivation', titre: 'Motivation', icone: '💛' },
];

const RENDUS = { jour: rendreJour, analyse: rendreAnalyse, journal: rendreJournal, habitudes: rendreHabitudes, motivation: rendreMotivation };

let onglet = 'jour';
enregistrerReinitialisationOnglets(() => (onglet = 'jour'));

function rendre(racine, { redessiner, categorieId }) {
  const donnees = store.lire();
  const cat = donnees.categories.find((c) => c.id === categorieId);
  const aller = (id) => {
    onglet = id;
    redessiner();
  };

  const contenu = h('div', { class: 'etudes-contenu' });
  RENDUS[onglet](contenu, { redessiner, aller });

  vider(racine);
  racine.append(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'entete-page' },
        h('div', null, h('h1', null, `${cat?.icone || '🌸'} ${cat?.nom || 'Bien-être'}`), h('p', { class: 'sous-titre mono' }, formatLong(aujourdhui()))),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirBrainDump({ categorieId }) }, libelleBrainDump(store.lire(), categorieId)),
          !checkinDuJour(donnees, aujourdhui()) && h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirCheckin({}) }, '🌤️ Faire mon check-in')
        )
      ),
      barreOnglets({ onglets: ONGLETS, actif: onglet, surChoix: aller }),
      contenu
    )
  );
}

enregistrerPageDomaine('bien-etre', rendre);
