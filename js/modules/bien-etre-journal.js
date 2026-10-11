// Bien-être › « Journal » : des entrées libres, datées, avec une question d'amorce facultative.

import { h, vider, ouvrirModale, notifier, pastilles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, formatLong } from '../dates.js';
import * as B from './bien-etre-donnees.js';

let recherche = '';

// `texte` : un texte de départ (idée du brain dump) ; `surEnregistrement` : appelé une fois l'entrée enregistrée.
export function ouvrirEntree({ id = null, date = aujourdhui(), texte: texteInitial = '', surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.bienEtre.journal.find((e) => e.id === id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? "Modifier l'entrée" : 'Écrire dans mon journal',
    couleur: 'rose',
    large: true,
    corps: (fermer) => {
      const amorces = [...B.AMORCES];
      if (existante?.amorce && !amorces.includes(existante.amorce)) amorces.unshift(existante.amorce);

      const choixAmorce = h(
        'select',
        { class: 'champ', id: 'journal-amorce', 'aria-label': "Question d'amorce" },
        h('option', { value: '' }, 'Écrire librement'),
        amorces.map((a) => h('option', { value: a, selected: a === existante?.amorce }, a))
      );
      choixAmorce.value = existante?.amorce || '';
      const surprise = h(
        'button',
        {
          class: 'bouton bouton-petit',
          type: 'button',
          onclick: () => {
            choixAmorce.value = B.AMORCES[Math.floor(Math.random() * B.AMORCES.length)];
            texte.focus();
          },
        },
        '🎲 Surprends-moi'
      );
      const champDate = h('input', { type: 'date', class: 'champ', value: existante?.date || date, required: true, id: 'journal-date' });
      const texte = h('textarea', { class: 'champ champ-note', rows: 10, placeholder: 'Écris ce qui vient, sans te relire…', id: 'journal-texte', 'aria-label': 'Mon texte' }, existante?.texte || texteInitial);

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
            const valeurs = { date: champDate.value, amorce: choixAmorce.value, texte: texte.value };
            if (existante) store.modifier((d) => B.modifierEntree(d, existante.id, valeurs));
            else store.modifier((d) => B.ajouterEntree(d, valeurs));
            surEnregistrement?.();
            fermer();
            if (!existante) notifier('Entrée enregistrée ✦');
          },
        },
        h('div', { class: 'rangee rangee-souple' }, h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'journal-date' }, 'Le'), champDate)),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'journal-amorce' }, "Une question pour m'aider (facultatif)"), h('div', { class: 'rangee' }, choixAmorce, surprise)),
        texte,
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
                  store.modifier((d) => (retire = B.supprimerEntree(d, existante.id)));
                  fermer();
                  if (retire) {
                    notifier('Entrée supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => B.restaurerEntree(d, retire)) } });
                  }
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

function carteEntree(e) {
  return h(
    'section',
    { class: 'fenetre carte-note', style: '--cat: var(--rose)' },
    h(
      'div',
      { class: 'fenetre-barre' },
      pastilles(),
      h('h2', { class: 'fenetre-titre' }, formatLong(e.date)),
      h('button', { class: 'bouton-icone', type: 'button', title: "Modifier cette entrée", 'aria-label': `Modifier l'entrée du ${formatLong(e.date)}`, onclick: () => ouvrirEntree({ id: e.id }) }, '✎')
    ),
    h(
      'div',
      { class: 'fenetre-corps pile' },
      e.amorce && h('p', { class: 'amorce' }, e.amorce),
      h('div', { class: 'note-texte' }, e.texte)
    )
  );
}

export function rendreJournal(conteneur) {
  const donnees = store.lire();
  const toutes = donnees.bienEtre.journal;

  const zoneListe = h('div', { class: 'pile pile-large' });
  const dessinerListe = () => {
    const entrees = B.chercherEntrees(donnees, recherche);
    vider(zoneListe);
    if (entrees.length === 0) zoneListe.append(h('p', { class: 'vide' }, 'Aucune entrée ne correspond à cette recherche.'));
    else zoneListe.append(...entrees.map(carteEntree));
  };

  vider(conteneur);
  if (toutes.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mon journal')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, "Un espace rien qu'à toi : écris librement, ou laisse-toi guider par une petite question. Pas de bonne ou de mauvaise façon de faire."),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirEntree({}) }, '✎ Écrire ma première entrée'))
        )
      )
    );
    return;
  }

  dessinerListe();
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'barre-actions' },
        h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirEntree({}) }, '✎ Écrire'),
        h('input', {
          type: 'search',
          class: 'champ champ-recherche',
          placeholder: 'Chercher dans mon journal…',
          value: recherche,
          'aria-label': 'Chercher dans mon journal',
          oninput: (ev) => {
            recherche = ev.target.value;
            dessinerListe();
          },
        })
      ),
      zoneListe
    )
  );
}
