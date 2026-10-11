// Onglet « Suivi » : mon temps de concentration, mon avancement, mes scores.
// Rien de comparatif ni de culpabilisant : on montre ce qui a été fait.

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, jourCourt } from '../dates.js';
import * as E from './etudes-donnees.js';

function tuile(valeur, libelle, couleur) {
  return h('div', { class: 'tuile', style: `--cat: var(--${couleur})` }, h('span', { class: 'tuile-valeur mono' }, valeur), h('span', { class: 'tuile-libelle' }, libelle));
}

export function rendreSuivi(conteneur) {
  const d = store.lire();
  const stats = E.statsTemps(d, aujourdhui());
  const maxJour = Math.max(1, ...stats.derniersJours.map((j) => j.secondes));
  const { modules } = d.etudes;
  const orphelin = stats.parChapitre.get(null) || 0;

  const barres = h(
    'div',
    { class: 'histogramme', role: 'img', 'aria-label': 'Temps de concentration des 7 derniers jours' },
    stats.derniersJours.map((j) =>
      h(
        'div',
        { class: 'histogramme-colonne' },
        h('span', { class: 'mono histogramme-valeur' }, j.secondes ? E.formaterDuree(j.secondes) : ''),
        h('div', { class: 'histogramme-barre-zone' }, h('div', { class: 'histogramme-barre', style: `height: ${Math.round((j.secondes / maxJour) * 100)}%` })),
        h('span', { class: 'mono histogramme-jour' + (j.date === aujourdhui() ? ' aujourdhui' : '') }, jourCourt(j.date))
      )
    )
  );

  const scores = d.etudes.qcm
    .map((q) => ({ q, r: E.resumeScores(d, q.id) }))
    .filter((x) => x.r);

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h('div', { class: 'grille-tuiles' }, tuile(E.formaterDuree(stats.aujourdhui), "aujourd'hui", 'jaune'), tuile(E.formaterDuree(stats.cetteSemaine), 'cette semaine', 'turquoise'), tuile(E.formaterDuree(stats.total), 'au total', 'violet'), tuile(String(stats.nbSessions), 'sessions', 'rose')),

      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes 7 derniers jours')),
        h('div', { class: 'fenetre-corps' }, stats.total ? barres : h('p', { class: 'vide' }, 'Lance une première session dans l\'onglet Minuteur : elle apparaîtra ici ✦'))
      ),

      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--violet)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Par module et par chapitre')),
        modules.length === 0
          ? h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, "Ajoute tes modules dans l'onglet Parcours pour retrouver ici le temps passé sur chacun."))
          : h(
              'div',
              { class: 'fenetre-corps pile' },
              modules.map((m) => {
                const p = E.progression(d, m.id);
                const chapitres = E.chapitresDuModule(d, m.id);
                return h(
                  'div',
                  { class: 'suivi-module' },
                  h('div', { class: 'rangee' }, h('strong', { class: 'ligne-bloc' }, m.titre), h('span', { class: 'mono' }, `${E.formaterDuree(E.tempsDuModule(d, m.id, stats.parChapitre))} · ${p.termines}/${p.total}`)),
                  h('div', { class: 'barre-progression barre-fine' }, h('div', { class: 'remplissage', style: `width: ${p.pourcent}%` })),
                  h(
                    'ul',
                    { class: 'liste-simple suivi-chapitres' },
                    chapitres.map((c) =>
                      h(
                        'li',
                        { class: 'rangee' },
                        h('span', { class: `statut-pastille statut-${c.statut}`, title: E.STATUTS.find((s) => s.id === c.statut)?.nom }),
                        h('span', { class: 'ligne-bloc' }, c.titre),
                        h('span', { class: 'mono meta' }, stats.parChapitre.get(c.id) ? E.formaterDuree(stats.parChapitre.get(c.id)) : '—')
                      )
                    )
                  )
                );
              }),
              orphelin > 0 && h('p', { class: 'meta mono' }, `Sans chapitre précis : ${E.formaterDuree(orphelin)}`)
            )
      ),

      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--rose)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes QCM')),
        scores.length === 0
          ? h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Tes scores apparaîtront ici après un premier QCM.'))
          : h(
              'ul',
              { class: 'fenetre-corps liste' },
              scores.map(({ q, r }) =>
                h(
                  'li',
                  { class: 'ligne ligne-simple' },
                  h('span', { class: 'ligne-bloc' }, h('strong', null, q.titre), h('span', { class: 'meta' }, E.nomChapitre(d, q.chapitreId))),
                  h('div', { class: 'barre-progression barre-mini', 'aria-hidden': 'true' }, h('div', { class: 'remplissage', style: `width: ${r.dernier.pourcent}%` })),
                  h('span', { class: 'mono' }, `${r.dernier.juste}/${r.dernier.total}`),
                  h('span', { class: 'meta mono' }, `meilleur ${r.meilleur} %`)
                )
              )
            )
      )
    )
  );
}
