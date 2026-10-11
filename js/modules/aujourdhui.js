// Page « Aujourd'hui » : l'accueil, volontairement simple.
// La date, une fine barre de progression, les choses du jour rangées par catégorie,
// et en bas les routines et les reports, repliés.

import { h, vider, pastilles, etincelles, confettis } from '../ui.js';
import * as store from '../store.js';
import { enregistrerPage, elementsDuJour, cleCoche, estCoche, elementsEnRetard, reporterElement, abandonnerElement } from '../registry.js';
import { aujourdhui, ajouterJours, formatLong, formatCourt, nomDuJour, jourSemaine } from '../dates.js';
import * as T from './taches.js';
import * as R from './routines.js';
import { categorieDe, ouvrirAjoutTache, ouvrirRecurrentes, ligneTache, ligneInfo } from './actions-taches.js';
import { ligneRendezVous } from './ui-rendezvous.js';
import { trierRendezVous } from './rendezvous.js';
import { phraseDuJour, checkinDuJour } from './bien-etre-donnees.js';
import { bilanEnAttente, prioritesDeLaSemaine } from './bilan-donnees.js';
import { preparationEnAttente } from './preparation-donnees.js';
import { ouvrirBrainDump } from './ui-carnet.js';
import { ouvrirCheckin } from './bien-etre-checkin.js';

// ---- État de la page (le temps de la visite) ----
let dateVue = null; // null = le vrai jour d'aujourd'hui
let routineEnEdition = null;
let celebrer = false;
const ouverts = new Set(); // blocs repliables ouverts : 'routine:matin', 'report'

function libelleJour(date, reel) {
  if (date === reel) return "Aujourd'hui";
  if (date === ajouterJours(reel, -1)) return 'Hier';
  if (date === ajouterJours(reel, 1)) return 'Demain';
  return nomDuJour(date);
}

// ---- Cocher ----

function cocher(item, { restants, total }) {
  const donnees = store.lire();
  if (!estCoche(donnees, item)) {
    // Les étincelles sont posées sur la page (pas dans la carte) : elles survivent au rafraîchissement.
    const boite = document.querySelector(`[data-cle="${CSS.escape(cleCoche(item))}"] .case-boite`);
    etincelles(boite);
    if (restants === 1 && total > 0) celebrer = true;
  }
  store.modifier((d) => T.basculerCoche(d, cleCoche(item)));
}

// ---- Morceaux de page ----

function progression({ total, faits }) {
  const pourcent = total ? Math.round((faits / total) * 100) : 0;
  const termine = total > 0 && faits === total;
  let texte;
  if (total === 0) texte = 'Rien de prévu';
  else if (termine) texte = 'Journée terminée ✨';
  else texte = `${faits} sur ${total}`;
  return h(
    'div',
    { class: 'progression-fine' + (termine ? ' complete' : '') },
    h(
      'div',
      { class: 'barre-progression', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent, 'aria-label': 'Progression de la journée' },
      h('div', { class: 'remplissage', style: `width: ${pourcent}%` })
    ),
    h('span', { class: 'progression-texte mono' }, texte)
  );
}

// Le bilan de la semaine est prêt : une invitation, jamais une obligation.
function encartBilan(dimanche) {
  return h(
    'aside',
    { class: 'encart-bilan', 'aria-label': 'Bilan de la semaine' },
    h('span', { class: 'encart-etoile', 'aria-hidden': 'true' }, '🌟'),
    h(
      'p',
      { class: 'encart-texte' },
      dimanche ? "C'est dimanche : un bon moment pour faire le point sur ta semaine." : 'Ton bilan de la semaine dernière est prêt, quand tu veux.'
    ),
    h('a', { class: 'bouton bouton-petit bouton-jaune', href: '#/bilan' }, 'Faire mon bilan')
  );
}

// La semaine qui vient n'est pas encore préparée : une invitation (dimanche après le bilan, ou le lundi).
function encartPreparation() {
  return h(
    'aside',
    { class: 'encart-bilan', 'aria-label': 'Préparer la semaine' },
    h('span', { class: 'encart-etoile', 'aria-hidden': 'true' }, '🧭'),
    h('p', { class: 'encart-texte' }, 'Cinq minutes pour regarder ta semaine : rendez-vous, priorités, sport, repas, sous.'),
    h('a', { class: 'bouton bouton-petit bouton-jaune', href: '#/preparer' }, 'Préparer ma semaine')
  );
}

// Les priorités choisies lors du bilan, pendant la semaine qui suit.
function encartPriorites(priorites) {
  const visibles = priorites.slice(0, 3);
  return h(
    'aside',
    { class: 'encart-priorites', 'aria-label': 'Mes priorités de la semaine' },
    h('strong', null, '🎯 Mes priorités de la semaine'),
    h('ul', null, visibles.map((p) => h('li', null, p)), priorites.length > 3 && h('li', { class: 'meta' }, `+ ${priorites.length - 3} autre${priorites.length - 3 > 1 ? 's' : ''} dans ton bilan`))
  );
}

// L'encart motivation : une phrase par jour, discrète.
function encartMotivation(phrase) {
  return h(
    'aside',
    { class: 'encart-motivation', 'aria-label': 'Ma phrase du jour' },
    h('span', { class: 'encart-etoile', 'aria-hidden': 'true' }, '✦'),
    h('p', { class: 'encart-texte' }, phrase.texte),
    phrase.auteur && h('span', { class: 'encart-auteur mono' }, `— ${phrase.auteur}`),
    phrase.type === 'pourquoi' && h('span', { class: 'encart-auteur mono' }, '— mon pourquoi')
  );
}

function rendezVous(rdv, donnees) {
  return h('ul', { class: 'liste-rdv', 'aria-label': 'Rendez-vous du jour' }, rdv.map((r) => ligneRendezVous(r, donnees)));
}

function carteCategorie(cat, items, infos, donnees, contexte) {
  const faits = items.filter((i) => estCoche(donnees, i)).length;
  return h(
    'section',
    { class: 'fenetre carte-categorie', style: `--cat: var(--${cat.couleur})` },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, `${cat.icone} ${cat.nom}`), items.length > 0 && h('span', { class: 'mono' }, `${faits}/${items.length}`)),
    h(
      'ul',
      { class: 'fenetre-corps liste' },
      items.map((i) => ligneTache(i, donnees, { surCoche: (it) => cocher(it, contexte) })),
      infos.map((i) => ligneInfo(i))
    )
  );
}

// Un bloc qui se replie : une seule ligne tant qu'on ne l'ouvre pas.
function blocRepliable({ cle, couleur, titre, compteur, corps, forcerOuvert = false }) {
  return h(
    'details',
    {
      class: 'fenetre repliable',
      style: `--cat: var(--${couleur})`,
      open: ouverts.has(cle) || forcerOuvert,
      ontoggle: (e) => (e.currentTarget.open ? ouverts.add(cle) : ouverts.delete(cle)),
    },
    h('summary', { class: 'fenetre-barre' }, h('span', { class: 'marqueur', 'aria-hidden': 'true' }, '▸'), h('strong', { class: 'fenetre-titre' }, titre), compteur && h('span', { class: 'mono' }, compteur)),
    h('div', { class: 'fenetre-corps' }, corps)
  );
}

function editeurRoutine(routine) {
  const brouillon = routine.etapes.map((e) => ({ id: e.id, titre: e.titre }));
  const liste = h('ul', { class: 'liste-simple editeur-etapes' });
  const champAjout = h('input', { type: 'text', class: 'champ', placeholder: 'Nouvelle étape…', maxLength: 120, 'aria-label': 'Nouvelle étape' });

  const dessiner = (focusIndex = null) => {
    vider(liste);
    brouillon.forEach((etape, i) => {
      const champ = h('input', {
        type: 'text',
        class: 'champ',
        value: etape.titre,
        maxLength: 120,
        'aria-label': `Étape ${i + 1}`,
        oninput: (e) => (brouillon[i].titre = e.target.value),
      });
      liste.append(
        h(
          'li',
          { class: 'ligne ligne-simple' },
          champ,
          h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Monter', disabled: i === 0, onclick: () => { [brouillon[i - 1], brouillon[i]] = [brouillon[i], brouillon[i - 1]]; dessiner(i - 1); } }, '↑'),
          h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Descendre', disabled: i === brouillon.length - 1, onclick: () => { [brouillon[i + 1], brouillon[i]] = [brouillon[i], brouillon[i + 1]]; dessiner(i + 1); } }, '↓'),
          h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Retirer cette étape', onclick: () => { brouillon.splice(i, 1); dessiner(); } }, '✕')
        )
      );
      if (focusIndex === i) setTimeout(() => champ.focus(), 0);
    });
  };

  const ajouter = () => {
    const titre = champAjout.value.trim();
    if (!titre) return;
    brouillon.push({ id: null, titre });
    champAjout.value = '';
    dessiner();
    champAjout.focus();
  };
  champAjout.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ajouter();
    }
  });

  dessiner();
  return { liste, champAjout, ajouter, lireBrouillon: () => brouillon };
}

function blocRoutine(routine, donnees, elements, contexte, redessiner) {
  const items = elements.filter((e) => e.groupe === `routine:${routine.id}`);
  const faits = items.filter((i) => estCoche(donnees, i)).length;
  const enEdition = routineEnEdition === routine.id;
  const cle = `routine:${routine.id}`;

  let corps;
  if (enEdition) {
    const editeur = editeurRoutine(routine);
    corps = h(
      'div',
      { class: 'pile' },
      h('p', { class: 'doux' }, "Tes étapes, dans l'ordre. Elles reviendront chaque jour avec des cases vierges."),
      editeur.liste,
      h('div', { class: 'rangee' }, editeur.champAjout, h('button', { class: 'bouton', type: 'button', onclick: editeur.ajouter }, 'Ajouter')),
      h(
        'div',
        { class: 'rangee droite' },
        h('button', { class: 'bouton', type: 'button', onclick: () => { routineEnEdition = null; redessiner(); } }, 'Annuler'),
        h(
          'button',
          {
            class: 'bouton bouton-jaune',
            type: 'button',
            onclick: () => {
              // Une étape tapée mais pas encore « ajoutée » ne doit pas se perdre.
              editeur.ajouter();
              const brouillon = editeur.lireBrouillon();
              routineEnEdition = null;
              store.modifier((d) => R.enregistrerEtapes(d, routine.id, brouillon));
            },
          },
          'Enregistrer'
        )
      )
    );
  } else if (items.length === 0) {
    corps = h(
      'div',
      { class: 'pile' },
      h('p', { class: 'doux' }, "Pas encore d'étapes. Ajoute celles qui te font du bien (un verre d'eau, quelques étirements…)."),
      h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { routineEnEdition = routine.id; ouverts.add(cle); redessiner(); } }, '＋ Ajouter des étapes'))
    );
  } else {
    corps = h(
      'div',
      { class: 'pile' },
      h('ul', { class: 'liste' }, items.map((i) => ligneTache(i, donnees, { modifiable: false, surCoche: (it) => cocher(it, contexte) }))),
      h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { routineEnEdition = routine.id; redessiner(); } }, '✎ Modifier les étapes'))
    );
  }

  return blocRepliable({
    cle,
    couleur: 'creme-fonce',
    titre: `${routine.icone} ${routine.nom}`,
    compteur: items.length ? `${faits}/${items.length}` : null,
    corps,
    forcerOuvert: enEdition,
  });
}

function blocReport(enRetard, donnees, reel) {
  const corps = h(
    'div',
    { class: 'pile' },
    h('p', { class: 'doux' }, "Ces choses n'ont pas été faites. Rien de grave : choisis ce que tu veux garder pour aujourd'hui."),
    h(
      'ul',
      { class: 'liste-simple' },
      enRetard.map((t) => {
        const cat = categorieDe(donnees, t.categorieId);
        return h(
          'li',
          { class: 'ligne ligne-simple', style: `--cat: var(--${cat.couleur})` },
          h('span', { class: 'pastille-cat', 'aria-hidden': 'true' }),
          h('div', { class: 'ligne-bloc' }, h('strong', null, t.titre), h('span', { class: 'meta' }, `${cat.icone} ${cat.nom} · prévu ${formatCourt(t.date)}`)),
          h('button', { class: 'bouton bouton-petit bouton-turquoise', type: 'button', onclick: () => store.modifier((d) => reporterElement(d, t, reel)) }, "Pour aujourd'hui"),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => store.modifier((d) => abandonnerElement(d, t)) }, 'Laisser partir')
        );
      })
    ),
    enRetard.length > 1 &&
      h(
        'div',
        { class: 'rangee droite' },
        h('button', { class: 'bouton', type: 'button', onclick: () => store.modifier((d) => enRetard.forEach((t) => reporterElement(d, t, reel))) }, "Tout garder pour aujourd'hui")
      )
  );
  return blocRepliable({
    cle: 'report',
    couleur: 'rose',
    titre: enRetard.length === 1 ? '1 chose à reporter ?' : `${enRetard.length} choses à reporter ?`,
    corps,
  });
}

// ---- Page ----

function rendre(racine, { redessiner }) {
  const donnees = store.lire();
  const reel = aujourdhui();
  const date = dateVue && dateVue !== reel ? dateVue : reel;
  const estAujourdhui = date === reel;

  const elements = elementsDuJour(date, donnees);
  const rdv = trierRendezVous(elements.filter((e) => e.type === 'rdv'));
  const acocher = elements.filter((e) => e.type === 'tache');
  const faits = acocher.filter((e) => estCoche(donnees, e)).length;
  const contexte = { total: acocher.length, restants: acocher.length - faits };

  // Tâches groupées par catégorie (les routines ont leurs propres blocs).
  const parCategorie = new Map();
  const range = (item, cle) => {
    const cat = categorieDe(donnees, item.categorieId);
    if (!parCategorie.has(cat.id)) parCategorie.set(cat.id, { items: [], infos: [] });
    parCategorie.get(cat.id)[cle].push(item);
  };
  for (const item of acocher.filter((e) => !e.groupe)) range(item, 'items');
  for (const item of elements.filter((e) => e.type === 'info' && !e.groupe)) range(item, 'infos');
  const cartes = donnees.categories
    .filter((c) => parCategorie.has(c.id))
    .map((c) => carteCategorie(c, parCategorie.get(c.id).items, parCategorie.get(c.id).infos, donnees, contexte));

  const enRetard = estAujourdhui ? elementsEnRetard(donnees, reel) : [];
  const blocsBas = [
    ...donnees.routines.map((r) => blocRoutine(r, donnees, elements, contexte, redessiner)),
    enRetard.length > 0 && blocReport(enRetard, donnees, reel),
  ];

  const page = h(
    'div',
    { class: 'page page-aujourdhui' },
    h(
      'header',
      { class: 'entete-page' },
      h('div', null, h('h1', null, libelleJour(date, reel)), h('p', { class: 'sous-titre mono' }, formatLong(date))),
      h(
        'nav',
        { class: 'rangee', 'aria-label': 'Changer de jour' },
        h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Jour précédent', onclick: () => { dateVue = ajouterJours(date, -1); redessiner(); } }, '◀'),
        !estAujourdhui && h('button', { class: 'bouton', type: 'button', onclick: () => { dateVue = null; redessiner(); } }, "Aujourd'hui"),
        h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Jour suivant', onclick: () => { dateVue = ajouterJours(date, 1); redessiner(); } }, '▶')
      )
    ),
    estAujourdhui && bilanEnAttente(donnees, reel) && encartBilan(jourSemaine(reel) === 0),
    // Un seul encart à la fois : la préparation vient après le bilan.
    estAujourdhui && !bilanEnAttente(donnees, reel) && preparationEnAttente(donnees, reel) && encartPreparation(),
    prioritesDeLaSemaine(donnees, date).length > 0 && encartPriorites(prioritesDeLaSemaine(donnees, date)),
    phraseDuJour(donnees, date) && encartMotivation(phraseDuJour(donnees, date)),
    h(
      'div',
      { class: 'barre-actions' },
      progression({ total: acocher.length, faits }),
      estAujourdhui && !checkinDuJour(donnees, reel) && h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirCheckin({ date: reel }) }, '🌤️ Mon check-in'),
      h('button', { class: 'bouton', type: 'button', title: 'Vider ma tête', onclick: () => ouvrirBrainDump({}) }, '🧠 Brain dump'),
      h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirAjoutTache({ date }) }, '＋ Ajouter')
    ),
    rdv.length > 0 && rendezVous(rdv, donnees),
    cartes.length > 0 && h('div', { class: 'grille-cartes' }, cartes),
    cartes.length === 0 &&
      rdv.length === 0 &&
      h('p', { class: 'vide vide-grand' }, "Rien de prévu pour l'instant. Ajoute une petite chose avec « ＋ Ajouter », ou savoure le calme ✦"),
    h('div', { class: 'grille-bas' }, blocsBas),
    h('p', { class: 'lien-discret' }, h('button', { class: 'lien-bouton', type: 'button', onclick: ouvrirRecurrentes }, '↻ Gérer mes tâches qui reviennent'))
  );

  vider(racine);
  racine.append(page);

  if (celebrer) {
    celebrer = false;
    requestAnimationFrame(() => confettis());
  }
}

enregistrerPage('aujourdhui', rendre);
