// Maison › « Ménage et entretien » : mes zones, mes tâches à rythme souple.
// Pensé pour rester léger à l'œil : d'abord « pour aujourd'hui » et des zones à ouvrir une par une.
// Ton : on montre ce qui revient bientôt ; jamais de « retard ».

import { h, vider, pastilles, notifier, etincelles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours } from '../dates.js';
import * as M from './maison-donnees.js';
import { ouvrirTacheMaison, ouvrirZone, ouvrirModeles } from './ui-maison.js';

// La zone dont on regarde le détail (null : on voit toutes les zones).
let zoneOuverte = null;

function boutonFait(t, donnees) {
  const aujourdhuiCle = aujourdhui();
  if (M.estFait(donnees, t.id, aujourdhuiCle)) {
    return h('button', { class: 'bouton bouton-petit', type: 'button', title: 'Annuler', onclick: () => store.modifier((d) => M.annulerFait(d, t.id, aujourdhuiCle)) }, '✓ Fait');
  }
  return h(
    'button',
    {
      class: 'bouton bouton-petit bouton-turquoise',
      type: 'button',
      onclick: (e) => {
        etincelles(e.currentTarget);
        store.modifier((d) => M.marquerFait(d, t.id, aujourdhuiCle));
      },
    },
    'Fait ✓'
  );
}

function boutonPlusTard(t) {
  return h(
    'button',
    {
      class: 'bouton bouton-petit',
      type: 'button',
      title: 'Ne pas la proposer pendant une semaine',
      onclick: () => {
        store.modifier((d) => M.repousser(d, t.id, ajouterJours(aujourdhui(), 7)));
        notifier('Pas de souci : elle revient dans une semaine.');
      },
    },
    'Plus tard'
  );
}

// Le titre est cliquable : il ouvre la tâche (rythme, durée, suppression…).
function titreCliquable(t) {
  return h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier cette tâche', onclick: () => ouvrirTacheMaison({ id: t.id }) }, t.titre);
}

// ---- Pour aujourd'hui ----

function blocAujourdhui(donnees, aujourdhuiCle) {
  const du_jour = M.selectionDuJour(donnees, aujourdhuiCle);
  const map = M.derniereFoisMap(donnees);
  return h(
    'section',
    { class: 'fenetre', style: '--cat: var(--jaune)' },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, "Pour aujourd'hui")),
    du_jour.length === 0
      ? h('div', { class: 'fenetre-corps' }, h('p', { class: 'doux' }, "Rien de prévu aujourd'hui. Profites-en ✦"))
      : h(
          'ul',
          { class: 'fenetre-corps liste' },
          du_jour.map((t) => {
            const zone = M.zoneParId(donnees, t.zoneId);
            const etat = M.etatTache(t, aujourdhuiCle, map.get(t.id) || null);
            const fait = M.estFait(donnees, t.id, aujourdhuiCle);
            return h(
              'li',
              { class: 'ligne ligne-tache-maison' },
              h(
                'div',
                { class: 'ligne-bloc' },
                titreCliquable(t),
                h('span', { class: 'meta' }, `${zone.icone} ${zone.nom}${t.dureeMin ? ` · ${t.dureeMin} min` : ''}`)
              ),
              h('div', { class: 'actions-ligne' }, boutonFait(t, donnees), etat.due && !fait && boutonPlusTard(t))
            );
          })
        )
  );
}

// ---- Toutes les zones ----

function carteZone(z, donnees, map, aujourdhuiCle, ctx) {
  const taches = donnees.maison.taches.filter((t) => t.zoneId === z.id && !t.archivee);
  const bientot = taches.filter((t) => M.etatTache(t, aujourdhuiCle, map.get(t.id) || null).due).length;
  return h(
    'button',
    {
      class: 'carte-zone' + (bientot ? ' a-faire' : ''),
      type: 'button',
      onclick: () => {
        zoneOuverte = z.id;
        ctx.redessiner();
      },
    },
    h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, z.icone),
    h(
      'span',
      { class: 'carte-zone-texte' },
      h('strong', null, z.nom),
      h('span', { class: 'meta' }, taches.length === 0 ? 'Aucune tâche' : `${taches.length} tâche${taches.length > 1 ? 's' : ''}${bientot ? ` · ${bientot} bientôt` : ''}`)
    )
  );
}

function rendreAccueil(conteneur, ctx, donnees, aujourdhuiCle) {
  const { zones } = donnees.maison;
  const map = M.derniereFoisMap(donnees);
  const parJour = donnees.maison.parJour ?? 2;

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      blocAujourdhui(donnees, aujourdhuiCle),
      h(
        'div',
        { class: 'pile' },
        h('h2', { class: 'titre-section' }, 'Mes zones'),
        h('div', { class: 'grille-zones' }, zones.map((z) => carteZone(z, donnees, map, aujourdhuiCle, ctx)))
      ),
      h(
        'div',
        { class: 'barre-discrete' },
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirTacheMaison({}) }, '＋ Tâche'),
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirZone({}) }, '＋ Zone'),
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ouvrirModeles }, '💡 Des idées'),
        h(
          'label',
          { class: 'reglage-discret' },
          h('span', null, 'Proposées chaque jour :'),
          h(
            'select',
            { class: 'champ', onchange: (e) => store.modifier((d) => (d.maison.parJour = Number(e.target.value))) },
            [1, 2, 3, 4, 5].map((n) => h('option', { value: String(n), selected: n === parJour }, String(n)))
          )
        )
      )
    )
  );
}

// ---- Le détail d'une zone ----

function rendreZone(conteneur, ctx, donnees, aujourdhuiCle, z) {
  const map = M.derniereFoisMap(donnees);
  const lignes = donnees.maison.taches
    .filter((t) => t.zoneId === z.id && !t.archivee)
    .map((t) => ({ t, etat: M.etatTache(t, aujourdhuiCle, map.get(t.id) || null) }))
    // Ce qui revient bientôt d'abord, puis le reste par ordre d'échéance.
    .sort((a, b) => (b.etat.due - a.etat.due) || (a.etat.joursAvant - b.etat.joursAvant));

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
              zoneOuverte = null;
              ctx.redessiner();
            },
          },
          '← Toutes les zones'
        )
      ),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, `${z.icone} ${z.nom}`),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Ajouter une tâche ici', 'aria-label': `Ajouter une tâche dans ${z.nom}`, onclick: () => ouvrirTacheMaison({ zoneId: z.id }) }, '＋'),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier la zone', 'aria-label': `Modifier la zone ${z.nom}`, onclick: () => ouvrirZone({ id: z.id }) }, '✎')
        ),
        lignes.length
          ? h(
              'ul',
              { class: 'fenetre-corps liste' },
              lignes.map(({ t, etat }) =>
                h(
                  'li',
                  { class: 'ligne ligne-tache-maison' + (etat.due ? ' a-faire' : '') },
                  h('div', { class: 'ligne-bloc' }, titreCliquable(t), h('span', { class: 'meta' }, M.texteCourt(etat))),
                  h('div', { class: 'actions-ligne' }, boutonFait(t, donnees))
                )
              )
            )
          : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Pas encore de tâche ici.'))
      )
    )
  );
}

// ---- La page ----

export function rendreMenage(conteneur, ctx) {
  const donnees = store.lire();
  const { zones, taches } = donnees.maison;
  const aujourdhuiCle = aujourdhui();
  vider(conteneur);

  if (zones.length === 0 && taches.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ménage et entretien, à ton rythme')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, "Tes tâches reviennent d'elles-mêmes, un certain temps après la dernière fois. Chaque jour, tu n'en vois que 2 petites, jamais « en retard »."),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: ouvrirModeles }, "💡 Partir d'idées"),
            h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirZone({}) }, '＋ Créer ma première zone')
          )
        )
      )
    );
    return;
  }

  const zone = zoneOuverte ? M.zoneParId(donnees, zoneOuverte) : null;
  if (!zone) zoneOuverte = null;
  if (zone) rendreZone(conteneur, ctx, donnees, aujourdhuiCle, zone);
  else rendreAccueil(conteneur, ctx, donnees, aujourdhuiCle);
}
