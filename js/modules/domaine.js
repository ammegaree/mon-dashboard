// Page générique d'un domaine (une catégorie) : ce qui est prévu aujourd'hui et
// dans les 7 prochains jours pour ce domaine. Les modules plus riches (Études,
// Sport…) remplaceront cette page par la leur avec `enregistrerPageDomaine`.

import { h, pastilles, etincelles } from '../ui.js';
import * as store from '../store.js';
import { DOMAINES_PREVUS, elementsDuJour, cleCoche, estCoche } from '../registry.js';
import { aujourdhui, ajouterJours, formatCourt, formatLong } from '../dates.js';
import { categorieDe, ouvrirAjoutTache, ligneTache, ligneInfo } from './actions-taches.js';
import { basculerCoche } from './taches.js';
import { ligneRendezVous } from './ui-rendezvous.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';

function itemsDuDomaine(date, categorieId, donnees) {
  return elementsDuJour(date, donnees).filter((e) => !e.groupe && categorieDe(donnees, e.categorieId).id === categorieId);
}

// Les deux cartes « Aujourd'hui » et « Dans les 7 prochains jours » d'un domaine
// (réutilisées par les pages de domaine plus riches, comme Maison).
export function cartesDuDomaine(donnees, cat) {
  const reel = aujourdhui();
  const aujourdhuiItems = itemsDuDomaine(reel, cat.id, donnees);
  const aVenir = [];
  for (let i = 1; i <= 7; i++) {
    const date = ajouterJours(reel, i);
    for (const item of itemsDuDomaine(date, cat.id, donnees)) if (!item.discret) aVenir.push(item);
  }

  const surCoche = (item) => {
    if (!estCoche(store.lire(), item)) {
      const boite = document.querySelector(`[data-cle="${CSS.escape(cleCoche(item))}"] .case-boite`);
      etincelles(boite);
    }
    store.modifier((d) => basculerCoche(d, cleCoche(item)));
  };

  return [
    h(
      'section',
      { class: 'fenetre carte-categorie', style: `--cat: var(--${cat.couleur})` },
      h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, "Aujourd'hui")),
      aujourdhuiItems.length
        ? h('ul', { class: 'fenetre-corps liste' }, aujourdhuiItems.map((i) => (i.type === 'rdv' ? ligneRendezVous(i, donnees) : i.type === 'info' ? ligneInfo(i) : ligneTache(i, donnees, { surCoche }))))
        : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, `Rien de prévu aujourd'hui en ${cat.nom}. Profite ✦`))
    ),
    h(
      'section',
      { class: 'fenetre' },
      h('div', { class: 'fenetre-barre', style: `--cat: var(--${cat.couleur})` }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Dans les 7 prochains jours')),
      aVenir.length
        ? h(
            'ul',
            { class: 'fenetre-corps liste' },
            aVenir.map((i) =>
              h(
                'li',
                { class: 'ligne ligne-simple' },
                h('span', { class: 'meta rdv-heure' }, formatCourt(i.date)),
                h('span', { class: 'ligne-bloc' }, i.heure ? `${i.heure} · ${i.titre}` : i.titre)
              )
            )
          )
        : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Rien de prévu dans les 7 prochains jours.'))
    ),
  ];
}

export function rendreDomaine(racine, { categorieId }) {
  const donnees = store.lire();
  const cat = categorieDe(donnees, categorieId);
  const reel = aujourdhui();
  const prevu = DOMAINES_PREVUS[cat.id];

  racine.replaceChildren(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'entete-page' },
        h('div', null, h('h1', null, `${cat.icone} ${cat.nom}`), h('p', { class: 'sous-titre mono' }, formatLong(reel))),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirBrainDump({ categorieId: cat.id }) }, libelleBrainDump(store.lire(), cat.id)),
          h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirAjoutTache({ categorieId: cat.id }) }, `＋ Ajouter en ${cat.nom}`)
        )
      ),
      cartesDuDomaine(donnees, cat),
      prevu &&
        h(
          'section',
          { class: 'fenetre' },
          h('div', { class: 'fenetre-barre', style: `--cat: var(--${cat.couleur})` }, pastilles(), h('strong', { class: 'fenetre-titre' }, 'Bientôt ici')),
          h('div', { class: 'fenetre-corps' }, h('p', null, `${prevu.texte} (étape ${prevu.etape} de la construction)`))
        )
    )
  );
}
