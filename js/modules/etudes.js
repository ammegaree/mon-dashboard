// Page du domaine « Études » : Vue d'ensemble, Parcours, Cours, Minuteur, QCM, Recherche perso, Suivi.
// Elle remplace la page générique des domaines pour la catégorie « etudes ».

import { h, vider } from '../ui.js';
import { enregistrerPageDomaine } from '../registry.js';
import * as store from '../store.js';
import { progression } from './etudes-donnees.js';
import { rendreParcours } from './etudes-parcours.js';
import { rendreCours } from './etudes-cours.js';
import { rendreMinuteur } from './etudes-minuteur.js';
import { rendreQcm, reinitialiserVueQcm } from './etudes-qcm.js';
import { rendreRecherche } from './etudes-recherche.js';
import { rendreSuivi } from './etudes-suivi.js';
import * as M from './minuteur.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { rendreVueEnsemble } from './vue-ensemble.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';

const ONGLETS = [
  { id: 'ensemble', titre: "Vue d'ensemble", icone: '📚' },
  { id: 'parcours', titre: 'Parcours', icone: '🗺️' },
  { id: 'cours', titre: 'Cours', icone: '📖' },
  { id: 'minuteur', titre: 'Minuteur', icone: '⏱️' },
  { id: 'qcm', titre: 'QCM', icone: '📝' },
  { id: 'recherche', titre: 'Recherche perso', icone: '🔎' },
  { id: 'suivi', titre: 'Suivi', icone: '📈' },
];

const RENDUS = { ensemble: rendreVueEnsemble((donnees) => resumeEtudes(donnees)), parcours: rendreParcours, cours: rendreCours, minuteur: rendreMinuteur, qcm: rendreQcm, recherche: rendreRecherche, suivi: rendreSuivi };

let onglet = 'ensemble';
let parametresEnAttente = null; // paramètres à usage unique transmis à l'onglet qu'on ouvre

// Utilisé par l'indicateur du minuteur dans la barre latérale.
export function ouvrirOngletEtudes(id) {
  if (RENDUS[id]) {
    onglet = id;
    ongletImpose = true; // le lien du minuteur arrive sur son onglet, pas sur la vue d'ensemble
  }
}

// Ouvre le cours écrit d'un chapitre (depuis la recherche, par exemple) : l'onglet « Cours » arrive sur ce chapitre.
export function ouvrirCoursEtudes(chapitreId) {
  onglet = 'cours';
  parametresEnAttente = { chapitreId };
  ongletImpose = true;
}

let ongletImpose = false;
enregistrerReinitialisationOnglets(() => {
  if (ongletImpose) ongletImpose = false;
  else onglet = 'ensemble';
});

// Un petit résumé en tête de la vue d'ensemble : l'avancement du parcours.
function resumeEtudes(donnees) {
  const g = progression(donnees);
  if (!g.total) return null;
  return h(
    'div',
    { class: 'progression-fine' },
    h('div', { class: 'barre-progression', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': g.pourcent }, h('div', { class: 'remplissage', style: `width: ${g.pourcent}%` })),
    h('span', { class: 'progression-texte mono' }, `${g.termines} sur ${g.total} terminé${g.termines > 1 ? 's' : ''}${g.enCours ? ` · ${g.enCours} en cours` : ''}`)
  );
}

function rendre(racine, { redessiner, categorieId }) {
  ongletImpose = false;
  const donnees = store.lire();
  const cat = donnees.categories.find((c) => c.id === categorieId);
  const p = progression(donnees);
  const minuteurActif = M.etat().phase !== 'inactif';

  const aller = (id, params = null) => {
    if (id !== 'qcm') reinitialiserVueQcm();
    onglet = id;
    parametresEnAttente = params;
    redessiner();
  };

  const contenu = h('div', { class: 'etudes-contenu' });
  const params = parametresEnAttente;
  parametresEnAttente = null;
  RENDUS[onglet](contenu, { redessiner, aller, params, categorieId });

  vider(racine);
  racine.append(
    h(
      'div',
      { class: 'page page-etudes' },
      h(
        'header',
        { class: 'entete-page' },
        h('div', null, h('h1', null, `${cat?.icone || '📚'} ${cat?.nom || 'Études'}`), h('p', { class: 'sous-titre mono' }, p.total ? `${p.termines}/${p.total} chapitres · ${p.pourcent} %` : 'Ta formation, étape par étape')),
        h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirBrainDump({ categorieId }) }, libelleBrainDump(store.lire(), categorieId))
      ),
      barreOnglets({ onglets: ONGLETS, actif: onglet, surChoix: (id) => aller(id), badges: minuteurActif ? { minuteur: 'Minuteur en cours' } : {} }),
      contenu
    )
  );
}

enregistrerPageDomaine('etudes', rendre);
