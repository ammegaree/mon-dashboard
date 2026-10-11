// Maison › « Projets » : de grands « à faire » découpés en petites étapes, une à la fois.
// Même style que le reste : « la prochaine étape », des cartes qu'on ouvre, une action par ligne.

import { h, vider, pastilles, etincelles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as P from './projets-donnees.js';
import { ouvrirProjet, ouvrirEtape, ouvrirPlusieursEtapes, ouvrirIdeesProjets, basculerEtape } from './ui-projets.js';

// Le projet dont on voit les étapes (null : tous les projets).
let projetOuvert = null;
let focusProjetId = null; // projet dont le champ « nouvelle étape » doit reprendre le focus

function barre(pourcent) {
  return h(
    'div',
    { class: 'barre-progression barre-fine', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent },
    h('div', { class: 'remplissage', style: `width: ${pourcent}%` })
  );
}

function boutonFait(etape) {
  return h(
    'button',
    {
      class: 'bouton bouton-petit bouton-turquoise',
      type: 'button',
      onclick: (e) => {
        etincelles(e.currentTarget);
        basculerEtape(etape.id);
      },
    },
    'Fait ✓'
  );
}

// ---- La prochaine étape de chaque projet en cours ----

function blocProchaines(donnees, jour, ctx) {
  const liste = P.etapesDuJour(donnees, jour, jour);
  return h(
    'section',
    { class: 'fenetre', style: '--cat: var(--jaune)' },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'La prochaine étape')),
    liste.length === 0
      ? h(
          'div',
          { class: 'fenetre-corps' },
          h('p', { class: 'doux' }, donnees.maison.projets.some((p) => !P.termine(p)) ? 'Aucun projet en cours : ouvre un projet et lance-toi quand tu veux.' : 'Rien à faire ici pour le moment ✦')
        )
      : h(
          'ul',
          { class: 'fenetre-corps liste' },
          liste.map(({ projet, etape, fait }) => {
            const p = P.progression(projet);
            const rang = projet.etapes.indexOf(etape) + 1;
            return h(
              'li',
              { class: 'ligne ligne-tache-maison' + (fait ? ' fait' : '') },
              h(
                'div',
                { class: 'ligne-bloc' },
                h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier cette étape', onclick: () => ouvrirEtape({ id: etape.id }) }, etape.titre),
                h(
                  'span',
                  { class: 'meta' },
                  [`${projet.icone} ${projet.titre}`, `étape ${rang} sur ${p.total}`, etape.dureeMin ? `${etape.dureeMin} min` : null].filter(Boolean).join(' · ')
                )
              ),
              h(
                'div',
                { class: 'actions-ligne' },
                fait
                  ? h('button', { class: 'bouton bouton-petit', type: 'button', title: 'Annuler', onclick: () => basculerEtape(etape.id) }, '✓ Fait')
                  : boutonFait(etape)
              )
            );
          })
        )
  );
}

// ---- Mes projets ----

function carteProjet(projet, ctx) {
  const p = P.progression(projet);
  const fini = P.termine(projet);
  const etat = fini ? 'terminé ✓' : p.total === 0 ? 'sans étape' : projet.enCours ? `${p.faites} sur ${p.total} · en cours` : `${p.faites} sur ${p.total}`;
  return h(
    'button',
    {
      class: 'carte-zone' + (projet.enCours && !fini ? ' a-faire' : ''),
      type: 'button',
      onclick: () => {
        projetOuvert = projet.id;
        ctx.redessiner();
      },
    },
    h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, projet.icone),
    h('span', { class: 'carte-zone-texte' }, h('strong', null, projet.titre), h('span', { class: 'meta' }, etat), p.total > 0 && barre(p.pourcent))
  );
}

function rendreAccueil(conteneur, ctx, donnees, jour) {
  const actifs = donnees.maison.projets.filter((p) => !P.termine(p));
  const finis = donnees.maison.projets.filter((p) => P.termine(p));
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      blocProchaines(donnees, jour, ctx),
      actifs.length > 0 &&
        h(
          'div',
          { class: 'pile' },
          h('h2', { class: 'titre-section' }, 'Mes projets'),
          h('div', { class: 'grille-zones' }, actifs.map((p) => carteProjet(p, ctx)))
        ),
      finis.length > 0 &&
        h(
          'details',
          { class: 'repliable-discret' },
          h('summary', null, `Terminés (${finis.length}) ✦`),
          h('div', { class: 'grille-zones' }, finis.map((p) => carteProjet(p, ctx)))
        ),
      h(
        'div',
        { class: 'barre-discrete' },
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirProjet({ surCreation: (p) => { projetOuvert = p.id; focusProjetId = p.id; } }) }, '＋ Projet'),
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ouvrirIdeesProjets }, '💡 Des idées')
      )
    )
  );
}

// ---- Un projet ----

function rendreProjet(conteneur, ctx, donnees, projet) {
  const p = P.progression(projet);
  const suivante = P.prochaineEtape(projet);
  const fini = P.termine(projet);
  const champ = h('input', { type: 'text', class: 'champ', placeholder: 'Nouvelle étape… (Entrée)', maxLength: 160, 'aria-label': `Nouvelle étape de « ${projet.titre} »`, id: 'nouvelle-etape' });
  const ajouter = () => {
    const titre = champ.value.trim();
    if (!titre) return;
    focusProjetId = projet.id;
    store.modifier((d) => P.ajouterEtape(d, projet.id, { titre }));
  };
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ajouter();
    }
  });

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { projetOuvert = null; ctx.redessiner(); } }, '← Tous les projets')),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, `${projet.icone} ${projet.titre}`),
          h('span', { class: 'mono' }, `${p.faites}/${p.total}`),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier le projet', 'aria-label': `Modifier le projet « ${projet.titre} »`, onclick: () => ouvrirProjet({ id: projet.id }) }, '✎')
        ),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          projet.note && h('p', { class: 'doux' }, projet.note),
          p.total > 0 && barre(p.pourcent),
          fini
            ? h('p', null, 'Projet terminé : bravo ✦')
            : h(
                'div',
                null,
                h(
                  'button',
                  { class: 'bouton bouton-petit' + (projet.enCours ? '' : ' bouton-turquoise'), type: 'button', onclick: () => store.modifier((d) => P.definirEnCours(d, projet.id, !projet.enCours)) },
                  projet.enCours ? 'Mettre en pause' : 'Me lancer sur ce projet'
                )
              ),
          projet.etapes.length
            ? h(
                'ul',
                { class: 'liste-simple' },
                projet.etapes.map((etape) =>
                  h(
                    'li',
                    { class: 'ligne' + (etape.faitLe ? ' fait' : '') + (!fini && suivante?.id === etape.id ? ' ligne-tache-maison a-faire' : '') },
                    h(
                      'div',
                      { class: 'case' },
                      h('input', { type: 'checkbox', class: 'case-boite', checked: Boolean(etape.faitLe), 'aria-label': `Cocher « ${etape.titre} »`, onchange: () => basculerEtape(etape.id) }),
                      h('button', { class: 'titre-cliquable ligne-titre', type: 'button', title: 'Modifier cette étape', onclick: () => ouvrirEtape({ id: etape.id }) }, etape.titre)
                    ),
                    etape.dureeMin && h('span', { class: 'meta' }, `${etape.dureeMin} min`)
                  )
                )
              )
            : h('p', { class: 'doux' }, 'Pas encore d’étape : découpe ton projet en petits gestes.'),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            champ,
            h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ajouter }, '＋ Étape'),
            h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirPlusieursEtapes(projet.id) }, 'Plusieurs à la fois')
          )
        )
      )
    )
  );
}

// ---- La page ----

export function rendreProjets(conteneur, ctx) {
  const donnees = store.lire();
  const cleJour = aujourdhui();
  vider(conteneur);

  if (donnees.maison.projets.length === 0) {
    projetOuvert = null;
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes projets maison 🧱')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, "Un grand « à faire » (ranger, repeindre, aménager…) devient une suite de petites étapes. Tu ne vois que la prochaine, une à la fois."),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: ouvrirIdeesProjets }, "💡 Partir d'idées"),
            h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirProjet({ surCreation: (p) => { projetOuvert = p.id; focusProjetId = p.id; } }) }, '＋ Mon premier projet')
          )
        )
      )
    );
    return;
  }

  const projet = projetOuvert ? P.projetParId(donnees, projetOuvert) : null;
  if (!projet) projetOuvert = null;
  if (projet) rendreProjet(conteneur, ctx, donnees, projet);
  else rendreAccueil(conteneur, ctx, donnees, cleJour);

  if (focusProjetId) {
    focusProjetId = null;
    setTimeout(() => document.getElementById('nouvelle-etape')?.focus(), 0);
  }
}
