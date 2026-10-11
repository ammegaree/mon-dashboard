// Maison › « Plantes » : mes plantes du balcon et leurs soins, à rythme d'été et d'hiver.
// Même style que le ménage : « pour aujourd'hui », des cartes qu'on ouvre une par une, une action par ligne.

import { h, vider, pastilles, notifier, etincelles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours } from '../dates.js';
import * as P from './plantes-donnees.js';
import { ouvrirPlante, ouvrirSoin, ouvrirSaisons, ouvrirIdeesPlantes, ouvrirSoinsDuJour } from './ui-plantes.js';

// La plante dont on voit les soins (null : toutes les plantes).
let planteOuverte = null;

function boutonFait(soin) {
  const jour = aujourdhui();
  if (P.soinFait(store.lire(), soin.id, jour)) {
    return h('button', { class: 'bouton bouton-petit', type: 'button', title: 'Annuler', onclick: () => store.modifier((d) => P.annulerSoinFait(d, soin.id, jour)) }, '✓ Fait');
  }
  return h(
    'button',
    {
      class: 'bouton bouton-petit bouton-turquoise',
      type: 'button',
      onclick: (e) => {
        etincelles(e.currentTarget);
        store.modifier((d) => P.marquerSoinFait(d, soin.id, jour));
      },
    },
    'Fait ✓'
  );
}

// ---- Pour aujourd'hui : une ligne par sorte de soin ----

function blocAujourdhui(donnees, jour) {
  const groupes = P.TYPES_SOIN.map((t) => ({ t, liste: P.soinsDuJour(donnees, t.id, jour) })).filter((g) => g.liste.length > 0);
  return h(
    'section',
    { class: 'fenetre', style: '--cat: var(--jaune)' },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, "Pour aujourd'hui")),
    groupes.length === 0
      ? h('div', { class: 'fenetre-corps' }, h('p', { class: 'doux' }, 'Tes plantes vont bien : rien à faire aujourd’hui 🌿'))
      : h(
          'ul',
          { class: 'fenetre-corps liste' },
          groupes.map(({ t, liste }) => {
            const toutFait = liste.every((x) => x.fait);
            return h(
              'li',
              { class: 'ligne ligne-tache-maison' + (toutFait ? ' fait' : '') },
              h(
                'div',
                { class: 'ligne-bloc' },
                h('button', { class: 'titre-cliquable', type: 'button', title: 'Voir plante par plante', onclick: () => ouvrirSoinsDuJour({ type: t.id, date: jour }) }, `${t.icone} ${t.verbe}`),
                h('span', { class: 'meta' }, liste.map((x) => x.plante.nom).join(', '))
              ),
              h(
                'div',
                { class: 'actions-ligne' },
                h(
                  'button',
                  {
                    class: 'bouton bouton-petit' + (toutFait ? '' : ' bouton-turquoise'),
                    type: 'button',
                    onclick: (e) => {
                      if (!toutFait) etincelles(e.currentTarget);
                      store.modifier((d) => P.cocherGroupe(d, t.id, jour));
                    },
                  },
                  toutFait ? '✓ Fait' : liste.length > 1 ? 'Tout est fait ✓' : 'Fait ✓'
                )
              )
            );
          })
        )
  );
}

// ---- Mes plantes ----

function cartePlante(p, donnees, jour, ctx) {
  const map = P.derniereFoisSoins(donnees);
  const bientot = p.soins.filter((s) => P.etatSoin(donnees, s, jour, map.get(s.id) || null).due).length;
  return h(
    'button',
    {
      class: 'carte-zone' + (bientot ? ' a-faire' : ''),
      type: 'button',
      onclick: () => {
        planteOuverte = p.id;
        ctx.redessiner();
      },
    },
    h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, p.icone),
    h(
      'span',
      { class: 'carte-zone-texte' },
      h('strong', null, p.nom),
      h('span', { class: 'meta' }, bientot ? `${bientot} soin${bientot > 1 ? 's' : ''} bientôt` : p.emplacement || `${p.soins.length} soin${p.soins.length > 1 ? 's' : ''}`)
    )
  );
}

function rendreAccueil(conteneur, ctx, donnees, jour) {
  const saison = P.saisonDe(donnees, jour);
  const { debutEte, debutHiver } = P.reglagesSaison(donnees);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      blocAujourdhui(donnees, jour),
      h(
        'div',
        { class: 'pile' },
        h('h2', { class: 'titre-section' }, 'Mes plantes'),
        h('div', { class: 'grille-zones' }, donnees.maison.plantes.map((p) => cartePlante(p, donnees, jour, ctx)))
      ),
      h(
        'div',
        { class: 'barre-discrete' },
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirPlante({}) }, '＋ Plante'),
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ouvrirIdeesPlantes }, '💡 Des idées'),
        h(
          'button',
          { class: 'bouton bouton-petit reglage-discret', type: 'button', title: 'Changer les mois de l’été et de l’hiver', onclick: ouvrirSaisons },
          saison === 'ete' ? `☀️ Rythme d’été · jusqu’en ${P.MOIS[(debutHiver + 10) % 12]}` : `❄️ Rythme d’hiver · jusqu’en ${P.MOIS[(debutEte + 10) % 12]}`
        )
      )
    )
  );
}

// ---- Une plante ----

function rendrePlante(conteneur, ctx, donnees, jour, plante) {
  const map = P.derniereFoisSoins(donnees);
  const lignes = plante.soins.map((soin) => ({ soin, etat: P.etatSoin(donnees, soin, jour, map.get(soin.id) || null) }));
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { planteOuverte = null; ctx.redessiner(); } }, '← Toutes les plantes')),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, `${plante.icone} ${plante.nom}`),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Ajouter un soin', 'aria-label': `Ajouter un soin pour ${plante.nom}`, onclick: () => ouvrirSoin({ planteId: plante.id }) }, '＋'),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier la plante', 'aria-label': `Modifier ${plante.nom}`, onclick: () => ouvrirPlante({ id: plante.id }) }, '✎')
        ),
        lignes.length
          ? h(
              'ul',
              { class: 'fenetre-corps liste' },
              lignes.map(({ soin, etat }) => {
                const t = P.typeSoin(soin.type);
                return h(
                  'li',
                  { class: 'ligne ligne-tache-maison' + (etat.due ? ' a-faire' : '') },
                  h(
                    'div',
                    { class: 'ligne-bloc' },
                    h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier ce soin', onclick: () => ouvrirSoin({ planteId: plante.id, id: soin.id }) }, `${t.icone} ${t.nom}`),
                    h('span', { class: 'meta' }, P.statutSoin(soin, etat))
                  ),
                  etat.pause ? null : h('div', { class: 'actions-ligne' }, boutonFait(soin))
                );
              })
            )
          : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Pas encore de soin : ajoute-en un avec le ＋.')),
        (plante.emplacement || plante.note) &&
          h('div', { class: 'fenetre-corps' }, h('p', { class: 'meta' }, [plante.emplacement, plante.note].filter(Boolean).join(' · ')))
      )
    )
  );
}

// ---- La page ----

export function rendrePlantes(conteneur, ctx) {
  const donnees = store.lire();
  const jour = aujourdhui();
  vider(conteneur);

  if (donnees.maison.plantes.length === 0) {
    planteOuverte = null;
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes plantes du balcon 🪴')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, "Arrosage, engrais, rempotage : chaque soin revient à son rythme, un pour l'été et un pour l'hiver. Tu n'as rien à retenir."),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: ouvrirIdeesPlantes }, "💡 Partir d'idées"),
            h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirPlante({}) }, '＋ Ajouter ma première plante')
          )
        )
      )
    );
    return;
  }

  const plante = planteOuverte ? P.planteParId(donnees, planteOuverte) : null;
  if (!plante) planteOuverte = null;
  if (plante) rendrePlante(conteneur, ctx, donnees, jour, plante);
  else rendreAccueil(conteneur, ctx, donnees, jour);
}
