// Corps › « Courbe de poids » : suivi optionnel du poids et des mensurations.
// Affiché en tendance par semaine, de façon neutre : pas d'objectif, pas de couleur
// « bien / pas bien », et jamais sur l'accueil.

import { h, vider, ouvrirModale, confirmer, notifier, pastilles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, formatCourt, formatJourMois } from '../dates.js';
import * as C from './carnet-donnees.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Une petite courbe, sans axes ni objectifs : juste la forme de la tendance.
function courbe(points) {
  const largeur = 220;
  const hauteur = 56;
  const marge = 6;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${largeur} ${hauteur}`);
  svg.setAttribute('class', 'courbe');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Tendance par semaine');
  if (points.length < 2) return svg;

  const valeurs = points.map((p) => p.valeur);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const ecart = max - min || 1;
  const coord = points.map((p, i) => [
    marge + (i * (largeur - 2 * marge)) / (points.length - 1),
    hauteur - marge - ((p.valeur - min) / ecart) * (hauteur - 2 * marge),
  ]);

  const ligne = document.createElementNS(SVG_NS, 'polyline');
  ligne.setAttribute('points', coord.map((c) => c.join(',')).join(' '));
  svg.append(ligne);
  for (const [x, y] of coord) {
    const point = document.createElementNS(SVG_NS, 'circle');
    point.setAttribute('cx', x);
    point.setAttribute('cy', y);
    point.setAttribute('r', 3.5);
    svg.append(point);
  }
  return svg;
}

// ---- Saisir / modifier une mesure ----

function ouvrirMesure({ id = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.carnet.corps.mesures.find((m) => m.id === id) : null;
  if (id && !existante) return;
  const champs = donnees.carnet.corps.champs.filter((c) => c.suivi || existante?.valeurs[c.id] != null);

  ouvrirModale({
    titre: existante ? 'Modifier la mesure' : 'Nouvelle mesure',
    couleur: 'orange',
    corps: (fermer) => {
      const date = h('input', { type: 'date', class: 'champ', value: existante?.date || aujourdhui(), required: true, id: 'mesure-date' });
      const saisies = new Map();
      const lignes = champs.map((c) => {
        const champ = h('input', {
          type: 'text',
          inputmode: 'decimal',
          class: 'champ champ-court',
          id: `mesure-${c.id}`,
          value: existante?.valeurs[c.id] != null ? String(existante.valeurs[c.id]).replace('.', ',') : '',
          placeholder: '—',
        });
        saisies.set(c.id, champ);
        return h('div', { class: 'rangee-champ ligne-mesure' }, h('label', { class: 'etiquette', for: `mesure-${c.id}` }, c.nom), champ, c.unite && h('span', { class: 'meta' }, c.unite));
      });

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const valeurs = Object.fromEntries([...saisies].map(([cle, champ]) => [cle, champ.value]));
            const quelqueChose = Object.values(valeurs).some((v) => C.lireNombre(v) !== null);
            if (!quelqueChose) {
              notifier('Remplis au moins une mesure.');
              return;
            }
            if (existante) store.modifier((d) => C.modifierMesure(d, existante.id, { date: date.value, valeurs }));
            else store.modifier((d) => C.ajouterMesure(d, { date: date.value, valeurs }));
            fermer();
            if (!existante) notifier('Mesure enregistrée ✦');
          },
        },
        h('p', { class: 'doux' }, 'Remplis seulement ce que tu veux. Les virgules sont acceptées.'),
        h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'mesure-date' }, 'Le'), date),
        ...lignes,
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
                  store.modifier((d) => (retire = C.supprimerMesure(d, existante.id)));
                  fermer();
                  if (retire) notifier('Mesure supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => C.restaurerMesure(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      return formulaire;
    },
  });
}

function ouvrirChampPerso() {
  ouvrirModale({
    titre: 'Ajouter une mesure',
    couleur: 'orange',
    corps: (fermer) => {
      const nom = h('input', { type: 'text', class: 'champ', placeholder: 'Ex. Tour de mollet', maxLength: 40, 'aria-label': 'Nom' });
      const unite = h('input', { type: 'text', class: 'champ champ-court', placeholder: 'cm', maxLength: 10, 'aria-label': 'Unité' });
      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!nom.value.trim()) {
              nom.classList.add('champ-erreur');
              nom.focus();
              return;
            }
            store.modifier((d) => C.ajouterChamp(d, { nom: nom.value, unite: unite.value }));
            fermer();
          },
        },
        h('div', { class: 'rangee' }, nom, unite),
        h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'), h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Ajouter'))
      );
      setTimeout(() => nom.focus(), 0);
      return formulaire;
    },
  });
}

// ---- Page ----

export function rendreCorps(conteneur) {
  const donnees = store.lire();
  const corps = donnees.carnet.corps;
  vider(conteneur);

  if (!corps.actif) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--orange)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ma courbe de poids (facultative)')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, "Si tu en as envie, tu peux noter ton poids et tes mensurations, et suivre leur évolution semaine après semaine. C'est entièrement facultatif."),
          h('ul', { class: 'liste-puces' }, h('li', null, "Rien de tout ça n'apparaît jamais sur ton accueil."), h('li', null, "Pas d'objectif, pas de jugement : juste une tendance, à ton rythme."), h('li', null, 'Tu peux le désactiver quand tu veux, tes données restent.')),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => store.modifier((d) => C.definirSuiviCorps(d, true)) }, 'Activer ma courbe de poids'))
        )
      )
    );
    return;
  }

  const suivis = corps.champs.filter((c) => c.suivi);
  const mesures = [...corps.mesures].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const reel = aujourdhui();

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'barre-actions' },
        h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirMesure({}) }, '＋ Nouvelle mesure'),
        h('p', { class: 'doux' }, "Visible ici seulement : jamais sur l'accueil.")
      ),

      // Tendances
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--orange)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Tendance par semaine')),
        corps.mesures.length === 0
          ? h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Ajoute une première mesure pour voir apparaître ta tendance.'))
          : h(
              'div',
              { class: 'fenetre-corps grille-tendances' },
              suivis.map((c) => {
                const points = C.tendanceHebdo(donnees, c.id, { semaines: 12, aujourdhuiCle: reel });
                if (!points.length) return null;
                const derniers = points.slice(-4).reverse();
                return h(
                  'article',
                  { class: 'tendance' },
                  h('h3', null, c.nom),
                  courbe(points),
                  h(
                    'ul',
                    { class: 'liste-simple tendance-liste' },
                    derniers.map((p) => h('li', { class: 'rangee' }, h('span', { class: 'meta mono ligne-bloc' }, `semaine du ${formatJourMois(p.lundi)}`), h('span', { class: 'mono' }, C.formaterMesure(p.valeur, c.unite))))
                  )
                );
              })
            )
      ),

      // Mesures enregistrées
      mesures.length > 0 &&
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--creme-fonce)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes mesures')),
          h(
            'ul',
            { class: 'fenetre-corps liste' },
            mesures.slice(0, 20).map((m) =>
              h(
                'li',
                { class: 'ligne ligne-simple' },
                h('span', { class: 'rdv-heure mono' }, formatCourt(m.date)),
                h(
                  'span',
                  { class: 'ligne-bloc' },
                  corps.champs
                    .filter((c) => m.valeurs[c.id] != null)
                    .map((c) => `${c.nom} ${C.formaterMesure(m.valeurs[c.id], c.unite)}`)
                    .join(' · ')
                ),
                h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier', 'aria-label': `Modifier la mesure du ${m.date}`, onclick: () => ouvrirMesure({ id: m.id }) }, '✎')
              )
            )
          )
        ),

      // Réglages
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--ciel)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ce que je suis')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h(
            'div',
            { class: 'puces' },
            corps.champs.map((c) =>
              h(
                'label',
                { class: 'puce', style: '--cat: var(--orange)' },
                h('input', { type: 'checkbox', checked: c.suivi, onchange: (e) => store.modifier((d) => C.definirChampSuivi(d, c.id, e.target.checked)) }),
                h('span', null, c.nom)
              )
            )
          ),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ouvrirChampPerso }, '＋ Ajouter une mesure'),
            h(
              'button',
              {
                class: 'bouton bouton-petit',
                type: 'button',
                onclick: async () => {
                  const ok = await confirmer({
                    titre: 'Désactiver la courbe de poids ?',
                    message: 'Il disparaît de cette page. Tes mesures sont conservées : tu les retrouveras si tu le réactives.',
                    oui: 'Désactiver',
                    non: 'Garder',
                    couleur: 'jaune',
                  });
                  if (ok) store.modifier((d) => C.definirSuiviCorps(d, false));
                },
              },
              'Désactiver la courbe'
            )
          )
        )
      )
    )
  );
}
