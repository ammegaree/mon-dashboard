// Barre d'onglets partagée par les pages à sections (Études, Bien-être, Carnet).

import { h } from '../ui.js';

// onglets : [{ id, titre, icone }] ; badges : { idOnglet: 'texte du point' } (un petit point clignotant)
export function barreOnglets({ onglets, actif, surChoix, badges = {} }) {
  const barre = h(
    'nav',
    { class: 'onglets', 'aria-label': 'Sections' },
    onglets.map((o) =>
      h(
        'button',
        {
          class: 'onglet' + (o.id === actif ? ' actif' : ''),
          type: 'button',
          'aria-current': o.id === actif ? 'page' : null,
          onclick: () => surChoix(o.id),
        },
        h('span', { 'aria-hidden': 'true' }, o.icone),
        ` ${o.titre}`,
        badges[o.id] && h('span', { class: 'onglet-point', title: badges[o.id] }, '●')
      )
    )
  );
  // Sur téléphone, la barre défile sur une seule ligne : on amène l'onglet actif au centre.
  requestAnimationFrame(() => {
    const a = barre.querySelector('.onglet.actif');
    if (a && barre.scrollWidth > barre.clientWidth) barre.scrollLeft = a.offsetLeft - (barre.clientWidth - a.offsetWidth) / 2;
  });
  return barre;
}

// À l'arrivée dans une catégorie (depuis la barre latérale ou un lien), on retombe sur sa « Vue d'ensemble ».
// Chaque page à onglets déclare ici comment revenir à son premier onglet.
const reinitialisations = [];

export function enregistrerReinitialisationOnglets(fn) {
  reinitialisations.push(fn);
}

export function reinitialiserOnglets() {
  for (const fn of reinitialisations) fn();
}
