// Onglet « Recherche perso » : mes notes de recherche, chacune avec ses sources
// (un lien ou un simple texte : titre d'un livre, nom d'une personne, page…).

import { h, vider, ouvrirModale, notifier, pastilles } from '../ui.js';
import * as store from '../store.js';
import { formatCourt } from '../dates.js';
import * as E from './etudes-donnees.js';
import { estUnLien } from './liens.js';
import { selecteurChapitre } from './etudes-composants.js';

// État de l'onglet (le temps de la visite)
let recherche = '';
let filtreChapitre = '';

// ---- Créer / modifier une note ----

// `titre` / `note` : des valeurs de départ (idée du brain dump) ; `surEnregistrement` : appelé une fois la note enregistrée.
export function ouvrirNote({ id = null, chapitreId = null, titre: titreInitial = '', note: noteInitiale = '', surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.etudes.recherches.find((r) => r.id === id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? 'Modifier la note' : 'Nouvelle note de recherche',
    couleur: 'ciel',
    large: true,
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: existante?.titre || titreInitial, placeholder: 'Le sujet de ta recherche', maxLength: 200, 'aria-label': 'Titre' });
      const note = h('textarea', { class: 'champ champ-note', rows: 9, placeholder: "Ce que tu as trouvé, compris, retenu…", id: 'note-texte' }, existante?.note || noteInitiale);
      const sources = h('textarea', {
        class: 'champ champ-note champ-code',
        rows: 3,
        placeholder: 'Une source par ligne : un lien (https://…) ou un texte (livre, auteur, page…)',
        id: 'note-sources',
      }, (existante?.sources || []).join('\n'));
      const chapitre = selecteurChapitre(donnees, { valeur: existante ? existante.chapitreId : chapitreId, id: 'note-chapitre', texteAucun: 'Aucun chapitre en particulier' });

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
            const valeurs = { titre: titre.value, note: note.value, sources: E.lireSources(sources.value), chapitreId: chapitre.value || null };
            if (existante) store.modifier((d) => E.modifierRecherche(d, existante.id, valeurs));
            else store.modifier((d) => E.ajouterRecherche(d, valeurs));
            surEnregistrement?.();
            fermer();
            if (!existante) notifier('Note enregistrée ✦');
          },
        },
        titre,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'note-texte' }, 'Ma note'), note),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'note-sources' }, 'Sources (liens ou textes)'), sources),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'note-chapitre' }, 'Rattachée au chapitre'), chapitre),
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
                  store.modifier((d) => (retire = E.supprimerRecherche(d, existante.id)));
                  fermer();
                  if (retire) {
                    notifier(`« ${retire.recherche.titre} » supprimée`, {
                      action: { label: 'Annuler', fn: () => store.modifier((d) => E.restaurerRecherche(d, retire)) },
                    });
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

// ---- Affichage ----

function listeSources(sources) {
  if (!sources.length) return null;
  return h(
    'ul',
    { class: 'liste-sources', 'aria-label': 'Sources' },
    sources.map((s) =>
      h(
        'li',
        null,
        estUnLien(s)
          ? h('a', { class: 'lien-source', href: s.trim(), target: '_blank', rel: 'noopener noreferrer' }, `🔗 ${s.trim()}`)
          : h('span', { class: 'texte-source' }, `📚 ${s}`)
      )
    )
  );
}

function carteNote(r, donnees) {
  const chapitre = r.chapitreId ? E.nomChapitre(donnees, r.chapitreId) : null;
  return h(
    'section',
    { class: 'fenetre carte-note', style: '--cat: var(--ciel)' },
    h(
      'div',
      { class: 'fenetre-barre' },
      pastilles(),
      h('h2', { class: 'fenetre-titre' }, r.titre),
      h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier cette note', 'aria-label': `Modifier « ${r.titre} »`, onclick: () => ouvrirNote({ id: r.id }) }, '✎')
    ),
    h(
      'div',
      { class: 'fenetre-corps pile' },
      h('p', { class: 'meta mono' }, [chapitre && `📖 ${chapitre} · `, `modifiée le ${formatCourt(r.modifieLe.slice(0, 10))}`]),
      r.note ? h('div', { class: 'note-texte' }, r.note) : h('p', { class: 'doux' }, 'Pas encore de texte.'),
      listeSources(r.sources)
    )
  );
}

export function rendreRecherche(conteneur, ctx) {
  const donnees = store.lire();
  if (ctx.params && 'chapitreId' in ctx.params) filtreChapitre = ctx.params.chapitreId || '';

  const toutes = donnees.etudes.recherches;

  // Seule la liste est redessinée quand on tape : le champ garde le focus.
  const zoneListe = h('div', { class: 'pile pile-large' });
  const dessinerListe = () => {
    const visibles = E.chercherRecherches(donnees, { texte: recherche, chapitreId: filtreChapitre });
    vider(zoneListe);
    if (visibles.length === 0) zoneListe.append(h('p', { class: 'vide' }, 'Aucune note ne correspond à cette recherche.'));
    else zoneListe.append(...visibles.map((r) => carteNote(r, donnees)));
  };

  const champ = h('input', {
    type: 'search',
    class: 'champ champ-recherche',
    placeholder: 'Chercher dans mes notes et mes sources…',
    value: recherche,
    'aria-label': 'Chercher dans mes notes',
    oninput: (e) => {
      recherche = e.target.value;
      dessinerListe();
    },
  });

  vider(conteneur);
  if (toutes.length === 0) {
    conteneur.append(
      h(
        'div',
        { class: 'pile pile-large' },
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--jaune)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ta recherche personnelle')),
          h(
            'div',
            { class: 'fenetre-corps pile' },
            h('p', null, "Un endroit pour garder ce que tu découvres au-delà du cours : un article, un livre, une interview, une idée à creuser. Pour chaque note, tu notes d'où ça vient : un lien, ou simplement un texte (titre du livre, auteur, page…)."),
            h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirNote({ chapitreId: filtreChapitre || null }) }, '＋ Écrire ma première note'))
          )
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
        h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirNote({ chapitreId: filtreChapitre || null }) }, '＋ Nouvelle note'),
        champ,
        toutes.some((r) => r.chapitreId) &&
          h(
            'div',
            { class: 'rangee-champ' },
            h('label', { class: 'etiquette', for: 'filtre-notes' }, 'Chapitre'),
            selecteurChapitre(donnees, {
              valeur: filtreChapitre || null,
              id: 'filtre-notes',
              texteAucun: 'Tous',
              surChangement: (id) => {
                filtreChapitre = id || '';
                dessinerListe();
              },
            })
          )
      ),
      zoneListe
    )
  );
}
