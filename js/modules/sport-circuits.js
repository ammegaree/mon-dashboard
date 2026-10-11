// Sport › « Circuits » : mes circuits personnalisés, rangés par catégorie de sport (type de séance).
// C'est aussi ici qu'on gère les catégories de sport (yoga, course, renforcement…) :
// « ＋ Catégorie » pour en créer, ✎ dans une catégorie pour la modifier.
// Même style que le reste : des cartes qu'on ouvre une par une, une action par ligne.

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import * as S from './sport-donnees.js';
import { ouvrirCircuit, faireCircuit } from './ui-circuits.js';
import { ouvrirSeance, ouvrirType } from './ui-sport.js';

const SANS = '__sans';
let categorieOuverte = null; // null : toutes les catégories ; sinon l'id du type (ou SANS)

function ligneCircuit(c) {
  const n = c.exercices.length;
  return h(
    'li',
    { class: 'ligne ligne-tache-maison' },
    h(
      'div',
      { class: 'ligne-bloc' },
      h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier ce circuit', onclick: () => ouvrirCircuit({ id: c.id }) }, c.nom),
      h('span', { class: 'meta' }, n === 0 ? 'pas encore d’exercice' : `${n} exercice${n > 1 ? 's' : ''}${c.note ? ` · ${c.note}` : ''}`)
    ),
    h(
      'div',
      { class: 'actions-ligne' },
      n > 0 &&
        h(
          'button',
          {
            class: 'bouton bouton-petit bouton-turquoise',
            type: 'button',
            onclick: () =>
              faireCircuit({
                id: c.id,
                surTermine: (circuit) => ouvrirSeance({ typeId: circuit.typeId, circuitId: circuit.id }),
              }),
          },
          'Démarrer ▶'
        )
    )
  );
}

export function rendreCircuits(conteneur, ctx) {
  const donnees = store.lire();
  const { types, circuits } = donnees.sport;
  const sans = S.circuitsDuType(donnees, null);
  vider(conteneur);

  // Rien encore : une phrase, et des idées de catégories à ajouter d'un clic.
  if (types.length === 0 && circuits.length === 0) {
    const existants = new Set(types.map((t) => t.nom.toLowerCase()));
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--corail)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes circuits 🔁')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, 'Choisis les sports que tu pratiques : ce sont tes catégories. Dans chacune, tu pourras composer tes circuits (une suite d’exercices avec séries, répétitions et repos).'),
          h(
            'div',
            { class: 'puces' },
            S.SUGGESTIONS_TYPES.filter((s) => !existants.has(s.nom.toLowerCase())).map((s) =>
              h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => store.modifier((d) => S.ajouterType(d, s)) }, `${s.icone} ${s.nom}`)
            )
          ),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirType({}) }, '＋ Créer ma propre catégorie'))
        )
      )
    );
    return;
  }

  const lesCategories = [...types.map((t) => ({ id: t.id, nom: t.nom, icone: t.icone })), ...(sans.length ? [{ id: SANS, nom: 'Sans catégorie', icone: '🔁' }] : [])];
  const courante = lesCategories.find((c) => c.id === categorieOuverte) || null;
  if (!courante) categorieOuverte = null;

  if (courante) {
    const liste = S.circuitsDuType(donnees, courante.id === SANS ? null : courante.id);
    conteneur.append(
      h(
        'div',
        { class: 'pile pile-large' },
        h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { categorieOuverte = null; ctx.redessiner(); } }, '← Toutes les catégories')),
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--corail)' },
          h(
            'div',
            { class: 'fenetre-barre' },
            pastilles(),
            h('h2', { class: 'fenetre-titre' }, `${courante.icone} ${courante.nom}`),
            h('button', { class: 'bouton-icone', type: 'button', title: 'Nouveau circuit', 'aria-label': `Nouveau circuit en ${courante.nom}`, onclick: () => ouvrirCircuit({ typeId: courante.id === SANS ? null : courante.id }) }, '＋'),
            courante.id !== SANS &&
              h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier cette catégorie', 'aria-label': `Modifier la catégorie ${courante.nom}`, onclick: () => ouvrirType({ id: courante.id }) }, '✎')
          ),
          liste.length
            ? h('ul', { class: 'fenetre-corps liste' }, liste.map(ligneCircuit))
            : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Pas encore de circuit ici : crée le premier avec le ＋.'))
        )
      )
    );
    return;
  }

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h('h2', { class: 'titre-section' }, 'Mes circuits par catégorie'),
      h(
        'div',
        { class: 'grille-zones' },
        lesCategories.map((c) => {
          const n = S.circuitsDuType(donnees, c.id === SANS ? null : c.id).length;
          return h(
            'button',
            {
              class: 'carte-zone',
              type: 'button',
              onclick: () => {
                categorieOuverte = c.id;
                ctx.redessiner();
              },
            },
            h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, c.icone),
            h('span', { class: 'carte-zone-texte' }, h('strong', null, c.nom), h('span', { class: 'meta' }, n === 0 ? 'aucun circuit' : `${n} circuit${n > 1 ? 's' : ''}`))
          );
        })
      ),
      h(
        'div',
        { class: 'barre-discrete' },
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirCircuit({}) }, '＋ Circuit'),
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirType({}) }, '＋ Catégorie')
      )
    )
  );
}

// Quand on vient d'ailleurs (un lien « Circuits »), on repart de toutes les catégories.
export function reinitialiserCircuits() {
  categorieOuverte = null;
}
