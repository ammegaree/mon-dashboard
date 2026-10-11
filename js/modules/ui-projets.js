// Les fenêtres des projets : un projet, une étape, plusieurs étapes d'un coup, des idées pour démarrer.

import { h, ouvrirModale, confirmer, notifier, confettis } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur, enregistrerActionCoche } from '../registry.js';
import { aujourdhui } from '../dates.js';
import * as P from './projets-donnees.js';

// Cocher / décocher une étape. Si c'était la dernière : une petite fête, sans excès.
export function basculerEtape(id, date = aujourdhui()) {
  const avant = P.etapeParId(store.lire(), id);
  if (!avant) return;
  const etaitFaite = Boolean(avant.etape.faitLe);
  let fini = false;
  store.modifier((d) => {
    if (etaitFaite) P.decocherEtape(d, id);
    else {
      P.cocherEtape(d, id, date);
      const r = P.etapeParId(d, id);
      fini = Boolean(r && P.termine(r.projet));
    }
  });
  if (fini) {
    notifier(`Projet « ${avant.projet.titre} » terminé ✦`);
    requestAnimationFrame(() => confettis());
  }
}

// Depuis Aujourd'hui : la case et le titre.
enregistrerActionCoche('maison-etape', (item) => basculerEtape(item.id));
enregistrerEditeur('maison-etape', (item) => ouvrirEtape({ id: item.id }));

// ---- Un projet ----

// `titre` : un titre de départ (idée du brain dump) ; `surCreation` : appelé avec le projet une fois créé.
export function ouvrirProjet({ id = null, titre: titreInitial = '', surCreation = null } = {}) {
  const donnees = store.lire();
  const existant = id ? P.projetParId(donnees, id) : null;
  if (id && !existant) return;

  ouvrirModale({
    titre: existant ? 'Modifier le projet' : 'Nouveau projet',
    couleur: 'turquoise',
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: existant?.titre || titreInitial, placeholder: 'Ex. Ranger le bureau, repeindre la chambre…', maxLength: 100, 'aria-label': 'Titre' });
      const icone = h('input', { type: 'text', class: 'champ champ-icone', value: existant?.icone || '🧱', maxLength: 8, 'aria-label': 'Icône' });
      const note = h('textarea', { class: 'champ champ-note', rows: 3, maxLength: 600, placeholder: 'Une note, une envie, un budget… (facultatif)', 'aria-label': 'Note' }, existant?.note || '');
      return h(
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
            const valeurs = { titre: titre.value, icone: icone.value, note: note.value };
            if (existant) store.modifier((d) => P.modifierProjet(d, existant.id, valeurs));
            else {
              let cree = null;
              store.modifier((d) => (cree = P.ajouterProjet(d, valeurs)));
              if (surCreation) {
                surCreation(cree);
                store.modifier(() => {}); // la page se redessine avec l'état choisi par `surCreation`
              }
            }
            fermer();
          },
        },
        h('div', { class: 'rangee' }, icone, titre),
        note,
        !existant && h('p', { class: 'doux' }, 'Tu ajouteras les petites étapes ensuite, une par une ou plusieurs à la fois.'),
        h(
          'div',
          { class: 'rangee droite' },
          existant &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: async () => {
                  const n = existant.etapes.length;
                  const ok = await confirmer({
                    titre: 'Supprimer ce projet ?',
                    message: `« ${existant.titre} »${n ? ` et ses ${n} étape${n > 1 ? 's' : ''}` : ''} seront retirés.`,
                    oui: 'Supprimer',
                    non: 'Garder',
                  });
                  if (!ok) return;
                  let retire = null;
                  store.modifier((d) => (retire = P.supprimerProjet(d, existant.id)));
                  fermer();
                  if (retire) notifier('Projet supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => P.restaurerProjet(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
}

// ---- Une étape ----

export function ouvrirEtape({ id }) {
  const donnees = store.lire();
  const r = P.etapeParId(donnees, id);
  if (!r) return;
  const { projet, etape } = r;

  ouvrirModale({
    titre: `Étape · ${projet.titre}`,
    couleur: 'turquoise',
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: etape.titre, maxLength: 160, 'aria-label': 'Titre de l’étape' });
      const duree = h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 600, value: etape.dureeMin || '', placeholder: 'min', id: 'et-duree' });
      return h(
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
            store.modifier((d) => P.modifierEtape(d, id, { titre: titre.value, dureeMin: duree.value }));
            fermer();
          },
        },
        titre,
        h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'et-duree' }, 'Durée'), duree, h('span', { class: 'meta' }, 'min (facultatif)')),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton bouton-petit', type: 'button', 'aria-label': 'Monter', onclick: () => store.modifier((d) => P.deplacerEtape(d, id, -1)) }, '↑'),
          h('button', { class: 'bouton bouton-petit', type: 'button', 'aria-label': 'Descendre', onclick: () => store.modifier((d) => P.deplacerEtape(d, id, 1)) }, '↓'),
          h(
            'button',
            {
              class: 'bouton',
              type: 'button',
              onclick: () => {
                let retiree = null;
                store.modifier((d) => (retiree = P.supprimerEtape(d, id)));
                fermer();
                if (retiree) notifier('Étape supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => P.restaurerEtape(d, retiree)) } });
              },
            },
            'Supprimer'
          ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
}

export function ouvrirPlusieursEtapes(projetId) {
  ouvrirModale({
    titre: 'Ajouter plusieurs étapes',
    couleur: 'turquoise',
    corps: (fermer) => {
      const zone = h('textarea', { class: 'champ champ-note', rows: 8, placeholder: 'Une étape par ligne.\nVider le meuble\nTrier\nRemettre en place…', 'aria-label': 'Étapes, une par ligne' });
      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            let n = 0;
            store.modifier((d) => (n = P.ajouterEtapes(d, projetId, zone.value).length));
            fermer();
            if (n) notifier(`${n} étape${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} ✦`);
          },
        },
        h('p', { class: 'doux' }, 'Une ligne = une étape. Découpe en petit : une étape doit tenir en un seul geste.'),
        zone,
        h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'), h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Ajouter'))
      );
      setTimeout(() => zone.focus(), 0);
      return formulaire;
    },
  });
}

// ---- Des idées de projets, déjà découpés ----

export function ouvrirIdeesProjets() {
  const donnees = store.lire();
  const dejaLa = (titre) => donnees.maison.projets.some((p) => p.titre.toLowerCase() === titre.toLowerCase());
  ouvrirModale({
    titre: 'Des idées de projets',
    couleur: 'jaune',
    corps: (fermer) => {
      const coches = new Map();
      const blocs = P.IDEES_PROJETS.map((idee, i) => {
        const present = dejaLa(idee.titre);
        const c = h('input', { type: 'checkbox', checked: false, disabled: present });
        coches.set(idee.titre, c);
        return h(
          'details',
          { class: 'groupe-idees', open: false },
          h(
            'summary',
            null,
            h('label', { class: 'idee', onclick: (e) => e.stopPropagation() }, c, h('span', { class: 'ligne-bloc' }, `${idee.icone} ${idee.titre}`)),
            h('span', { class: 'meta mono' }, present ? 'déjà là' : `${idee.etapes.length} étapes`)
          ),
          h('ol', { class: 'liste-puces' }, idee.etapes.map((e) => h('li', null, e.titre)))
        );
      });
      return h(
        'div',
        { class: 'pile' },
        h('p', { class: 'doux' }, 'Coche un projet : il arrive déjà découpé en petites étapes, que tu pourras changer. Ouvre-le pour voir les étapes.'),
        h('div', { class: 'grille-idees' }, blocs),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h(
            'button',
            {
              class: 'bouton bouton-jaune',
              type: 'button',
              onclick: () => {
                const titres = [...coches.entries()].filter(([, c]) => c.checked && !c.disabled).map(([t]) => t);
                let n = 0;
                store.modifier((d) => (n = P.ajouterIdeesProjets(d, titres)));
                fermer();
                notifier(n ? `${n} projet${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} ✦` : 'Rien de nouveau à ajouter.');
              },
            },
            'Ajouter la sélection'
          )
        )
      );
    },
  });
}
