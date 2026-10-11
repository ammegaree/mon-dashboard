// Interface des catégories du calendrier : choisir une couleur, ajouter, renommer, supprimer.

import { h, vider, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { PALETTE } from '../schema.js';
import {
  categoriesAgenda,
  ajouterCategorieAgenda,
  modifierCategorieAgenda,
  supprimerCategorieAgenda,
  restaurerCategorieAgenda,
  usagesCategorieAgenda,
  nomDejaPris,
} from './agenda-donnees.js';

// Une rangée de pastilles de couleur. `surChoix(id)` est appelé au clic.
function choixCouleur({ valeur, surChoix, etiquette = 'Couleur' }) {
  const rangee = h('div', { class: 'echantillons', role: 'group', 'aria-label': etiquette });
  const dessiner = (actuelle) => {
    rangee.replaceChildren(
      ...PALETTE.map((p) =>
        h('button', {
          class: 'echantillon' + (p.id === actuelle ? ' actif' : ''),
          type: 'button',
          style: `--cat: var(--${p.id})`,
          title: p.nom,
          'aria-label': p.nom,
          'aria-pressed': p.id === actuelle ? 'true' : 'false',
          onclick: () => {
            dessiner(p.id);
            surChoix(p.id);
          },
        })
      )
    );
  };
  dessiner(valeur);
  return rangee;
}

// Petit formulaire « nouvelle catégorie ». Sans balise <form> : il se glisse aussi dans le formulaire d'un rendez-vous.
// `surAjout(categorie)` est appelé une fois la catégorie ajoutée.
export function formulaireNouvelleCategorieAgenda({ surAjout, surAnnulation = null }) {
  let couleur = 'rose';
  const champIcone = h('input', { class: 'champ champ-icone', type: 'text', value: '🏷️', maxLength: 8, 'aria-label': 'Icône' });
  const champNom = h('input', { class: 'champ', type: 'text', placeholder: 'Ex. Famille, Travail, Santé…', maxLength: 40, 'aria-label': 'Nom de la catégorie' });
  const message = h('p', { class: 'doux erreur-douce', role: 'status' });

  const valider = () => {
    const nom = champNom.value.trim();
    if (!nom) {
      champNom.classList.add('champ-erreur');
      champNom.focus();
      return;
    }
    if (nomDejaPris(store.lire(), nom)) {
      message.textContent = 'Une catégorie porte déjà ce nom.';
      champNom.focus();
      return;
    }
    let cat = null;
    store.modifier((d) => (cat = ajouterCategorieAgenda(d, { nom, couleur, icone: champIcone.value })));
    if (cat) surAjout(cat);
  };

  champNom.addEventListener('input', () => {
    champNom.classList.remove('champ-erreur');
    message.textContent = '';
  });
  champNom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // ne pas envoyer le formulaire qui contient ce champ
      valider();
    }
  });

  const element = h(
    'div',
    { class: 'pile nouvelle-categorie-agenda' },
    h('div', { class: 'rangee rangee-souple' }, champIcone, champNom),
    choixCouleur({ valeur: couleur, surChoix: (c) => (couleur = c) }),
    message,
    h(
      'div',
      { class: 'rangee' },
      h('button', { class: 'bouton bouton-jaune bouton-petit', type: 'button', onclick: valider }, 'Ajouter'),
      surAnnulation && h('button', { class: 'bouton bouton-petit', type: 'button', onclick: surAnnulation }, 'Annuler')
    )
  );
  return { element, focus: () => champNom.focus() };
}

function ligneCategorie(cat, donnees, redessiner) {
  const champIcone = h('input', { class: 'champ champ-icone', type: 'text', value: cat.icone, maxLength: 8, 'aria-label': `Icône de ${cat.nom}` });
  const champNom = h('input', { class: 'champ', type: 'text', value: cat.nom, maxLength: 40, 'aria-label': 'Nom de la catégorie' });
  const message = h('span', { class: 'meta erreur-douce', role: 'status' });

  const enregistrer = (couleur = cat.couleur) => {
    const nom = champNom.value.trim();
    if (!nom || nomDejaPris(store.lire(), nom, cat.id)) {
      champNom.value = cat.nom;
      message.textContent = nom ? 'Ce nom existe déjà.' : '';
      return;
    }
    message.textContent = '';
    store.modifier((d) => modifierCategorieAgenda(d, cat.id, { nom, couleur, icone: champIcone.value }));
    redessiner();
  };
  champIcone.addEventListener('change', () => enregistrer());
  champNom.addEventListener('change', () => enregistrer());
  champNom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') champNom.blur();
  });

  const usages = usagesCategorieAgenda(donnees, cat.id);
  const total = usages.rdv + usages.taches;

  return h(
    'li',
    { class: 'ligne ligne-categorie', style: `--cat: var(--${cat.couleur})` },
    champIcone,
    champNom,
    choixCouleur({ valeur: cat.couleur, surChoix: (c) => enregistrer(c), etiquette: `Couleur de ${cat.nom}` }),
    h('span', { class: 'meta mono' }, total ? `${total} élément${total > 1 ? 's' : ''}` : ''),
    h(
      'button',
      {
        class: 'bouton bouton-petit',
        type: 'button',
        'aria-label': `Supprimer la catégorie ${cat.nom}`,
        onclick: () => {
          let retire = null;
          store.modifier((d) => (retire = supprimerCategorieAgenda(d, cat.id)));
          redessiner();
          if (retire) {
            const nb = retire.rdvIds.length + retire.tacheIds.length;
            notifier(`« ${retire.categorie.nom} » supprimée${nb ? ` (${nb} élément${nb > 1 ? 's' : ''} passe${nb > 1 ? 'nt' : ''} en « Autre »)` : ''}`, {
              action: {
                label: 'Annuler',
                fn: () => {
                  store.modifier((d) => restaurerCategorieAgenda(d, retire));
                  redessiner();
                },
              },
            });
          }
        },
      },
      'Supprimer'
    ),
    message
  );
}

// La fenêtre de gestion. `surFermeture` : appelé quand elle se ferme (pour remettre à jour ce qui l'a ouverte).
export function ouvrirCategoriesAgenda({ surFermeture = null } = {}) {
  const zone = h('div', { class: 'pile' });
  let formulaireOuvert = false;

  const redessiner = () => {
    const donnees = store.lire();
    const liste = categoriesAgenda(donnees);
    vider(zone);
    zone.append(
      h(
        'p',
        { class: 'doux' },
        'Ces catégories servent à ranger tes rendez-vous et tes choses à faire dans le calendrier. Elles n’ajoutent pas de page dans le menu.'
      ),
      liste.length
        ? h('ul', { class: 'liste-simple' }, liste.map((c) => ligneCategorie(c, donnees, redessiner)))
        : h('p', { class: 'doux' }, 'Aucune catégorie pour l’instant : ajoutes-en une ci-dessous.'),
      formulaireOuvert
        ? (() => {
            const f = formulaireNouvelleCategorieAgenda({
              surAjout: () => {
                formulaireOuvert = false;
                redessiner();
              },
              surAnnulation: () => {
                formulaireOuvert = false;
                redessiner();
              },
            });
            setTimeout(() => f.focus(), 0);
            return f.element;
          })()
        : h(
            'div',
            { class: 'rangee' },
            h(
              'button',
              {
                class: 'bouton bouton-jaune',
                type: 'button',
                onclick: () => {
                  formulaireOuvert = true;
                  redessiner();
                },
              },
              '＋ Nouvelle catégorie'
            )
          )
    );
  };
  redessiner();

  const fenetre = ouvrirModale({
    titre: 'Mes catégories du calendrier',
    couleur: 'rose',
    large: true,
    corps: () => zone,
  });
  if (surFermeture) fenetre.surFermeture(surFermeture);
  return fenetre;
}
