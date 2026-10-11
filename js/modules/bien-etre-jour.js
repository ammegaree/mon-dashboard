// Bien-être › « Mon jour » : le check-in du jour, mes habitudes du jour, ma semaine,
// ma phrase du jour.

import { h, vider, etincelles, pastilles } from '../ui.js';
import * as store from '../store.js';
import { elementsDuJour, cleCoche, estCoche } from '../registry.js';
import { aujourdhui, ajouterJours, lundiDe, jourCourt, formatLong } from '../dates.js';
import * as B from './bien-etre-donnees.js';
import { ligneTache } from './actions-taches.js';
import { basculerCoche } from './taches.js';
import { ouvrirCheckin, ouvrirCheckinGuide } from './bien-etre-checkin.js';

// ---- Affichage ----

function resumeCheckin(c) {
  const humeur = B.HUMEURS.find((x) => x.v === c.humeur);
  const energie = B.ENERGIES.find((x) => x.v === c.energie);
  const qualite = B.QUALITES_SOMMEIL.find((x) => x.v === c.sommeilQualite);
  return h(
    'ul',
    { class: 'resume-checkin' },
    humeur && h('li', null, h('span', { class: 'resume-emoji', 'aria-hidden': 'true' }, humeur.emoji), h('span', null, `Humeur : ${humeur.nom}`)),
    energie && h('li', null, h('span', { class: 'resume-emoji', 'aria-hidden': 'true' }, energie.emoji), h('span', null, `Énergie : ${energie.nom}`)),
    (c.sommeilHeures != null || qualite) &&
      h('li', null, h('span', { class: 'resume-emoji', 'aria-hidden': 'true' }, '🌙'), h('span', null, ['Sommeil : ', c.sommeilHeures != null ? B.formaterHeures(c.sommeilHeures) : '', qualite ? ` (${qualite.nom.toLowerCase()})` : ''])),
    c.note && h('li', null, h('span', { class: 'resume-emoji', 'aria-hidden': 'true' }, '📝'), h('span', null, c.note))
  );
}

export function rendreJour(conteneur, ctx) {
  const donnees = store.lire();
  const reel = aujourdhui();
  const checkin = B.checkinDuJour(donnees, reel);
  const habitudes = elementsDuJour(reel, donnees).filter((e) => e.source === 'habitude');
  const faites = habitudes.filter((e) => estCoche(donnees, e)).length;
  const lundi = lundiDe(reel);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
  const moy = B.moyennesCheckins(donnees, lundi, ajouterJours(lundi, 6));
  
  const surCoche = (item) => {
    if (!estCoche(donnees, item)) etincelles(document.querySelector(`[data-cle="${CSS.escape(cleCoche(item))}"] .case-boite`));
    store.modifier((d) => basculerCoche(d, cleCoche(item)));
  };

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },

      // Check-in
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--rose)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mon check-in du jour'), checkin && h('span', { class: 'mono' }, '✓ fait')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          checkin
            ? h(
                'div',
                { class: 'pile' },
                resumeCheckin(checkin),
                h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirCheckin({ date: reel }) }, '✎ Modifier'))
              )
            : h(
                'div',
                { class: 'pile' },
                h('p', { class: 'doux' }, 'Humeur, énergie, sommeil : trois petites questions, toutes facultatives.'),
                h('div', null, h('button', { class: 'bouton bouton-jaune bouton-grand', type: 'button', onclick: () => ouvrirCheckinGuide({ date: reel }) }, '🌤️ Faire mon check-in'))
              )
        )
      ),

      // Habitudes du jour
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes habitudes du jour'), habitudes.length > 0 && h('span', { class: 'mono' }, `${faites}/${habitudes.length}`)),
        habitudes.length
          ? h('ul', { class: 'fenetre-corps liste' }, habitudes.map((i) => ligneTache(i, donnees, { surCoche })))
          : h(
              'div',
              { class: 'fenetre-corps pile' },
              h('p', { class: 'doux' }, "Pas d'habitude prévue aujourd'hui."),
              h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ctx.aller('habitudes') }, 'Mes habitudes'))
            )
      ),

      // Ma semaine
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--ciel)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ma semaine')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h(
            'div',
            { class: 'semaine-humeur', role: 'list' },
            jours.map((date) => {
              const c = B.checkinDuJour(donnees, date);
              const humeur = c && B.HUMEURS.find((x) => x.v === c.humeur);
              const futur = date > reel;
              return h(
                'button',
                {
                  class: 'jour-humeur' + (date === reel ? ' aujourdhui' : ''),
                  type: 'button',
                  role: 'listitem',
                  disabled: futur,
                  title: futur ? '' : `Check-in · ${formatLong(date)}`,
                  'aria-label': `${formatLong(date)}${humeur ? ` : ${humeur.nom}` : ''}`,
                  onclick: () => ouvrirCheckin({ date }),
                },
                h('span', { class: 'mono jour-humeur-nom' }, jourCourt(date)),
                h('span', { class: 'jour-humeur-emoji', 'aria-hidden': 'true' }, humeur ? humeur.emoji : c ? '•' : '·')
              );
            })
          ),
          moy.nbJours > 0
            ? h(
                'p',
                { class: 'mono doux' },
                [
                  `${moy.nbJours} jour${moy.nbJours > 1 ? 's' : ''} renseigné${moy.nbJours > 1 ? 's' : ''}`,
                  moy.humeur != null ? ` · humeur moyenne ${moy.humeur.toFixed(1).replace('.', ',')}/5` : '',
                  moy.energie != null ? ` · énergie ${moy.energie.toFixed(1).replace('.', ',')}/5` : '',
                  moy.sommeilHeures != null ? ` · sommeil ${B.formaterHeures(moy.sommeilHeures)}` : '',
                ].join('')
              )
            : h('p', { class: 'doux' }, 'Ta semaine se dessinera au fil de tes check-ins.')
        )
      )
    )
  );
}
