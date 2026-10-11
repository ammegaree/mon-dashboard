// Loisirs › « Vue d'ensemble » : ce qui est en cours, mes listes (à lire, à voir…) en cartes,
// et le détail d'une liste en cliquant dessus.

import { h, vider, pastilles, etincelles } from '../ui.js';
import * as store from '../store.js';
import * as L from './loisirs-donnees.js';
import { ouvrirEnvie, ouvrirListe, lienEnvie, auteurEnvie } from './ui-loisirs.js';
import { ouvrirRoue } from './ui-roue.js';

// La liste dont on regarde le détail (null : on voit toutes les listes).
let listeOuverte = null;

// Chaque liste a sa couleur (toujours la même) : les listes de départ ont la leur, les autres en reçoivent une.
const COULEURS_LISTES = { lire: 'ciel', voir: 'corail', ecouter: 'violet', essayer: 'jaune', visiter: 'turquoise' };
const PALETTE_LISTES = ['rose', 'vert', 'orange', 'ciel', 'violet', 'jaune', 'turquoise', 'corail'];

export function couleurListe(id) {
  if (COULEURS_LISTES[id]) return COULEURS_LISTES[id];
  let total = 0;
  for (const c of String(id)) total += c.charCodeAt(0);
  return PALETTE_LISTES[total % PALETTE_LISTES.length];
}

export function reinitialiserLoisirs() {
  listeOuverte = null;
}

export function ouvrirLaListe(id) {
  listeOuverte = id;
}

function etoilesLecture(envie) {
  return envie.etoiles ? h('span', { class: 'etoiles-lecture', 'aria-label': `${envie.etoiles} sur 5` }, L.texteEtoiles(envie.etoiles)) : null;
}

function titreCliquable(e) {
  return h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier', onclick: () => ouvrirEnvie({ id: e.id }) }, e.titre);
}

function ligneEnvie(e, { avecListe = null } = {}) {
  const actions = [];
  if (e.statut === 'a-faire') {
    actions.push(h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => store.modifier((d) => L.changerStatut(d, e.id, 'en-cours')) }, 'Je commence'));
  }
  if (e.statut !== 'fini') {
    actions.push(
      h(
        'button',
        {
          class: 'bouton bouton-petit bouton-turquoise',
          type: 'button',
          onclick: (ev) => {
            etincelles(ev.currentTarget);
            ouvrirEnvie({ id: e.id, statut: 'fini' });
          },
        },
        'Terminé ✓'
      )
    );
  }
  const meta = [avecListe ? `${avecListe.icone} ${avecListe.nom}` : null, e.note || null].filter(Boolean).join(' · ');
  return h(
    'li',
    { class: 'ligne ligne-envie' + (e.statut === 'en-cours' ? ' en-cours' : '') },
    h('div', { class: 'ligne-bloc' }, titreCliquable(e), auteurEnvie(e), e.statut === 'fini' && etoilesLecture(e), meta && h('span', { class: 'meta' }, meta), lienEnvie(e)),
    actions.length > 0 && h('div', { class: 'actions-ligne' }, actions)
  );
}

function tuile(etiquette, montant, sous, couleur) {
  return h(
    'div',
    { class: 'tuile', style: `--cat: var(--${couleur})` },
    h('span', { class: 'tuile-etiquette mono' }, etiquette),
    h('strong', { class: 'tuile-montant' }, String(montant)),
    sous && h('span', { class: 'tuile-sous' }, sous)
  );
}

// Une envie « en cours » : une carte à la couleur de sa liste.
function carteEnCours(e, donnees) {
  const liste = L.listeParId(donnees, e.listeId);
  return h(
    'article',
    { class: 'carte-envie', style: `--cat: var(--${couleurListe(e.listeId)})` },
    h('span', { class: 'carte-envie-liste mono' }, liste ? `${liste.icone} ${liste.nom}` : ''),
    titreCliquable(e),
    auteurEnvie(e),
    e.note && h('span', { class: 'carte-envie-note' }, e.note),
    lienEnvie(e),
    h(
      'div',
      null,
      h(
        'button',
        {
          class: 'bouton bouton-petit bouton-turquoise',
          type: 'button',
          onclick: (ev) => {
            etincelles(ev.currentTarget);
            ouvrirEnvie({ id: e.id, statut: 'fini' });
          },
        },
        'Terminé ✓'
      )
    )
  );
}

// Une liste : une grande carte colorée avec un aperçu de ce qui vient, et un « ＋ » pour ajouter ici.
function carteListe(l, donnees, ctx) {
  const c = L.comptes(donnees, l.id);
  const total = c.aFaire + c.enCours + c.fini;
  const suivantes = L.enviesDeListe(donnees, l.id, 'a-faire').slice(0, 2);
  const reste = c.aFaire - suivantes.length;
  const morceaux = [];
  if (c.aFaire) morceaux.push(`${c.aFaire} à faire`);
  if (c.enCours) morceaux.push(`${c.enCours} en cours`);
  if (c.fini) morceaux.push(`${c.fini} terminé${c.fini > 1 ? 's' : ''}`);
  return h(
    'article',
    { class: 'carte-liste', style: `--cat: var(--${couleurListe(l.id)})` },
    h(
      'button',
      {
        class: 'carte-liste-ouvrir',
        type: 'button',
        'aria-label': `Ouvrir la liste ${l.nom}`,
        onclick: () => {
          listeOuverte = l.id;
          ctx.redessiner();
        },
      },
      h('span', { class: 'carte-liste-icone', 'aria-hidden': 'true' }, l.icone),
      h('strong', { class: 'carte-liste-nom' }, l.nom),
      h('span', { class: 'meta' }, morceaux.length ? morceaux.join(' · ') : 'Vide pour l’instant'),
      total > 0 && h('span', { class: 'mini-barre', 'aria-hidden': 'true' }, h('span', { class: 'mini-remplissage', style: `width: ${Math.round((c.fini / total) * 100)}%` })),
      suivantes.length > 0 &&
        h(
          'span',
          { class: 'carte-liste-apercu' },
          suivantes.map((e) => h('span', null, `• ${e.titre}${e.auteur ? ` — ${e.auteur}` : ''}`)),
          reste > 0 && h('span', { class: 'meta' }, `+ ${reste} autre${reste > 1 ? 's' : ''}`)
        )
    ),
    h('button', { class: 'carte-liste-plus', type: 'button', title: `Ajouter dans ${l.nom}`, 'aria-label': `Ajouter dans ${l.nom}`, onclick: () => ouvrirEnvie({ listeId: l.id }) }, '＋')
  );
}

function rendreAccueil(conteneur, ctx, donnees) {
  const { listes } = donnees.loisirs;
  const encours = L.enCours(donnees);

  if (listes.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--violet)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes envies 🎬')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, 'Tu n’as plus de liste. Crée-en une (à lire, à voir, à essayer…) pour y ranger tes envies.'),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirListe({}) }, '＋ Créer une liste'))
        )
      )
    );
    return;
  }

  const toutes = donnees.loisirs.envies.filter((e) => L.listeParId(donnees, e.listeId));
  const nbAFaire = toutes.filter((e) => e.statut === 'a-faire').length;
  const nbFinies = toutes.filter((e) => e.statut === 'fini').length;
  const moyenne = L.moyenneEtoiles(toutes.filter((e) => e.statut === 'fini'));
  const dernieres = L.terminees(donnees).slice(0, 3);

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },

      // Les chiffres d'un coup d'œil
      h(
        'div',
        { class: 'tuiles-budget tuiles-loisirs' },
        tuile('À faire', nbAFaire, nbAFaire > 0 ? 'qui t’attendent' : 'rien en attente', 'jaune'),
        tuile('En cours', encours.length, encours.length > 0 ? 'en ce moment' : 'rien en cours', 'turquoise'),
        tuile('Terminé', nbFinies, nbFinies > 0 ? 'déjà vécu' : 'à venir', 'vert'),
        moyenne !== null && tuile('Ma moyenne', `${String(moyenne).replace('.', ',')} ★`, 'sur 5', 'rose')
      ),

      // La roue, toujours là : s'il n'y a encore rien « à faire », elle invite à ajouter une envie.
      h(
        'section',
        { class: 'carte-roue' },
        h('span', { class: 'roue-mini', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: 'carte-roue-texte' },
          h('strong', null, 'Pas d’idée ?'),
          h('span', null, nbAFaire > 0 ? 'La roue choisit une envie pour toi.' : 'Ajoute quelques envies « à faire » et la roue choisira pour toi.')
        ),
        nbAFaire > 0
          ? h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirRoue({}) }, '🎡 Tourner la roue')
          : h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirEnvie({}) }, '＋ Ajouter une envie')
      ),

      // En ce moment
      encours.length > 0 &&
        h('div', { class: 'pile' }, h('h2', { class: 'titre-section' }, 'En ce moment'), h('div', { class: 'grille-envies' }, encours.map((e) => carteEnCours(e, donnees)))),

      // Mes listes
      h(
        'div',
        { class: 'pile' },
        h('h2', { class: 'titre-section' }, 'Mes listes'),
        h('div', { class: 'grille-listes' }, listes.map((l) => carteListe(l, donnees, ctx)))
      ),

      // Dernièrement terminé
      dernieres.length > 0 &&
        h(
          'div',
          { class: 'pile' },
          h('h2', { class: 'titre-section' }, 'Dernièrement terminé'),
          h(
            'div',
            { class: 'grille-envies' },
            dernieres.map((e) => {
              const liste = L.listeParId(donnees, e.listeId);
              return h(
                'article',
                { class: 'carte-envie carte-envie-finie', style: `--cat: var(--${couleurListe(e.listeId)})` },
                h('span', { class: 'carte-envie-liste mono' }, liste ? `${liste.icone} ${liste.nom}` : ''),
                titreCliquable(e),
                auteurEnvie(e),
                etoilesLecture(e),
                e.avis && h('span', { class: 'carte-envie-note' }, e.avis)
              );
            })
          ),
          ctx.aller && h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ctx.aller('avis') }, 'Tous mes avis ›'))
        ),

      h(
        'div',
        { class: 'barre-discrete' },
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirEnvie({}) }, '＋ Envie'),
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirListe({}) }, '＋ Liste')
      )
    )
  );
}

function rendreListeOuverte(conteneur, ctx, donnees, liste) {
  const aFaire = L.enviesDeListe(donnees, liste.id, 'a-faire');
  const enCours = L.enviesDeListe(donnees, liste.id, 'en-cours');
  const finies = L.terminees(donnees, { listeId: liste.id });
  const moyenne = L.moyenneEtoiles(finies);

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
              listeOuverte = null;
              ctx.redessiner();
            },
          },
          '← Toutes mes listes'
        )
      ),
      h(
        'section',
        { class: 'fenetre', style: `--cat: var(--${couleurListe(liste.id)})` },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, `${liste.icone} ${liste.nom}`),
          h('button', { class: 'bouton-icone', type: 'button', title: 'La roue : tirer une envie de cette liste', 'aria-label': `Tirer une envie dans ${liste.nom}`, onclick: () => ouvrirRoue({ listeId: liste.id }) }, '🎡'),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Ajouter ici', 'aria-label': `Ajouter dans ${liste.nom}`, onclick: () => ouvrirEnvie({ listeId: liste.id }) }, '＋'),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier la liste', 'aria-label': `Modifier la liste ${liste.nom}`, onclick: () => ouvrirListe({ id: liste.id }) }, '✎')
        ),
        aFaire.length + enCours.length > 0
          ? h('ul', { class: 'fenetre-corps liste' }, [...enCours, ...aFaire].map((e) => ligneEnvie(e)))
          : h('div', { class: 'fenetre-corps pile' }, h('p', { class: 'vide' }, finies.length ? 'Tout est terminé 🎉 Une nouvelle envie ?' : 'Rien ici pour l’instant.'), h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirEnvie({ listeId: liste.id }) }, '＋ Ajouter une envie')))
      ),
      finies.length > 0 &&
        h(
          'details',
          { class: 'repliable-discret' },
          h('summary', null, `✓ Terminé (${finies.length})${moyenne !== null ? ` · moyenne ${String(moyenne).replace('.', ',')} ★` : ''}`),
          h('ul', { class: 'liste' }, finies.map((e) => ligneEnvie(e)))
        )
    )
  );
}

export function rendreListes(conteneur, ctx) {
  const donnees = store.lire();
  vider(conteneur);
  const liste = listeOuverte ? L.listeParId(donnees, listeOuverte) : null;
  if (!liste) listeOuverte = null;
  if (liste) rendreListeOuverte(conteneur, ctx, donnees, liste);
  else rendreAccueil(conteneur, ctx, donnees);
}
