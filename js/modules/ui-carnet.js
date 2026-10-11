// Le brain dump : vider sa tête sans trier, puis ranger dans une catégorie ou en faire une tâche.
// - `ouvrirBrainDump` : la fenêtre de saisie rapide, disponible depuis n'importe quelle page.
// - `ouvrirIdee` : une idée déjà notée (la ranger, la modifier, en faire une tâche, la supprimer).

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours } from '../dates.js';
import * as C from './carnet-donnees.js';
import { ouvrirAjoutTache } from './actions-taches.js';
import { actionsIdee } from './idees-registre.js';

// Une liste déroulante de catégories avec « Pas encore rangée ».
export function selectCategorie({ donnees, valeur, id = null }) {
  const choix = donnees.categories.filter((c) => !c.archivee || c.id === valeur);
  const select = h(
    'select',
    { class: 'champ', id },
    h('option', { value: '' }, 'Pas encore rangée'),
    choix.map((c) => h('option', { value: c.id, selected: c.id === valeur }, `${c.icone} ${c.nom}`))
  );
  select.value = valeur && choix.some((c) => c.id === valeur) ? valeur : '';
  return select;
}

// Le libellé du bouton « Brain dump » d'une catégorie : avec le nombre d'idées qui y sont rangées.
export function libelleBrainDump(donnees, categorieId) {
  const n = categorieId ? C.notesFiltrees(donnees, { categorieId }).length : 0;
  return n > 0 ? `🧠 Brain dump (${n})` : '🧠 Brain dump';
}

// ---- Saisie rapide ----

export function ouvrirBrainDump({ categorieId = null } = {}) {
  const donnees = store.lire();
  const rangees = categorieId ? C.notesFiltrees(donnees, { categorieId }) : [];
  const categorie_ = categorieId ? donnees.categories.find((c) => c.id === categorieId) : null;
  ouvrirModale({
    titre: '🧠 Brain dump',
    couleur: 'orange',
    corps: (fermer) => {
      const texte = h('textarea', {
        class: 'champ champ-note',
        rows: 6,
        placeholder: 'Tout ce qui te passe par la tête, sans trier.\nUne idée par ligne.',
        'aria-label': 'Mon brain dump',
      });
      const categorie = selectCategorie({ donnees, valeur: categorieId, id: 'bd-categorie' });
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
            let n = 0;
            store.modifier((d) => (n = C.ajouterIdees(d, { texte: texte.value, categorieId: categorie.value || null, date: aujourdhui() }).length));
            fermer();
            notifier(n > 1 ? `${n} idées notées ✦` : 'Noté ✦');
          },
        },
        texte,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'bd-categorie' }, 'Ranger dans'), categorie),
        h('p', { class: 'doux' }, 'Tu pourras ranger ou transformer chaque idée en tâche plus tard, dans « Brain dump ».'),
        h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'), h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Noter')),
        // Les idées déjà rangées dans cette catégorie : on les retrouve ici, et on peut les adapter.
        rangees.length > 0 &&
          h(
            'div',
            { class: 'pile' },
            h('h3', null, `Déjà rangées dans ${categorie_ ? `${categorie_.icone} ${categorie_.nom}` : 'cette catégorie'}`),
            h(
              'ul',
              { class: 'liste-simple' },
              rangees.map((n) =>
                h(
                  'li',
                  { class: 'ligne ligne-tache-maison' },
                  h('div', { class: 'ligne-bloc' }, h('span', null, n.texte)),
                  h(
                    'div',
                    { class: 'actions-ligne' },
                    h(
                      'button',
                      {
                        class: 'bouton bouton-petit',
                        type: 'button',
                        onclick: () => {
                          fermer();
                          ouvrirIdee({ id: n.id });
                        },
                      },
                      'Adapter ›'
                    )
                  )
                )
              )
            )
          )
      );
      setTimeout(() => texte.focus(), 0);
      return formulaire;
    },
  });
}

// Transforme une idée en tâche : la fenêtre d'ajout s'ouvre avec le texte, l'idée est retirée une fois la tâche créée.
export function ideeEnTache(note) {
  // Par défaut pour demain, pas pour aujourd'hui : une idée transformée en tâche ne doit pas encombrer
  // la journée en cours. Elle apparaîtra dans Aujourd'hui le jour choisi (et pas avant).
  ouvrirAjoutTache({
    categorieId: note.categorieId || null,
    titre: note.texte,
    date: ajouterJours(aujourdhui(), 1),
    info: "Tu transformes une idée en tâche : elle quittera ton brain dump et n'apparaîtra dans Aujourd'hui qu'à la date choisie.",
    surAjout: () => store.modifier((d) => C.supprimerNote(d, note.id)),
  });
}

// ---- Une idée ----

// Retire l'idée du brain dump (une fois adaptée : tâche, recette, projet…).
function retirerIdee(id) {
  return () => store.modifier((d) => C.supprimerNote(d, id));
}

export function ouvrirIdee({ id }) {
  const donnees = store.lire();
  const existante = donnees.carnet.notes.find((n) => n.id === id);
  if (!existante) return;

  ouvrirModale({
    titre: 'Mon idée',
    couleur: 'orange',
    corps: (fermer) => {
      const texte = h('textarea', { class: 'champ champ-note', rows: 4, 'aria-label': 'Mon idée' }, existante.texte);
      const categorie = selectCategorie({ donnees, valeur: existante.categorieId, id: 'idee-categorie' });
      const zoneActions = h('div', { class: 'pile pile-serre' });

      // Enregistre le texte et la catégorie ; rend l'idée à jour, ou null si le texte est vide.
      const enregistrer = () => {
        if (!texte.value.trim()) {
          texte.classList.add('champ-erreur');
          texte.focus();
          return null;
        }
        store.modifier((d) => C.modifierNote(d, existante.id, { texte: texte.value, categorieId: categorie.value || null, date: existante.date }));
        return { ...existante, texte: texte.value.trim(), categorieId: categorie.value || null };
      };

      // « Que veux-tu en faire ? » : les adaptations de la catégorie choisie, puis la tâche.
      const dessinerActions = () => {
        zoneActions.replaceChildren();
        const speciales = actionsIdee(categorie.value || null);
        zoneActions.append(
          ...[
          h('span', { class: 'etiquette' }, 'Que veux-tu en faire ?'),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            speciales.map((a) =>
              h(
                'button',
                {
                  class: 'bouton bouton-petit bouton-turquoise',
                  type: 'button',
                  onclick: () => {
                    const note = enregistrer();
                    if (!note) return;
                    fermer();
                    a.executer(note, retirerIdee(note.id));
                  },
                },
                a.libelle
              )
            ),
            h(
              'button',
              {
                class: 'bouton bouton-petit',
                type: 'button',
                onclick: () => {
                  const note = enregistrer();
                  if (!note) return;
                  fermer();
                  ideeEnTache(note);
                },
              },
              '→ Une tâche'
            )
          ),
          !categorie.value && h('p', { class: 'doux' }, 'Range d’abord l’idée dans une catégorie pour voir ce qu’on peut en faire (une recette, un projet, une échéance…).')
          ].filter(Boolean)
        );
      };
      categorie.addEventListener('change', dessinerActions);
      dessinerActions();

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (enregistrer()) fermer();
          },
        },
        texte,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'idee-categorie' }, 'Ranger dans'), categorie),
        zoneActions,
        h(
          'div',
          { class: 'rangee droite' },
          h(
            'button',
            {
              class: 'bouton',
              type: 'button',
              onclick: () => {
                let retire = null;
                store.modifier((d) => (retire = C.supprimerNote(d, existante.id)));
                fermer();
                if (retire) notifier('Idée supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => C.restaurerNote(d, retire)) } });
              },
            },
            'Supprimer'
          ),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => texte.focus(), 0);
      return formulaire;
    },
  });
}
