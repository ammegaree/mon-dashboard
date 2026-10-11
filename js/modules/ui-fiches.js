// La fenêtre d'une fiche : un contact, une garantie ou une référence.

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as F from './fiches-donnees.js';
import { ouvrirEcheance } from './ui-echeances.js';

export function ouvrirFiche({ id = null, type = 'contact', surCreation = null } = {}) {
  const donnees = store.lire();
  const existante = id ? F.ficheParId(donnees, id) : null;
  if (id && !existante) return;
  const t = F.typeFiche(existante ? existante.type : type);
  const v = existante || {};

  ouvrirModale({
    titre: existante ? `Modifier ${t.un === 'contact' ? 'le contact' : t.un === 'garantie' ? 'la garantie' : 'la référence'}` : `Nouveau : ${t.un}`,
    couleur: 'turquoise',
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: v.titre || '', placeholder: t.exemple, maxLength: 120, 'aria-label': 'Titre' });
      const champs = {}; // champ → élément de saisie
      const ligne = (cle, libelle, element) => {
        champs[cle] = element;
        return h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: `fiche-${cle}` }, libelle), Object.assign(element, { id: `fiche-${cle}` }));
      };
      const texteChamp = (cle, libelle, placeholder = '', max = 120) => ligne(cle, libelle, h('input', { type: 'text', class: 'champ', value: v[cle] || '', placeholder, maxLength: max }));

      let lignes;
      if (t.id === 'contact') {
        lignes = [
          texteChamp('role', 'Qui est-ce ?', 'Plombier, propriétaire, syndic…', 60),
          texteChamp('telephone', 'Téléphone', '06 12 34 56 78', 40),
          texteChamp('email', 'E-mail', 'nom@exemple.fr', 120),
        ];
      } else if (t.id === 'garantie') {
        lignes = [
          texteChamp('magasin', 'Acheté où ?', 'Magasin ou site', 80),
          ligne('dateAchat', 'Acheté le', h('input', { type: 'date', class: 'champ', value: v.dateAchat || '', max: aujourdhui() })),
          ligne('dureeMois', 'Garantie (mois)', h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 600, value: v.dureeMois || '', placeholder: '24' })),
          texteChamp('reference', 'Modèle / n° de série', 'Repère pour le SAV', 80),
        ];
      } else {
        lignes = [
          texteChamp('valeur', 'La référence', 'Ex. teinte RAL 9010, modèle X-200…', 120),
          texteChamp('ou', 'Où / pour quoi ?', 'Ex. salon, mur du fond', 120),
        ];
      }
      const note = h('textarea', { class: 'champ champ-note', rows: 3, maxLength: 600, placeholder: t.id === 'garantie' ? 'Où est la facture, ce que couvre la garantie… (facultatif)' : 'Une note (facultatif)', 'aria-label': 'Note' }, v.note || '');

      const lireValeurs = () => ({ titre: titre.value, note: note.value, ...Object.fromEntries(Object.entries(champs).map(([c, el]) => [c, el.value])) });
      const enregistrer = () => {
        if (!titre.value.trim()) {
          titre.classList.add('champ-erreur');
          titre.focus();
          return false;
        }
        const valeurs = lireValeurs();
        if (existante) store.modifier((d) => F.modifierFiche(d, existante.id, valeurs));
        else {
          let cree = null;
          store.modifier((d) => (cree = F.ajouterFiche(d, t.id, valeurs)));
          if (surCreation) {
            surCreation(cree);
            store.modifier(() => {}); // la page se redessine avec l'état choisi par `surCreation`
          }
        }
        return true;
      };

      // Pour une garantie : un rappel avant la fin, via une échéance (dans Administratif).
      const bouton_rappel =
        t.id === 'garantie' && existante && F.finGarantie(existante)
          ? h(
              'button',
              {
                class: 'bouton bouton-petit',
                type: 'button',
                onclick: () => {
                  const date = F.dateRappelGarantie(existante);
                  if (!date) {
                    notifier('Cette garantie est déjà terminée.');
                    return;
                  }
                  fermer();
                  ouvrirEcheance({ titre: `Fin de garantie : ${existante.titre}`, date, repeteMois: 0, rappelJours: 30 });
                },
              },
              '📅 Me prévenir avant la fin'
            )
          : null;

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!enregistrer()) return;
            fermer();
            if (!existante) notifier('Fiche ajoutée ✦');
          },
        },
        titre,
        ...lignes,
        note,
        t.id === 'garantie' && existante && F.texteGarantie(existante) && h('p', { class: 'meta mono' }, F.texteGarantie(existante)),
        bouton_rappel && h('div', null, bouton_rappel),
        h('p', { class: 'doux' }, 'Pas de mot de passe ni de numéro de compte ici : seulement des repères.'),
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
                  let retiree = null;
                  store.modifier((d) => (retiree = F.supprimerFiche(d, existante.id)));
                  fermer();
                  if (retiree) notifier('Fiche supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => F.restaurerFiche(d, retiree)) } });
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
