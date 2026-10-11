// Bien-être › « Habitudes » : mes petits gestes réguliers, que je définis moi-même.
// Elles apparaissent dans Aujourd'hui. Ici : les créer, les modifier, voir ma semaine.
// Ton volontairement doux : on montre ce qui est fait, jamais ce qui manque.

import { h, vider, ouvrirModale, confirmer, notifier, pastilles } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur } from '../registry.js';
import { aujourdhui, lundiDe, JOURS } from '../dates.js';
import * as B from './bien-etre-donnees.js';

function decrireJours(jours) {
  if (!jours || jours.length === 0 || jours.length === 7) return 'Chaque jour';
  const noms = JOURS.filter((j) => jours.includes(j.dow)).map((j) => j.long);
  return noms.length === 1 ? `Chaque ${noms[0]}` : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

export function ouvrirHabitude({ id = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.bienEtre.habitudes.find((x) => x.id === id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? "Modifier l'habitude" : 'Nouvelle habitude',
    couleur: 'turquoise',
    corps: (fermer) => {
      const jours = new Set(existante?.jours || []);
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: existante?.titre || '', placeholder: "Ex. Boire un grand verre d'eau", maxLength: 120, 'aria-label': "Nom de l'habitude" });
      const zoneJours = h(
        'div',
        { class: 'puces puces-jours', role: 'group', 'aria-label': 'Jours de la semaine' },
        JOURS.map((j) =>
          h(
            'label',
            { class: 'puce puce-jour', title: j.long },
            h('input', {
              type: 'checkbox',
              checked: jours.has(j.dow),
              'aria-label': j.long,
              onchange: (e) => (e.target.checked ? jours.add(j.dow) : jours.delete(j.dow)),
            }),
            h('span', null, j.court)
          )
        )
      );

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!titre.value.trim()) {
              titre.classList.add('champ-erreur');
              titre.focus();
              return;
            }
            const valeurs = { titre: titre.value, jours: [...jours] };
            if (existante) store.modifier((d) => B.modifierHabitude(d, existante.id, valeurs));
            else store.modifier((d) => B.ajouterHabitude(d, { ...valeurs, debut: aujourdhui() }));
            fermer();
            if (!existante) notifier("Habitude créée ✦ Elle apparaît dans Aujourd'hui.");
          },
        },
        titre,
        h('div', { class: 'pile pile-serre' }, h('span', { class: 'etiquette' }, 'Quels jours ? (aucun coché = chaque jour)'), zoneJours),
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: async () => {
                  const ok = await confirmer({
                    titre: 'Supprimer cette habitude ?',
                    message: `« ${existante.titre} » et son historique seront supprimés. Si tu veux seulement la mettre de côté, utilise plutôt « Mettre en pause ».`,
                    oui: 'Supprimer',
                    non: 'Garder',
                  });
                  if (ok) {
                    store.modifier((d) => B.supprimerHabitude(d, existante.id));
                    fermer();
                  }
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => titre.focus(), 0);
      return formulaire;
    },
  });
}

enregistrerEditeur('habitude', (item) => ouvrirHabitude({ id: item.id }));

function ligneHabitude(h_, donnees, lundi) {
  const semaine = B.semaineHabitude(donnees, h_, lundi);
  const prevues = semaine.filter((j) => j.prevue).length;
  const faites = semaine.filter((j) => j.faite).length;
  return h(
    'li',
    { class: 'ligne ligne-habitude' + (h_.archivee ? ' archivee' : '') },
    h(
      'div',
      { class: 'ligne-bloc' },
      h('strong', null, h_.titre),
      h('span', { class: 'meta' }, h_.archivee ? 'En pause' : decrireJours(h_.jours))
    ),
    !h_.archivee &&
      h(
        'div',
        { class: 'semaine-points', role: 'img', 'aria-label': `${faites} fois cette semaine${prevues ? ` sur ${prevues} prévues` : ''}` },
        semaine.map((j) =>
          h('span', { class: 'point-jour' + (j.faite ? ' fait' : j.prevue ? ' prevu' : ''), title: j.date })
        )
      ),
    !h_.archivee && h('span', { class: 'mono' }, `${faites}${prevues ? `/${prevues}` : ''}`),
    h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier', 'aria-label': `Modifier « ${h_.titre} »`, onclick: () => ouvrirHabitude({ id: h_.id }) }, '✎'),
    h(
      'button',
      {
        class: 'bouton bouton-petit',
        type: 'button',
        onclick: () => store.modifier((d) => B.archiverHabitude(d, h_.id, !h_.archivee)),
      },
      h_.archivee ? 'Reprendre' : 'Mettre en pause'
    )
  );
}

export function rendreHabitudes(conteneur) {
  const donnees = store.lire();
  const lundi = lundiDe(aujourdhui());
  const actives = donnees.bienEtre.habitudes.filter((x) => !x.archivee);
  const enPause = donnees.bienEtre.habitudes.filter((x) => x.archivee);

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, 'Mes habitudes'),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirHabitude({}) }, '＋ Habitude')
        ),
        actives.length
          ? h('ul', { class: 'fenetre-corps liste' }, actives.map((x) => ligneHabitude(x, donnees, lundi)))
          : h(
              'div',
              { class: 'fenetre-corps pile' },
              h('p', null, "Une habitude, c'est un petit geste qui te fait du bien : un verre d'eau, quelques étirements, trois respirations… Tu choisis les jours, elles apparaîtront dans Aujourd'hui."),
              h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirHabitude({}) }, '＋ Créer ma première habitude'))
            )
      ),
      actives.length > 0 && h('p', { class: 'doux' }, 'Les points montrent ta semaine : plein = fait, cerclé = prévu. Chaque geste compte, même un seul.'),
      enPause.length > 0 &&
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--creme-fonce)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'En pause')),
          h('ul', { class: 'fenetre-corps liste' }, enPause.map((x) => ligneHabitude(x, donnees, lundi)))
        )
    )
  );
}
