// Page « Semaine » : tout ce qui est prévu, tous modules confondus, jour par jour.
// Les routines (quotidiennes) n'y figurent pas, pour garder la vue lisible.

import { h, vider, etincelles } from '../ui.js';
import * as store from '../store.js';
import { enregistrerPage, elementsDuJour, cleCoche, estCoche, editeurDe, actionCocheDe } from '../registry.js';
import { aujourdhui, ajouterJours, ajouterMois, premierDuMois, dernierDuMois, depuisCle, lundiDe, formatPlage, formatMois, jourCourt, jourDuMois, formatLong } from '../dates.js';
import { basculerCoche } from './taches.js';
import { trierRendezVous } from './rendezvous.js';
import { categorieDe, ouvrirAjoutTache } from './actions-taches.js';
import { ouvrirRendezVous, lieuOuLien } from './ui-rendezvous.js';
import { toutesLesCategories, filtrerParCategories } from './agenda-donnees.js';
import { ouvrirCategoriesAgenda } from './ui-agenda.js';

const VUES = [
  { id: 'jour', nom: 'Jour' },
  { id: 'semaine', nom: 'Semaine' },
  { id: 'mois', nom: 'Mois' },
];

let vue = 'semaine';
let dateVue = null; // null = aujourd'hui ; sinon une date « AAAA-MM-JJ » de la période regardée
const filtre = new Set(); // catégories gardées à l'écran (vide = tout voir)

function blocRendezVous(item, donnees) {
  const cat = categorieDe(donnees, item.categorieId);
  return h(
    'li',
    { class: 'rdv-semaine', style: `--cat: var(--${cat.couleur})` },
    h(
      'button',
      { class: 'rdv-semaine-bouton', type: 'button', title: 'Modifier ce rendez-vous', onclick: () => ouvrirRendezVous({ id: item.id }) },
      h('span', { class: 'mono rdv-semaine-heure' }, item.heure || 'Journée'),
      h('span', { class: 'rdv-semaine-titre' }, item.titre)
    ),
    lieuOuLien(item.lieu)
  );
}

function elementTache(item, donnees) {
  const cat = categorieDe(donnees, item.categorieId);
  const fait = estCoche(donnees, item);
  return h(
    'li',
    { class: 'tache-semaine' + (fait ? ' fait' : ''), style: `--cat: var(--${cat.couleur})`, 'data-cle': cleCoche(item) },
    h('input', {
      type: 'checkbox',
      class: 'case-boite case-petite',
      checked: fait,
      'aria-label': `Cocher « ${item.titre} »`,
      onchange: (ev) => {
        const action = actionCocheDe(item.source);
        if (action) {
          ev.target.checked = fait;
          action(item);
          return;
        }
        if (!fait) etincelles(document.querySelector(`[data-cle="${CSS.escape(cleCoche(item))}"] .case-boite`));
        store.modifier((d) => basculerCoche(d, cleCoche(item)));
      },
    }),
    h(
      'button',
      { class: 'titre-lien ligne-titre', type: 'button', title: 'Modifier', onclick: () => editeurDe(item.source)?.(item) },
      item.heure ? `${item.heure} · ${item.titre}` : item.titre
    )
  );
}

function colonneJour(date, reel, donnees, { detail = false } = {}) {
  const { rdv, taches } = contenuDuJour(date, donnees);
  const estAujourdhui = date === reel;
  const passe = date < reel;

  return h(
    'section',
    { class: 'jour-semaine' + (estAujourdhui ? ' aujourdhui' : '') + (passe ? ' passe' : '') + (detail ? ' jour-seul' : ''), 'aria-label': formatLong(date) },
    h(
      'header',
      { class: 'jour-entete' },
      h('div', null, h('span', { class: 'jour-nom' }, jourCourt(date)), h('span', { class: 'jour-numero mono' }, String(jourDuMois(date)))),
      h(
        'button',
        { class: 'bouton-icone', type: 'button', 'aria-label': `Ajouter un rendez-vous le ${formatLong(date).toLowerCase()}`, title: 'Ajouter un rendez-vous', onclick: () => ouvrirRendezVous({ date }) },
        '＋'
      )
    ),
    rdv.length + taches.length === 0
      ? h('p', { class: 'jour-vide' }, detail ? 'Rien de prévu ce jour ✦' : '·')
      : h('ul', { class: 'jour-liste' }, rdv.map((r) => blocRendezVous(r, donnees)), taches.map((t) => elementTache(t, donnees)))
  );
}

// Ce qui est visible pour un jour : rendez-vous puis tâches (sans routines ni éléments discrets).
// `filtrer: false` ignore le filtre par catégorie (pour la légende, qui montre tout ce qu'il y a).
function contenuDuJour(date, donnees, { filtrer = true } = {}) {
  const tous = elementsDuJour(date, donnees).filter((e) => !e.groupe && !e.discret);
  const elements = filtrer ? filtrerParCategories(donnees, tous, filtre) : tous;
  return {
    rdv: trierRendezVous(elements.filter((e) => e.type === 'rdv')),
    taches: elements.filter((e) => e.type === 'tache'),
  };
}

// ---- Vue « Mois » : une grille de semaines, un clic sur un jour l'ouvre ----

const NB_PUCES = 3;

function caseMois(date, mois, reel, donnees, versLeJour) {
  const { rdv, taches } = contenuDuJour(date, donnees);
  const tout = [...rdv, ...taches];
  const visibles = tout.slice(0, NB_PUCES);
  const reste = tout.length - visibles.length;
  const dansLeMois = date.slice(0, 7) === mois.slice(0, 7);

  return h(
    'div',
    {
      class: 'case-mois' + (date === reel ? ' aujourdhui' : '') + (dansLeMois ? '' : ' hors-mois') + (tout.length ? ' remplie' : ''),
      onclick: () => versLeJour(date),
    },
    h(
      'button',
      {
        class: 'case-mois-numero mono',
        type: 'button',
        'aria-label': `${formatLong(date)}${tout.length ? ` : ${tout.length} élément${tout.length > 1 ? 's' : ''}` : ''}`,
        onclick: (e) => {
          e.stopPropagation();
          versLeJour(date);
        },
      },
      String(jourDuMois(date))
    ),
    tout.length > 0 &&
      h(
        'ul',
        { class: 'case-mois-liste' },
        visibles.map((item) => {
          const cat = categorieDe(donnees, item.categorieId);
          const fait = item.type === 'tache' && estCoche(donnees, item);
          return h(
            'li',
            { class: 'puce-mois' + (item.type === 'rdv' ? ' rdv' : '') + (fait ? ' fait' : ''), style: `--cat: var(--${cat.couleur})`, title: item.titre },
            item.heure ? `${item.heure} ${item.titre}` : item.titre
          );
        }),
        reste > 0 && h('li', { class: 'puce-reste mono' }, `+ ${reste}`)
      ),
    // Petits écrans : seulement des points colorés.
    tout.length > 0 &&
      h(
        'span',
        { class: 'points-mois', 'aria-hidden': 'true' },
        visibles.map((item) => h('span', { class: 'point-mois', style: `--cat: var(--${categorieDe(donnees, item.categorieId).couleur})` }))
      )
  );
}

function grilleMois(date, reel, donnees, versLeJour) {
  const premier = premierDuMois(date);
  const debut = lundiDe(premier);
  const fin = lundiDe(dernierDuMois(date));
  const jours = [];
  for (let j = debut; j <= ajouterJours(fin, 6); j = ajouterJours(j, 1)) jours.push(j);
  const noms = jours.slice(0, 7).map((j) => jourCourt(j));
  return h(
    'div',
    { class: 'grille-mois', role: 'grid', 'aria-label': formatMois(premier) },
    noms.map((n) => h('div', { class: 'mois-nom-jour mono', 'aria-hidden': 'true' }, n)),
    jours.map((j) => caseMois(j, premier, reel, donnees, versLeJour))
  );
}

// « Aujourd'hui », « Demain », « Dans 3 jours », « Il y a 2 jours »…
function texteRelatif(date, reel) {
  const ecart = Math.round((depuisCle(date) - depuisCle(reel)) / 86400000);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return 'Demain';
  if (ecart === -1) return 'Hier';
  return ecart > 0 ? `Dans ${ecart} jours` : `Il y a ${-ecart} jours`;
}

// ---- La page ----

function rendre(racine, { redessiner }) {
  const donnees = store.lire();
  const reel = aujourdhui();
  const date = dateVue || reel;
  const lundi = lundiDe(date);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));

  const estCourant =
    vue === 'jour' ? date === reel : vue === 'semaine' ? lundi === lundiDe(reel) : premierDuMois(date) === premierDuMois(reel);
  const unite = { jour: 'Aujourd’hui', semaine: 'Cette semaine', mois: 'Ce mois-ci' }[vue];

  const placer = (cible) => {
    dateVue = cible === reel ? null : cible;
    redessiner();
  };
  const aller = (sens) => {
    if (vue === 'jour') placer(ajouterJours(date, sens));
    else if (vue === 'semaine') placer(ajouterJours(date, sens * 7));
    else {
      const cible = ajouterMois(date, sens);
      placer(premierDuMois(cible) === premierDuMois(reel) ? reel : cible);
    }
  };
  const versLeJour = (cible) => {
    vue = 'jour';
    placer(cible);
  };

  // Les jours dont on compte le contenu, selon la vue.
  const joursComptes =
    vue === 'jour'
      ? [date]
      : vue === 'semaine'
        ? jours
        : (() => {
            const liste = [];
            for (let j = premierDuMois(date); j <= dernierDuMois(date); j = ajouterJours(j, 1)) liste.push(j);
            return liste;
          })();
  let nbRdv = 0;
  let nbTaches = 0;
  const utilisees = new Set(); // les catégories présentes dans la période (filtre ignoré) : la légende et le filtre
  for (const j of joursComptes) {
    const c = contenuDuJour(j, donnees);
    nbRdv += c.rdv.length;
    nbTaches += c.taches.length;
    const toutes = contenuDuJour(j, donnees, { filtrer: false });
    for (const item of [...toutes.rdv, ...toutes.taches]) utilisees.add(categorieDe(donnees, item.categorieId).id);
  }
  // Une catégorie filtrée reste proposée même si elle est absente de cette période, pour pouvoir la retirer.
  const legende = toutesLesCategories(donnees).filter((c) => utilisees.has(c.id) || filtre.has(c.id));

  let titre;
  let sousTitre;
  if (vue === 'jour') {
    titre = formatLong(date);
    sousTitre = texteRelatif(date, reel);
  } else if (vue === 'semaine') {
    titre = lundi === lundiDe(reel) ? 'Cette semaine' : 'Semaine';
    sousTitre = formatPlage(lundi, jours[6]);
  } else {
    titre = formatMois(date);
    sousTitre = 'Clique sur un jour pour l’ouvrir';
  }

  const dateAjout = estCourant ? reel : vue === 'jour' ? date : vue === 'semaine' ? lundi : premierDuMois(date);
  const mot = { jour: 'jour', semaine: 'semaine', mois: 'mois' }[vue];
  const precedent = { jour: 'Jour précédent', semaine: 'Semaine précédente', mois: 'Mois précédent' }[vue];
  const suivant = { jour: 'Jour suivant', semaine: 'Semaine suivante', mois: 'Mois suivant' }[vue];

  let corps;
  if (vue === 'mois') corps = grilleMois(date, reel, donnees, versLeJour);
  else if (vue === 'jour') corps = h('div', { class: 'grille-semaine grille-jour' }, colonneJour(date, reel, donnees, { detail: true }));
  else corps = h('div', { class: 'grille-semaine' }, jours.map((j) => colonneJour(j, reel, donnees)));

  const page = h(
    'div',
    { class: 'page page-semaine vue-' + vue },
    h(
      'header',
      { class: 'entete-page' },
      h('div', null, h('h1', null, titre), h('p', { class: 'sous-titre mono' }, sousTitre)),
      h(
        'div',
        { class: 'rangee rangee-souple' },
        h(
          'div',
          { class: 'choix-vue', role: 'group', 'aria-label': 'Façon de voir le calendrier' },
          VUES.map((v) =>
            h(
              'button',
              {
                class: 'choix-vue-bouton' + (v.id === vue ? ' actif' : ''),
                type: 'button',
                'aria-pressed': v.id === vue ? 'true' : 'false',
                onclick: () => {
                  if (v.id === vue) return;
                  vue = v.id;
                  redessiner();
                },
              },
              v.nom
            )
          )
        ),
        h(
          'nav',
          { class: 'rangee rangee-souple', 'aria-label': `Changer de ${mot}` },
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': precedent, onclick: () => aller(-1) }, '◀'),
          !estCourant && h('button', { class: 'bouton', type: 'button', onclick: () => placer(reel) }, unite),
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': suivant, onclick: () => aller(1) }, '▶')
        )
      )
    ),
    h(
      'div',
      { class: 'barre-actions' },
      h('p', { class: 'mono doux resume-semaine' }, `${nbRdv} rendez-vous · ${nbTaches} chose${nbTaches > 1 ? 's' : ''} à faire${filtre.size ? ' (filtré)' : ''}`),
      h(
        'div',
        { class: 'rangee rangee-souple' },
        h('button', { class: 'bouton', type: 'button', title: 'Perso, Social, Rendez-vous… : ajouter, renommer, supprimer', onclick: () => ouvrirCategoriesAgenda() }, '🏷️ Catégories'),
        h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirAjoutTache({ date: dateAjout }) }, '＋ Tâche'),
        h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirRendezVous({ date: dateAjout }) }, '＋ Rendez-vous')
      )
    ),
    legende.length > 0 &&
      h(
        'div',
        { class: 'legende-calendrier', role: 'group', 'aria-label': 'Filtrer par catégorie' },
        legende.map((c) => {
          const actif = filtre.has(c.id);
          return h(
            'button',
            {
              class: 'puce-filtre' + (actif ? ' actif' : ''),
              type: 'button',
              style: `--cat: var(--${c.couleur})`,
              'aria-pressed': actif ? 'true' : 'false',
              title: actif ? 'Cliquer pour ne plus filtrer' : 'Cliquer pour ne voir que cette catégorie',
              onclick: () => {
                if (actif) filtre.delete(c.id);
                else filtre.add(c.id);
                redessiner();
              },
            },
            h('span', { class: 'pastille-cat', 'aria-hidden': 'true' }),
            `${c.icone} ${c.nom}`
          );
        }),
        filtre.size > 0 &&
          h(
            'button',
            {
              class: 'puce-action',
              type: 'button',
              onclick: () => {
                filtre.clear();
                redessiner();
              },
            },
            '✕ Tout voir'
          )
      ),
    corps
  );

  vider(racine);
  racine.append(page);
}

enregistrerPage('semaine', rendre);
