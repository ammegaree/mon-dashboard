// Interface des rendez-vous : la fenêtre de création/modification et l'affichage
// d'un rendez-vous (partagé entre l'accueil, la semaine et les pages de domaine).

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, formatLong } from '../dates.js';
import { champCategories } from './champs.js';
import { categorieDe } from './actions-taches.js';
import * as RDV from './rendezvous.js';

let derniereCategorie = 'autre';

// ---- Créer / modifier ----

export function ouvrirRendezVous({ id = null, date = aujourdhui(), categorieId = null } = {}) {
  const donnees = store.lire();
  const existant = id ? donnees.rendezvous.find((r) => r.id === id) : null;
  if (id && !existant) return;

  const actives = donnees.categories.filter((c) => !c.archivee);
  const voulue = existant?.categorieId || categorieId || derniereCategorie;
  const etat = { categorieId: actives.some((c) => c.id === voulue) || existant ? voulue : actives[0].id };

  ouvrirModale({
    titre: existant ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous',
    couleur: 'ciel',
    corps: (fermer) => {
      const champTitre = h('input', { type: 'text', class: 'champ champ-titre', value: existant?.titre || '', placeholder: 'Ex. Rendez-vous chez le médecin', maxLength: 200, 'aria-label': 'Titre' });
      const champDate = h('input', { type: 'date', class: 'champ', value: existant?.date || date, required: true, id: 'rdv-date' });
      const champHeure = h('input', { type: 'time', class: 'champ', value: existant?.heure || '', id: 'rdv-heure' });
      const champLieu = h('input', { type: 'text', class: 'champ', value: existant?.lieu || '', placeholder: 'Lieu ou lien (https://…)', maxLength: 300, id: 'rdv-lieu' });
      const champNote = h('textarea', { class: 'champ champ-note', rows: 3, placeholder: 'Une note, une question à poser…', id: 'rdv-note' }, existant?.note || '');

      const formulaire = h(
        'form',
        {
          class: 'formulaire-tache',
          novalidate: true,
          onsubmit: (e) => {
            e.preventDefault();
            const titre = champTitre.value.trim();
            if (!titre) {
              champTitre.classList.add('champ-erreur');
              champTitre.focus();
              return;
            }
            if (!champDate.value) {
              champDate.focus();
              return;
            }
            const valeurs = { titre, date: champDate.value, heure: champHeure.value, lieu: champLieu.value, note: champNote.value, categorieId: etat.categorieId };
            derniereCategorie = etat.categorieId;
            if (existant) store.modifier((d) => RDV.modifierRendezVous(d, existant.id, valeurs));
            else store.modifier((d) => RDV.ajouterRendezVous(d, valeurs));
            fermer();
            if (!existant) notifier(`Rendez-vous ajouté pour le ${formatLong(valeurs.date).toLowerCase()} ✦`);
          },
        },
        champTitre,
        champCategories({ donnees, valeur: etat.categorieId, surChangement: (c) => (etat.categorieId = c) }),
        h(
          'div',
          { class: 'rangee-options' },
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'rdv-date' }, 'Le'), champDate),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'rdv-heure' }, 'À (facultatif)'), champHeure)
        ),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'rdv-lieu' }, 'Où'), champLieu),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'rdv-note' }, 'Note'), champNote),
        h(
          'div',
          { class: 'rangee droite' },
          existant &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = RDV.supprimerRendezVous(d, existant.id)));
                  fermer();
                  if (retire) {
                    notifier(`« ${retire.rdv.titre} » supprimé`, {
                      action: { label: 'Annuler', fn: () => store.modifier((d) => RDV.restaurerRendezVous(d, retire)) },
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
      setTimeout(() => champTitre.focus(), 0);
      return formulaire;
    },
  });
}

// ---- Affichage ----

// Lieu : un lien cliquable si c'est une adresse web, sinon du simple texte.
export function lieuOuLien(lieu) {
  if (!lieu) return null;
  if (RDV.estUnLien(lieu)) {
    return h('a', { class: 'lien-rdv', href: lieu.trim(), target: '_blank', rel: 'noopener noreferrer' }, '🔗 Ouvrir le lien');
  }
  return h('span', { class: 'meta' }, `📍 ${lieu}`);
}

// Une ligne de rendez-vous (accueil, pages de domaine) : cliquable pour modifier.
export function ligneRendezVous(item, donnees) {
  const cat = categorieDe(donnees, item.categorieId);
  return h(
    'li',
    { class: 'rdv', style: `--cat: var(--${cat.couleur})` },
    h('span', { class: 'rdv-heure mono' }, item.heure || 'Journée'),
    h(
      'div',
      { class: 'ligne-bloc' },
      h('button', { class: 'rdv-titre', type: 'button', title: 'Modifier ce rendez-vous', onclick: () => ouvrirRendezVous({ id: item.id }) }, item.titre),
      lieuOuLien(item.lieu)
    )
  );
}
