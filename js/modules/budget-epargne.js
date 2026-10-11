// Budget › « Économies » : mes objectifs (vacances, imprévus, ordinateur…) et ce que j'y mets de côté.
// Même geste que les autres pages : les objectifs en cartes, le détail en cliquant.

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import * as G from './budget-donnees.js';
import * as EP from './epargne-donnees.js';
import { ecran, dateLongue } from './budget-commun.js';
import { ouvrirObjectif, ouvrirVersement } from './ui-epargne.js';

const e = G.formaterEuros;

function barre(ratio, texte) {
  const pourcent = Math.round(ratio * 100);
  return h(
    'div',
    { class: 'progression-fine' },
    h('div', { class: 'barre-progression', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent }, h('div', { class: 'remplissage', style: `width: ${pourcent}%` })),
    h('span', { class: 'progression-texte mono' }, texte)
  );
}

function carteObjectif(o, ctx) {
  const etat = EP.etatObjectif(o);
  const texte = etat.cible ? `${e(etat.total)} sur ${e(etat.cible)}` : `${e(etat.total)} de côté`;
  return h(
    'button',
    {
      class: 'carte-zone carte-enveloppe',
      type: 'button',
      onclick: () => {
        ecran.objectif = o.id;
        ctx.redessiner();
      },
    },
    h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, o.icone),
    h(
      'span',
      { class: 'carte-zone-texte' },
      h('strong', null, o.nom),
      h('span', { class: 'meta' }, etat.atteint ? `${texte} · atteint 🎉` : texte),
      etat.cible && h('span', { class: 'mini-barre', 'aria-hidden': 'true' }, h('span', { class: 'mini-remplissage', style: `width: ${Math.round(etat.ratio * 100)}%` }))
    )
  );
}

function rendreListe(conteneur, ctx, donnees) {
  const { objectifs } = donnees.budget;
  if (objectifs.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes économies 💰')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, 'Un objectif, c’est une tirelire avec un nom : vacances, imprévus, ordinateur… Tu notes ce que tu mets de côté, et tu vois où tu en es, sans pression.'),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirObjectif({ surCreation: (id) => { ecran.objectif = id; } }) }, '＋ Mon premier objectif'))
        )
      )
    );
    return;
  }
  const total = EP.totalEpargne(donnees);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h('p', { class: 'reste-grand' }, h('span', { class: 'reste-montant' }, e(total)), h('span', { class: 'reste-phrase' }, 'de côté en tout')),
      h('div', { class: 'grille-zones' }, objectifs.map((o) => carteObjectif(o, ctx))),
      h('div', { class: 'barre-discrete' }, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirObjectif({ surCreation: (id) => { ecran.objectif = id; } }) }, '＋ Objectif'))
    )
  );
}

function rendreDetail(conteneur, ctx, donnees, o) {
  const etat = EP.etatObjectif(o);
  const versements = [...o.versements].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        null,
        h(
          'button',
          {
            class: 'bouton bouton-petit',
            type: 'button',
            onclick: () => {
              ecran.objectif = null;
              ctx.redessiner();
            },
          },
          '← Tous mes objectifs'
        )
      ),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, `${o.icone} ${o.nom}`),
          h('button', { class: 'bouton-icone', type: 'button', title: "Modifier l'objectif", 'aria-label': `Modifier l'objectif ${o.nom}`, onclick: () => ouvrirObjectif({ id: o.id }) }, '✎')
        ),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('div', { class: 'reste-grand' }, h('span', { class: 'reste-montant' }, e(etat.total)), h('span', { class: 'reste-phrase' }, etat.cible ? `sur ${e(etat.cible)}` : 'de côté')),
          etat.cible && barre(etat.ratio, `${Math.round(etat.ratio * 100)} %`),
          etat.atteint
            ? h('p', { class: 'doux' }, 'Objectif atteint, bravo ! 🎉')
            : etat.cible && h('p', { class: 'doux' }, `Il reste ${e(etat.reste)} pour y arriver.`),
          etat.parMois !== null && h('p', { class: 'doux' }, `D’ici le ${dateLongue(o.echeance)}, ça fait environ ${e(etat.parMois)} par mois.`),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirVersement({ objectifId: o.id }) }, '➕ Mettre de côté'),
            etat.total > 0 && h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirVersement({ objectifId: o.id, retrait: true }) }, '↩ Reprendre')
          )
        )
      ),
      h(
        'section',
        { class: 'fenetre' },
        h('div', { class: 'fenetre-barre', style: '--cat: var(--jaune)' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Historique')),
        versements.length
          ? h(
              'ul',
              { class: 'fenetre-corps liste' },
              versements.map((v) =>
                h(
                  'li',
                  { class: 'ligne ligne-depense' },
                  h(
                    'div',
                    { class: 'ligne-bloc' },
                    h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier', onclick: () => ouvrirVersement({ objectifId: o.id, id: v.id }) }, v.note || (v.montant < 0 ? 'Repris' : 'Mis de côté')),
                    h('span', { class: 'meta' }, dateLongue(v.date))
                  ),
                  h('strong', { class: 'montant mono' }, `${v.montant < 0 ? '−' : '+'} ${e(Math.abs(v.montant))}`)
                )
              )
            )
          : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Rien de noté pour l’instant.'))
      )
    )
  );
}

export function rendreEpargne(conteneur, ctx) {
  const donnees = store.lire();
  vider(conteneur);
  const o = ecran.objectif ? EP.objectifParId(donnees, ecran.objectif) : null;
  if (!o) ecran.objectif = null;
  if (o) rendreDetail(conteneur, ctx, donnees, o);
  else rendreListe(conteneur, ctx, donnees);
}
