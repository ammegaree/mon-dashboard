// La fenêtre d'un repas du planning : quand, quoi, et les ingrédients (pour la liste de courses).

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur } from '../registry.js';
import { aujourdhui } from '../dates.js';
import * as N from './nourriture-donnees.js';

// `texte` / `ingredients` : des valeurs de départ (une recette, une idée du brain dump) ; `surEnregistrement` : appelé une fois enregistré.
export function ouvrirRepas({ id = null, date = aujourdhui(), moment = 'dejeuner', texte: texteInitial = '', ingredients: ingredientsInitiaux = [], surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existant = id ? donnees.nourriture.repas.find((r) => r.id === id) : null;
  if (id && !existant) return;

  ouvrirModale({
    titre: existant ? 'Modifier le repas' : 'Ajouter un repas',
    couleur: 'jaune',
    corps: (fermer) => {
      const choixMoment = h(
        'select',
        { class: 'champ', id: 'repas-moment' },
        N.MOMENTS.map((m) => h('option', { value: m.id, selected: m.id === (existant?.moment || moment) }, `${m.icone} ${m.nom}`))
      );
      choixMoment.value = existant?.moment || moment;
      const champDate = h('input', { type: 'date', class: 'champ', value: existant?.date || date, required: true, id: 'repas-date' });
      const texte = h('input', { type: 'text', class: 'champ champ-titre', value: existant?.texte || texteInitial, placeholder: 'Ex. Salade de pois chiches, soupe de lentilles…', maxLength: 200, 'aria-label': 'Repas' });
      const ingredients = h('textarea', {
        class: 'champ champ-note champ-code',
        rows: 4,
        placeholder: 'Un ingrédient par ligne (facultatif)\npois chiches\ntomates\ncitron',
        id: 'repas-ingredients',
      }, (existant?.ingredients || ingredientsInitiaux).join('\n'));
      const vers = h('input', { type: 'checkbox', checked: !existant });

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
            if (!champDate.value) {
              champDate.focus();
              return;
            }
            const liste = N.lireIngredients(ingredients.value);
            const valeurs = { date: champDate.value, moment: choixMoment.value, texte: texte.value, ingredients: liste };
            let ajoutes = 0;
            store.modifier((d) => {
              if (existant) N.modifierRepas(d, existant.id, valeurs);
              else N.ajouterRepas(d, valeurs);
              if (vers.checked && liste.length) ajoutes = N.ajouterIngredients(d, liste, 'repas');
            });
            surEnregistrement?.();
            fermer();
            if (ajoutes > 0) notifier(`${ajoutes} ingrédient${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''} à ta liste de courses ✦`);
            else if (!existant) notifier('Repas ajouté ✦');
          },
        },
        texte,
        h(
          'div',
          { class: 'rangee-options' },
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'repas-moment' }, 'Quel repas'), choixMoment),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'repas-date' }, 'Le'), champDate)
        ),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'repas-ingredients' }, 'Ingrédients'), ingredients),
        h('label', { class: 'rangee-champ case-simple' }, vers, h('span', null, 'Ajouter ces ingrédients à ma liste de courses')),
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
                  store.modifier((d) => (retire = N.supprimerRepas(d, existant.id)));
                  fermer();
                  if (retire) notifier('Repas supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => N.restaurerRepas(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => texte.focus(), 0);
      return formulaire;
    },
  });
}

// Cliquer un repas dans Aujourd'hui (✎) ouvre sa fenêtre.
enregistrerEditeur('repas', (item) => ouvrirRepas({ id: item.id }));

// ---- Une liste de courses d'un coup (depuis une idée du brain dump…) ----

export function ouvrirListeCourses({ texte = '', surEnregistrement = null } = {}) {
  ouvrirModale({
    titre: '🛒 Créer ma liste de courses',
    couleur: 'jaune',
    corps: (fermer) => {
      const zone = h('textarea', {
        class: 'champ champ-note champ-code',
        rows: 8,
        placeholder: 'Un article par ligne\nlait\npain\ncitrons',
        'aria-label': 'Articles à acheter',
      }, N.lireListeEnVrac(texte).join('\n'));
      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const liste = N.lireIngredients(zone.value);
            if (!liste.length) {
              zone.classList.add('champ-erreur');
              zone.focus();
              return;
            }
            let n = 0;
            store.modifier((d) => (n = N.ajouterIngredients(d, liste, 'main')));
            surEnregistrement?.();
            fermer();
            notifier(n ? `${n} article${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à ta liste de courses ✦` : 'Tout est déjà dans ta liste ✦');
          },
        },
        h('p', { class: 'doux' }, 'Vérifie et complète : un article par ligne. Ils s’ajoutent à ta liste de courses (sans doublon).'),
        zone,
        h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'), h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Ajouter à ma liste'))
      );
      setTimeout(() => zone.focus(), 0);
      return formulaire;
    },
  });
}

// ---- Une recette ----

// `titre` / `ingredients` : des valeurs de départ (une idée du brain dump) ; `surEnregistrement` : appelé une fois enregistrée.
export function ouvrirRecette({ id = null, titre: titreInitial = '', ingredients: ingredientsInitiaux = [], surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.nourriture.recettes.find((r) => r.id === id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? 'Ma recette' : 'Nouvelle recette',
    couleur: 'jaune',
    large: true,
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: existante?.titre || titreInitial, placeholder: 'Le nom de la recette', maxLength: 160, 'aria-label': 'Nom' });
      const ingredients = h('textarea', {
        class: 'champ champ-note champ-code',
        rows: 6,
        placeholder: 'Un ingrédient par ligne\n200 g de pâtes\n2 tomates',
        id: 'rec-ingredients',
      }, (existante?.ingredients || ingredientsInitiaux).join('\n'));
      const etapes = h('textarea', { class: 'champ champ-note', rows: 7, placeholder: 'Les étapes, comme tu les aimes (facultatif)', id: 'rec-etapes' }, existante?.etapes || '');

      const lireValeurs = () => ({ titre: titre.value, ingredients: N.lireIngredients(ingredients.value), etapes: etapes.value });
      const enregistrer = () => {
        if (!titre.value.trim()) {
          titre.classList.add('champ-erreur');
          titre.focus();
          return null;
        }
        const valeurs = lireValeurs();
        let cible = existante;
        if (existante) store.modifier((d) => N.modifierRecette(d, existante.id, valeurs));
        else store.modifier((d) => (cible = N.ajouterRecette(d, valeurs)));
        return { valeurs, cible };
      };

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!enregistrer()) return;
            surEnregistrement?.();
            fermer();
            if (!existante) notifier('Recette enregistrée ✦');
          },
        },
        titre,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'rec-ingredients' }, 'Ingrédients'), ingredients),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'rec-etapes' }, 'Préparation'), etapes),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h(
            'button',
            {
              class: 'bouton bouton-petit',
              type: 'button',
              onclick: () => {
                const r = enregistrer();
                if (!r) return;
                let n = 0;
                store.modifier((d) => (n = N.ajouterIngredients(d, r.valeurs.ingredients, 'repas')));
                surEnregistrement?.();
                fermer();
                notifier(n ? `${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à ta liste de courses ✦` : 'Tout est déjà dans ta liste ✦');
              },
            },
            '🛒 Ingrédients → liste de courses'
          ),
          h(
            'button',
            {
              class: 'bouton bouton-petit',
              type: 'button',
              onclick: () => {
                const r = enregistrer();
                if (!r) return;
                surEnregistrement?.();
                fermer();
                ouvrirRepas({ texte: r.valeurs.titre, ingredients: r.valeurs.ingredients });
              },
            },
            '🍽️ Mettre au planning'
          )
        ),
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
                  store.modifier((d) => (retiree = N.supprimerRecette(d, existante.id)));
                  fermer();
                  if (retiree) notifier('Recette supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => N.restaurerRecette(d, retiree)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => (existante ? etapes : titre).focus(), 0);
      return formulaire;
    },
  });
}
