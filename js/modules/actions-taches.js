// Gestes communs sur les tâches, utilisés par l'accueil et par les pages de domaine :
// ajouter, modifier, supprimer (avec annulation), gérer celles qui reviennent.

import { h, vider, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { cleCoche, estCoche, enregistrerEditeur, editeurDe, actionCocheDe } from '../registry.js';
import { aujourdhui, formatLong } from '../dates.js';
import * as T from './taches.js';
import { formulaireTache } from './formulaire-tache.js';

let derniereCategorie = 'autre';

enregistrerEditeur('tache', (item) => ouvrirEdition(item.id, item.date));

export function categorieDe(donnees, id) {
  return (
    donnees.categories.find((c) => c.id === id) ||
    donnees.categories.find((c) => c.id === 'autre') ||
    donnees.categories[0]
  );
}

// ---- Ajouter ----

// `titre` : un titre de départ (par exemple une idée du brain dump) ; `surAjout` : appelé une fois la tâche ajoutée.
// `info` : une phrase d'explication affichée au-dessus du formulaire.
export function ouvrirAjoutTache({ categorieId = null, date = aujourdhui(), titre = '', surAjout = null, info = '' } = {}) {
  const donnees = store.lire();
  const actives = donnees.categories.filter((c) => !c.archivee);
  const voulue = categorieId || derniereCategorie;
  const choisie = actives.some((c) => c.id === voulue) ? voulue : actives[0].id;

  ouvrirModale({
    titre: 'Ajouter une chose à faire',
    couleur: 'jaune',
    corps: (fermer) => {
      const formulaire = formulaireTache({
        donnees,
        valeurs: { titre, categorieId: choisie, date, recurrence: null },
        texteBouton: 'Ajouter',
        surAnnulation: fermer,
        surValidation: (valeurs) => {
          derniereCategorie = valeurs.categorieId;
          store.modifier((d) => T.ajouterTache(d, valeurs));
          surAjout?.();
          fermer();
          notifier(
            valeurs.date === date ? 'Ajoutée ✦' : `Ajoutée pour le ${formatLong(valeurs.date).toLowerCase()} ✦`
          );
        },
      });
      setTimeout(() => formulaire.focus(), 0);
      return info ? h('div', { class: 'pile' }, h('p', { class: 'doux' }, info), formulaire.element) : formulaire.element;
    },
  });
}

// ---- Modifier ----

export function ouvrirEdition(tacheId, dateContexte) {
  const donnees = store.lire();
  const tache = donnees.taches.find((t) => t.id === tacheId);
  if (!tache) return;
  ouvrirModale({
    titre: 'Modifier',
    couleur: categorieDe(donnees, tache.categorieId).couleur,
    corps: (fermer) => {
      const extra = [];
      if (tache.recurrence) {
        extra.push(
          h(
            'button',
            {
              class: 'bouton',
              type: 'button',
              onclick: () => {
                store.modifier((d) => T.passerCetteFois(d, tache.id, dateContexte));
                fermer();
                notifier('Elle ne reviendra pas ce jour-là, sans souci.');
              },
            },
            'Passer pour ce jour'
          )
        );
      }
      extra.push(
        h(
          'button',
          {
            class: 'bouton',
            type: 'button',
            onclick: () => {
              fermer();
              supprimerAvecAnnulation(tache.id);
            },
          },
          tache.recurrence ? 'Supprimer (ne reviendra plus)' : 'Supprimer'
        )
      );
      const formulaire = formulaireTache({
        donnees,
        valeurs: {
          titre: tache.titre,
          categorieId: tache.categorieId,
          date: tache.recurrence ? tache.recurrence.debut : tache.date,
          recurrence: tache.recurrence,
        },
        texteBouton: 'Enregistrer',
        surAnnulation: fermer,
        boutonsSupplementaires: extra,
        surValidation: (valeurs) => {
          store.modifier((d) => T.modifierTache(d, tache.id, valeurs));
          fermer();
        },
      });
      setTimeout(() => formulaire.focus(), 0);
      return formulaire.element;
    },
  });
}

// ---- Supprimer (avec « Annuler » pendant quelques secondes) ----

export function supprimerAvecAnnulation(id) {
  let retire = null;
  store.modifier((d) => (retire = T.supprimerTache(d, id)));
  if (retire) {
    notifier(`« ${retire.tache.titre} » supprimée`, {
      action: { label: 'Annuler', fn: () => store.modifier((d) => T.restaurerTache(d, retire)) },
    });
  }
}

// ---- Celles qui reviennent ----

export function ouvrirRecurrentes() {
  const zone = h('div', { class: 'pile' });
  const dessiner = () => {
    const donnees = store.lire();
    const recurrentes = donnees.taches.filter((t) => t.recurrence);
    vider(zone);
    if (!recurrentes.length) {
      zone.append(
        h('p', { class: 'vide' }, "Aucune tâche ne revient pour l'instant. Quand tu ajoutes une chose à faire, choisis « Se répète » pour en créer une (ménage, administratif…).")
      );
      return;
    }
    zone.append(
      h(
        'ul',
        { class: 'liste-simple' },
        recurrentes.map((t) => {
          const cat = categorieDe(donnees, t.categorieId);
          return h(
            'li',
            { class: 'ligne ligne-simple', style: `--cat: var(--${cat.couleur})` },
            h('span', { class: 'pastille-cat', 'aria-hidden': 'true' }),
            h('div', { class: 'ligne-bloc' }, h('strong', null, t.titre), h('span', { class: 'meta' }, `${cat.icone} ${cat.nom} · ${T.decrireRecurrence(t.recurrence)}`)),
            h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirEdition(t.id, aujourdhui()) }, 'Modifier'),
            h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => supprimerAvecAnnulation(t.id) }, 'Supprimer')
          );
        })
      )
    );
  };
  dessiner();
  const { surFermeture } = ouvrirModale({ titre: 'Mes tâches qui reviennent', couleur: 'turquoise', large: true, corps: zone });
  surFermeture(store.abonner(dessiner));
}

// ---- Une ligne de tâche à cocher ----

// La case coche, le titre ouvre la tâche : rien d'autre à l'écran.
// surCoche(item) : appelé quand on coche ou décoche (par défaut : on bascule simplement).
export function ligneTache(item, donnees, { modifiable = true, surCoche = null } = {}) {
  const fait = estCoche(donnees, item);
  const basculer = surCoche || ((it) => store.modifier((d) => T.basculerCoche(d, cleCoche(it))));
  const editeur = modifiable ? editeurDe(item.source) : null;
  const caseACocher = h('input', {
    type: 'checkbox',
    class: 'case-boite',
    checked: fait,
    'aria-label': editeur ? `Cocher « ${item.titre} »` : null,
    onchange: (e) => {
      // Certains éléments (le check-in) ouvrent un formulaire au lieu de se cocher.
      const action = actionCocheDe(item.source);
      if (action) {
        e.target.checked = fait;
        action(item);
        return;
      }
      basculer(item);
    },
  });
  const titre = editeur
    ? h('button', { class: 'titre-cliquable ligne-titre', type: 'button', title: 'Modifier', onclick: () => editeur(item) }, item.titre)
    : h('span', { class: 'ligne-titre' }, item.titre);
  return h(
    'li',
    { class: 'ligne' + (fait ? ' fait' : ''), 'data-cle': cleCoche(item) },
    // Avec un éditeur, seule la case coche ; sinon toute la ligne est cliquable, comme avant.
    h(editeur ? 'div' : 'label', { class: 'case' }, caseACocher, titre),
    item.heure && h('span', { class: 'meta' }, item.heure)
  );
}

// Une ligne d'information : un repère du jour (un repas du planning…), sans case à cocher.
export function ligneInfo(item) {
  const editeur = editeurDe(item.source);
  return h(
    'li',
    { class: 'ligne ligne-info' },
    editeur
      ? h('button', { class: 'titre-cliquable ligne-titre ligne-bloc', type: 'button', title: 'Modifier', onclick: () => editeur(item) }, item.titre)
      : h('span', { class: 'ligne-titre ligne-bloc' }, item.titre)
  );
}
