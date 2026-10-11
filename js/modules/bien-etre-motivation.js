// Bien-être › « Motivation » : mon « pourquoi », mes phrases et mes citations.
// Une d'entre elles s'affiche chaque jour sur l'accueil.

import { h, vider, ouvrirModale, notifier, pastilles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as B from './bien-etre-donnees.js';

function ouvrirPhrase({ id = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.motivation.phrases.find((p) => p.id === id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? 'Modifier la phrase' : 'Nouvelle phrase',
    couleur: 'jaune',
    corps: (fermer) => {
      const texte = h('textarea', { class: 'champ champ-note', rows: 3, placeholder: 'Une phrase qui te porte…', 'aria-label': 'Texte' }, existante?.texte || '');
      const auteur = h('input', { type: 'text', class: 'champ', value: existante?.auteur || '', placeholder: 'Auteur·rice (facultatif)', maxLength: 100, 'aria-label': 'Auteur' });
      const type = h(
        'select',
        { class: 'champ', 'aria-label': 'Type' },
        h('option', { value: 'phrase', selected: (existante?.type || 'phrase') === 'phrase' }, 'Une phrase à moi'),
        h('option', { value: 'citation', selected: existante?.type === 'citation' }, "Une citation d'une autre personne")
      );
      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!texte.value.trim()) {
              texte.classList.add('champ-erreur');
              texte.focus();
              return;
            }
            const valeurs = { texte: texte.value, auteur: auteur.value, type: type.value };
            if (existante) store.modifier((d) => B.modifierPhrase(d, existante.id, valeurs));
            else store.modifier((d) => B.ajouterPhrase(d, valeurs));
            fermer();
          },
        },
        texte,
        h('div', { class: 'rangee rangee-souple' }, type, auteur),
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = B.supprimerPhrase(d, existante.id)));
                  fermer();
                  if (retire) notifier('Phrase supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => B.restaurerPhrase(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => texte.focus(), 0);
      return formulaire;
    },
  });
}

export function rendreMotivation(conteneur) {
  const donnees = store.lire();
  const { phrases } = donnees.motivation;
  const phrase = B.phraseDuJour(donnees, aujourdhui());

  const pourquoi = h('textarea', {
    class: 'champ champ-note',
    rows: 4,
    placeholder: 'Pourquoi je fais tout ça ? Ce qui compte vraiment pour moi…',
    id: 'pourquoi',
    'aria-label': 'Mon pourquoi',
  }, donnees.motivation.pourquoi);

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },

      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mon pourquoi')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', { class: 'doux' }, "Quelques lignes pour te rappeler ce qui te porte, les jours où c'est moins facile."),
          pourquoi,
          h(
            'div',
            { class: 'rangee droite' },
            h(
              'button',
              {
                class: 'bouton bouton-jaune',
                type: 'button',
                onclick: () => {
                  store.modifier((d) => B.definirPourquoi(d, pourquoi.value));
                  notifier('Enregistré ✦');
                },
              },
              'Enregistrer'
            )
          )
        )
      ),

      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--rose)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, 'Mes phrases et citations'),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirPhrase({}) }, '＋ Phrase')
        ),
        phrases.length
          ? h(
              'ul',
              { class: 'fenetre-corps liste' },
              phrases.map((p) =>
                h(
                  'li',
                  { class: 'ligne ligne-simple' },
                  h(
                    'div',
                    { class: 'ligne-bloc' },
                    h('span', null, p.texte),
                    h('span', { class: 'meta' }, [p.type === 'citation' ? 'Citation' : 'Ma phrase', p.auteur ? ` · ${p.auteur}` : ''].join(''))
                  ),
                  h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier', 'aria-label': 'Modifier cette phrase', onclick: () => ouvrirPhrase({ id: p.id }) }, '✎')
                )
              )
            )
          : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, "Ajoute des phrases qui te font du bien : les tiennes, ou celles d'autres personnes."))
      ),

      phrase &&
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--turquoise)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, "Sur ton accueil aujourd'hui")),
          h('div', { class: 'fenetre-corps' }, h('blockquote', { class: 'citation' }, h('p', null, phrase.texte), phrase.auteur && h('footer', { class: 'mono' }, `— ${phrase.auteur}`)))
        )
    )
  );
}
