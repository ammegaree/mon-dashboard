// Page du domaine « Nourriture » : planning des repas de la semaine et liste de courses.
// Aucun compteur de calories ni de macros : on planifie, on ne mesure pas.

import { h, vider, pastilles, notifier } from '../ui.js';
import { enregistrerPageDomaine } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours, lundiDe, formatPlage, formatLong, jourCourt, jourDuMois } from '../dates.js';
import * as N from './nourriture-donnees.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { rendreVueEnsemble } from './vue-ensemble.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';
import { ouvrirRepas, ouvrirRecette } from './ui-nourriture.js';

const ONGLETS = [
  { id: 'ensemble', titre: "Vue d'ensemble", icone: '🥑' },
  { id: 'planning', titre: 'Planning des repas', icone: '🍽️' },
  { id: 'courses', titre: 'Liste de courses', icone: '🛒' },
  { id: 'recettes', titre: 'Recettes', icone: '📖' },
];

let onglet = 'ensemble';
enregistrerReinitialisationOnglets(() => (onglet = 'ensemble'));
let lundiVu = null;
let focusCourse = false;
let toutAfficher = lirePrefTout();

// Petit-déjeuner et collation : repliés par défaut pour garder la grille légère (préférence d'affichage seulement).
function lirePrefTout() {
  try {
    return localStorage.getItem('dashboard-repas-tout') === '1';
  } catch {
    return false;
  }
}
function ecrirePrefTout(v) {
  try {
    localStorage.setItem('dashboard-repas-tout', v ? '1' : '0');
  } catch {
    /* sans importance */
  }
}

// ---- Planning ----

function celluleRepas(date, moment, repas, donnees, reel) {
  const m = N.momentParId(moment);
  return h(
    'div',
    { class: 'repas-cellule' + (date === reel ? ' aujourdhui' : '') },
    h('span', { class: 'repas-etiquette' }, `${m.icone} ${m.court}`),
    repas.map((r) =>
      h(
        'button',
        { class: 'repas-bouton', type: 'button', title: r.ingredients.length ? `Ingrédients : ${r.ingredients.join(', ')}` : 'Modifier ce repas', onclick: () => ouvrirRepas({ id: r.id }) },
        r.texte
      )
    ),
    h(
      'button',
      { class: 'repas-ajouter', type: 'button', title: `Ajouter : ${N.momentParId(moment).nom}, ${formatLong(date).toLowerCase()}`, 'aria-label': `Ajouter un repas, ${N.momentParId(moment).nom}, ${formatLong(date).toLowerCase()}`, onclick: () => ouvrirRepas({ date, moment }) },
      '＋'
    )
  );
}

function rendrePlanning(conteneur, ctx) {
  const donnees = store.lire();
  const reel = aujourdhui();
  const lundi = lundiVu || lundiDe(reel);
  const estCourante = lundi === lundiDe(reel);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
  const grille = N.planningSemaine(donnees, lundi);
  const nbIngredients = N.ingredientsDeLaSemaine(donnees, lundi).length;
  const aller = (n) => {
    const cible = ajouterJours(lundi, 7 * n);
    lundiVu = cible === lundiDe(reel) ? null : cible;
    ctx.redessiner();
  };

  // Une ligne par jour : la date à gauche, les repas à droite. Rien ne déborde, rien n'est coupé.
  // Déjeuner et dîner toujours ; les deux autres seulement si on les affiche, ou s'ils servent déjà cette semaine.
  const sert = (m) => jours.some((date) => grille[date][m.id].length > 0);
  const momentsVus = N.MOMENTS.filter((m) => toutAfficher || m.id === 'dejeuner' || m.id === 'diner' || sert(m));
  const masquables = N.MOMENTS.some((m) => m.id !== 'dejeuner' && m.id !== 'diner' && !sert(m));
  const lignes = jours.map((date) =>
    h(
      'section',
      { class: 'jour-semaine' + (date === reel ? ' aujourdhui' : '') + (date < reel ? ' passe' : ''), 'aria-label': formatLong(date) },
      h('header', { class: 'jour-entete' }, h('div', null, h('span', { class: 'jour-nom' }, jourCourt(date)), h('span', { class: 'jour-numero mono' }, String(jourDuMois(date))))),
      h('div', { class: 'repas-creneaux' }, momentsVus.map((m) => celluleRepas(date, m.id, grille[date][m.id], donnees, reel)))
    )
  );

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'barre-actions' },
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Semaine précédente', onclick: () => aller(-1) }, '◀'),
          h('strong', { class: 'titre-periode' }, formatPlage(lundi, jours[6])),
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Semaine suivante', onclick: () => aller(1) }, '▶'),
          !estCourante && h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { lundiVu = null; ctx.redessiner(); } }, 'Cette semaine')
        ),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h(
            'button',
            {
              class: 'bouton',
              type: 'button',
              disabled: nbIngredients === 0,
              title: nbIngredients === 0 ? "Ajoute des ingrédients à tes repas pour pouvoir les envoyer dans la liste" : '',
              onclick: () => {
                let ajoutes = 0;
                store.modifier((d) => (ajoutes = N.ajouterDepuisPlanning(d, lundi)));
                notifier(ajoutes > 0 ? `${ajoutes} ingrédient${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''} à ta liste de courses ✦` : 'Tout est déjà dans ta liste ✦');
              },
            },
            '🛒 Vers ma liste de courses'
          ),
          h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirRepas({ date: estCourante ? reel : lundi }) }, '＋ Repas')
        )
      ),
      h('div', { class: 'grille-semaine' }, lignes),
      masquables &&
        h(
          'div',
          { class: 'barre-discrete' },
          h(
            'button',
            {
              class: 'bouton bouton-petit',
              type: 'button',
              onclick: () => {
                toutAfficher = !toutAfficher;
                ecrirePrefTout(toutAfficher);
                ctx.redessiner();
              },
            },
            toutAfficher ? '− Masquer petit-déj et collation' : '＋ Petit-déj et collation'
          )
        )
    )
  );
}

// ---- Liste de courses ----

function rendreCourses(conteneur, ctx) {
  const donnees = store.lire();
  const { courses } = donnees.nourriture;
  const aAcheter = courses.filter((c) => !c.coche);
  const cochees = courses.filter((c) => c.coche);
  const lundiCourant = lundiDe(aujourdhui());

  const champ = h('input', { type: 'text', class: 'champ', placeholder: 'Ajouter un article… (Entrée)', maxLength: 120, 'aria-label': 'Nouvel article', id: 'nouvel-article' });
  const ajouter = () => {
    const t = champ.value.trim();
    if (!t) return;
    focusCourse = true;
    store.modifier((d) => N.ajouterCourse(d, { texte: t }));
  };
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ajouter();
    }
  });

  const ligne = (c) =>
    h(
      'li',
      { class: 'ligne' + (c.coche ? ' fait' : '') },
      h(
        'label',
        { class: 'case' },
        h('input', { type: 'checkbox', class: 'case-boite', checked: c.coche, onchange: () => store.modifier((d) => N.basculerCourse(d, c.id)) }),
        h('span', { class: 'ligne-titre' }, c.texte)
      ),
      h(
        'button',
        {
          class: 'bouton-icone',
          type: 'button',
          title: 'Retirer',
          'aria-label': `Retirer « ${c.texte} »`,
          onclick: () => {
            let retire = null;
            store.modifier((d) => (retire = N.supprimerCourse(d, c.id)));
            if (retire) notifier(`« ${c.texte} » retiré`, { action: { label: 'Annuler', fn: () => store.modifier((d) => N.restaurerCourse(d, retire)) } });
          },
        },
        '✕'
      )
    );

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ma liste de courses'), h('span', { class: 'mono' }, aAcheter.length ? `${aAcheter.length} à acheter` : '')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('div', { class: 'rangee' }, champ, h('button', { class: 'bouton', type: 'button', onclick: ajouter }, 'Ajouter')),
          courses.length === 0
            ? h('p', { class: 'doux' }, "Ta liste est vide. Ajoute des articles à la main, ou envoie-y les ingrédients de ton planning de repas.")
            : h('ul', { class: 'liste-simple' }, aAcheter.map(ligne), cochees.map(ligne)),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h(
              'button',
              {
                class: 'bouton bouton-petit',
                type: 'button',
                onclick: () => {
                  let ajoutes = 0;
                  store.modifier((d) => (ajoutes = N.ajouterDepuisPlanning(d, lundiCourant)));
                  notifier(ajoutes > 0 ? `${ajoutes} ingrédient${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''} ✦` : 'Rien de nouveau dans le planning de cette semaine.');
                },
              },
              '🍽️ Ajouter les repas de la semaine'
            ),
            cochees.length > 0 &&
              h(
                'button',
                {
                  class: 'bouton bouton-petit',
                  type: 'button',
                  onclick: () => {
                    let retirees = [];
                    store.modifier((d) => (retirees = N.retirerCochees(d)));
                    notifier(`${retirees.length} article${retirees.length > 1 ? 's' : ''} retiré${retirees.length > 1 ? 's' : ''}`, {
                      action: { label: 'Annuler', fn: () => store.modifier((d) => N.restaurerCochees(d, retirees)) },
                    });
                  },
                },
                `Retirer les ${cochees.length} cochés`
              )
          )
        )
      )
    )
  );

  if (focusCourse) {
    focusCourse = false;
    setTimeout(() => document.getElementById('nouvel-article')?.focus(), 0);
  }
}

// ---- Recettes ----

let rechercheRecette = '';

function rendreRecettes(conteneur) {
  const donnees = store.lire();
  const total = donnees.nourriture.recettes.length;
  const zoneListe = h('div', { class: 'pile' });
  const dessiner = () => {
    const liste = N.recettesTriees(donnees, rechercheRecette);
    vider(zoneListe);
    if (!liste.length) {
      zoneListe.append(h('p', { class: 'vide' }, rechercheRecette ? 'Aucune recette ne correspond.' : 'Tes recettes iront ici : tu peux en créer une, ou en adapter une depuis une idée de ton brain dump.'));
      return;
    }
    zoneListe.append(
      h(
        'ul',
        { class: 'liste-simple' },
        liste.map((r) =>
          h(
            'li',
            { class: 'ligne ligne-tache-maison' },
            h(
              'div',
              { class: 'ligne-bloc' },
              h('button', { class: 'titre-cliquable', type: 'button', title: 'Ouvrir cette recette', onclick: () => ouvrirRecette({ id: r.id }) }, r.titre),
              h('span', { class: 'meta' }, `${r.ingredients.length} ingrédient${r.ingredients.length > 1 ? 's' : ''}`)
            )
          )
        )
      )
    );
  };
  dessiner();
  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'barre-actions' },
        h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirRecette({}) }, '＋ Recette'),
        total >= 6 &&
          h('input', {
            type: 'search',
            class: 'champ champ-recherche',
            placeholder: 'Chercher une recette ou un ingrédient…',
            value: rechercheRecette,
            'aria-label': 'Chercher une recette',
            oninput: (e) => {
              rechercheRecette = e.target.value;
              dessiner();
            },
          })
      ),
      zoneListe
    )
  );
}

// ---- Page ----

// Vue d'ensemble : les repas du jour et des jours à venir (le planning et la liste ont déjà leurs onglets).
const RENDUS = { ensemble: rendreVueEnsemble(), planning: rendrePlanning, courses: rendreCourses, recettes: rendreRecettes };

function rendre(racine, { redessiner, categorieId }) {
  const donnees = store.lire();
  const cat = donnees.categories.find((c) => c.id === categorieId);
  const contenu = h('div', { class: 'etudes-contenu' });
  const aller = (id) => {
    onglet = id;
    redessiner();
  };
  RENDUS[onglet](contenu, { redessiner, aller, categorieId });
  const aAcheter = donnees.nourriture.courses.filter((c) => !c.coche).length;

  vider(racine);
  racine.append(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'entete-page' },
        h('div', null, h('h1', null, `${cat?.icone || '🥑'} ${cat?.nom || 'Nourriture'}`), h('p', { class: 'sous-titre' }, 'Planifier, simplement. Sans compter.')),
        h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirBrainDump({ categorieId }) }, libelleBrainDump(store.lire(), categorieId))
      ),
      barreOnglets({
        onglets: ONGLETS.map((o) => (o.id === 'courses' && aAcheter ? { ...o, titre: `${o.titre} (${aAcheter})` } : o)),
        actif: onglet,
        surChoix: (id) => {
          onglet = id;
          redessiner();
        },
      }),
      contenu
    )
  );
}

enregistrerPageDomaine('nourriture', rendre);
