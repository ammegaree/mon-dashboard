// Page « Aujourd'hui » : l'accueil.
// Un bloc d'accueil (salutation, où j'en suis, mes priorités, la phrase du jour), une seule liste
// « À faire » rangée par catégorie, les rendez-vous en agenda, et sur le côté les routines et les reports.

import { h, vider, etincelles, confettis } from '../ui.js';
import * as store from '../store.js';
import { enregistrerPage, elementsDuJour, cleCoche, estCoche, elementsEnRetard, reporterElement, abandonnerElement } from '../registry.js';
import { aujourdhui, ajouterJours, formatLong, formatCourt, nomDuJour, jourSemaine } from '../dates.js';
import * as T from './taches.js';
import * as R from './routines.js';
import { categorieDe, ouvrirAjoutTache, ouvrirRecurrentes, ligneTache, ligneInfo } from './actions-taches.js';
import { toutesLesCategories } from './agenda-donnees.js';
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

// Le moment de la journée : une salutation, un petit dessin et une couleur.
function momentDeLaJournee(maintenant = new Date()) {
  const heure = maintenant.getHours();
  if (heure >= 5 && heure < 12) return { salut: 'Bonjour', emoji: '☀️', couleur: 'jaune' };
  if (heure >= 12 && heure < 18) return { salut: 'Bon après-midi', emoji: '🌤️', couleur: 'orange' };
  return { salut: 'Bonsoir', emoji: '🌙', couleur: 'violet' };
}

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

// « 3 choses à faire · 2 rendez-vous · prochain à 14:30 »
function phraseResume({ restants, total, rdv, estAujourdhui, maintenant = new Date() }) {
  if (total === 0 && rdv.length === 0) return 'Rien de prévu : savoure le calme ✦';
  const morceaux = [];
  if (total > 0) morceaux.push(restants === 0 ? 'Tout est fait ✨' : pluriel(restants, 'chose à faire', 'choses à faire'));
  if (rdv.length > 0) morceaux.push(pluriel(rdv.length, 'rendez-vous', 'rendez-vous'));
  if (estAujourdhui) {
    const hhmm = `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`;
    const prochain = rdv.find((r) => r.heure && r.heure >= hhmm);
    if (prochain) morceaux.push(`prochain à ${prochain.heure}`);
  }
  return morceaux.join(' · ');
}

// Le bloc du haut : la date, la salutation, où j'en suis, les priorités, la phrase du jour.
function hero({ date, reel, estAujourdhui, total, faits, restants, rdv, priorites, phrase, redessiner }) {
  const moment = momentDeLaJournee();
  const pourcent = total ? Math.round((faits / total) * 100) : 0;
  const termine = total > 0 && faits === total;
  const titre = estAujourdhui ? `${moment.salut} ✦` : libelleJour(date, reel);
  const visibles = priorites.slice(0, 3);

  return h(
    'header',
    { class: 'hero-jour' + (termine ? ' complete' : ''), style: `--moment: var(--${termine ? 'turquoise' : estAujourdhui ? moment.couleur : 'ciel'})` },
    h(
      'div',
      { class: 'hero-haut' },
      h('span', { class: 'hero-emoji', 'aria-hidden': 'true' }, estAujourdhui ? moment.emoji : '🗓️'),
      h(
        'div',
        { class: 'hero-texte' },
        h('p', { class: 'hero-date mono' }, formatLong(date)),
        h('h1', null, titre),
        h('p', { class: 'hero-resume' }, phraseResume({ restants, total, rdv, estAujourdhui }))
      ),
      h(
        'nav',
        { class: 'hero-nav', 'aria-label': 'Changer de jour' },
        !estAujourdhui && h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { dateVue = null; redessiner(); } }, "Aujourd'hui"),
        h(
          'div',
          { class: 'hero-nav-fleches' },
          h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Jour précédent', onclick: () => { dateVue = ajouterJours(date, -1); redessiner(); } }, '◀'),
          h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Jour suivant', onclick: () => { dateVue = ajouterJours(date, 1); redessiner(); } }, '▶')
        )
      )
    ),
    total > 0 &&
      h(
        'div',
        { class: 'hero-progression' },
        h(
          'div',
          { class: 'barre-progression', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent, 'aria-label': 'Progression de la journée' },
          h('div', { class: 'remplissage', style: `width: ${pourcent}%` })
        ),
        h('span', { class: 'progression-texte mono' }, termine ? 'Journée terminée ✨' : `${faits} / ${total}`)
      ),
    visibles.length > 0 &&
      h(
        'div',
        { class: 'hero-priorites', 'aria-label': 'Mes priorités de la semaine' },
        h('span', { class: 'etiquette' }, '🎯 Mes priorités'),
        visibles.map((p) => h('span', { class: 'priorite-puce' }, p)),
        priorites.length > 3 && h('a', { class: 'meta', href: '#/bilan' }, `+ ${priorites.length - 3}`)
      ),
    phrase &&
      h(
        'p',
        { class: 'hero-phrase' },
        h('span', { 'aria-hidden': 'true' }, '✦ '),
        phrase.texte,
        phrase.auteur && h('span', { class: 'meta' }, ` — ${phrase.auteur}`),
        phrase.type === 'pourquoi' && h('span', { class: 'meta' }, ' — mon pourquoi')
      )
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

// Les rendez-vous du jour, comme un petit agenda.
function panneauAgenda(rdv, donnees) {
  return h(
    'section',
    { class: 'panneau-jour panneau-agenda', 'aria-label': 'Rendez-vous du jour' },
    h('h2', { class: 'panneau-titre' }, h('span', { 'aria-hidden': 'true' }, '🗓 '), 'Rendez-vous', h('span', { class: 'panneau-compte mono' }, String(rdv.length))),
    h('ul', { class: 'liste-rdv' }, rdv.map((r) => ligneRendezVous(r, donnees)))
  );
}

// Tout ce qui est à faire, par catégorie : un seul panneau, des lignes légères.
function panneauTaches(groupes, donnees, contexte, restants) {
  return h(
    'section',
    { class: 'panneau-jour panneau-taches', 'aria-label': 'Ce qu’il y a à faire' },
    h('h2', { class: 'panneau-titre' }, h('span', { 'aria-hidden': 'true' }, '✅ '), 'À faire', contexte.total > 0 && h('span', { class: 'panneau-compte mono' }, restants === 0 ? 'tout est fait' : `${restants} à faire`)),
    h(
      'div',
      { class: 'groupes-jour' },
      groupes.map(({ cat, items, infos }) => {
        const faits = items.filter((i) => estCoche(donnees, i)).length;
        return h(
          'section',
          { class: 'groupe-jour', style: `--cat: var(--${cat.couleur})` },
          h(
            'h3',
            { class: 'groupe-entete' },
            h('span', { class: 'pastille-cat', 'aria-hidden': 'true' }),
            h('span', { class: 'groupe-nom' }, `${cat.icone} ${cat.nom}`),
            items.length > 0 && h('span', { class: 'mono groupe-compte' }, `${faits}/${items.length}`)
          ),
          h(
            'ul',
            { class: 'liste' },
            items.map((i) => ligneTache(i, donnees, { surCoche: (it) => cocher(it, contexte) })),
            infos.map((i) => ligneInfo(i))
          )
        );
      })
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

// Le contenu d'une routine (étapes à cocher, ou éditeur d'étapes).
function contenuRoutine(routine, donnees, elements, contexte, redessiner) {
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

  return { corps, items, faits, enEdition, cle };
}

// Une routine rangée sur le côté : un bloc qui se replie.
function blocRoutine(routine, donnees, elements, contexte, redessiner) {
  const { corps, items, faits, enEdition, cle } = contenuRoutine(routine, donnees, elements, contexte, redessiner);
  return blocRepliable({
    cle,
    couleur: 'creme-fonce',
    titre: `${routine.icone} ${routine.nom}`,
    compteur: items.length ? `${faits}/${items.length}` : null,
    corps,
    forcerOuvert: enEdition,
  });
}

// La routine du moment (matin avant midi, soir après 18 h) : bien en vue, en haut de la page.
// Une fois toutes les étapes faites, elle se réduit à une ligne.
function rituelDuMoment(routine, donnees, elements, contexte, redessiner, couleur = 'jaune') {
  const { corps, items, faits, enEdition, cle } = contenuRoutine(routine, donnees, elements, contexte, redessiner);
  const fini = items.length > 0 && faits === items.length && !enEdition;
  if (fini) {
    return blocRepliable({ cle, couleur: 'turquoise', titre: `✅ ${routine.nom} : faite ✨`, compteur: `${faits}/${items.length}`, corps });
  }
  const pourcent = items.length ? Math.round((faits / items.length) * 100) : 0;
  return h(
    'section',
    { class: 'panneau-jour panneau-rituel', 'aria-label': routine.nom, style: `--moment-rituel: var(--${couleur})` },
    h(
      'h2',
      { class: 'panneau-titre' },
      h('span', { 'aria-hidden': 'true' }, `${routine.icone} `),
      routine.nom,
      items.length > 0 && h('span', { class: 'panneau-compte mono' }, `${faits}/${items.length}`)
    ),
    items.length > 0 &&
      h(
        'div',
        { class: 'barre-progression rituel-barre', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent, 'aria-label': `Progression : ${routine.nom}` },
        h('div', { class: 'remplissage', style: `width: ${pourcent}%` })
      ),
    corps
  );
}

// Une étape de la journée (matin, ma journée, soir) : un titre qui sépare nettement, puis son contenu.
function phaseDuJour({ id, emoji, titre, couleur, maintenant, contenu }) {
  return h(
    'section',
    { class: 'phase-jour' + (maintenant ? ' maintenant' : ''), style: `--phase: var(--${couleur})`, 'aria-labelledby': `phase-${id}` },
    h(
      'header',
      { class: 'phase-entete' },
      h('span', { class: 'phase-emoji', 'aria-hidden': 'true' }, emoji),
      h('h2', { id: `phase-${id}`, class: 'phase-titre mono' }, titre),
      maintenant && h('span', { class: 'phase-badge mono' }, 'en ce moment'),
      h('span', { class: 'phase-trait', 'aria-hidden': 'true' })
    ),
    h('div', { class: 'phase-contenu' }, contenu)
  );
}

// Quelle étape de la journée est en cours ? matin avant midi, soir à partir de 18 h.
function phaseEnCours(maintenant = new Date()) {
  const heure = maintenant.getHours();
  if (heure >= 5 && heure < 12) return 'matin';
  if (heure >= 18) return 'soir';
  return 'journee';
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
  const groupes = toutesLesCategories(donnees)
    .filter((c) => parCategorie.has(c.id))
    .map((c) => ({ cat: c, items: parCategorie.get(c.id).items, infos: parCategorie.get(c.id).infos }));

  const enRetard = estAujourdhui ? elementsEnRetard(donnees, reel) : [];
  const priorites = prioritesDeLaSemaine(donnees, date);
  const phrase = phraseDuJour(donnees, date);
  const aucuneChose = groupes.length === 0 && rdv.length === 0;
  const seulementRoutines = aucuneChose && acocher.length > 0;

  // Une journée en trois temps : le matin, la journée, le soir. Les autres routines passent après le soir.
  const routineMatin = donnees.routines.find((r) => r.id === 'matin') || null;
  const routineSoir = donnees.routines.find((r) => r.id === 'soir') || null;
  const autresRoutines = donnees.routines.filter((r) => r !== routineMatin && r !== routineSoir);
  const enCours = estAujourdhui ? phaseEnCours() : null;

  const contenuJournee = [
    enRetard.length > 0 && blocReport(enRetard, donnees, reel),
    rdv.length > 0 && panneauAgenda(rdv, donnees),
    groupes.length > 0 && panneauTaches(groupes, donnees, contexte, contexte.restants),
    aucuneChose &&
      h(
        'div',
        { class: 'vide vide-grand' },
        h('p', null, seulementRoutines ? 'Rien d’autre que tes routines pour ce jour.' : "Rien de prévu pour l'instant."),
        h('p', { class: 'doux' }, 'Ajoute une petite chose avec « ＋ Ajouter », ou savoure le calme ✦')
      ),
  ];

  const page = h(
    'div',
    { class: 'page page-aujourdhui' },
    hero({ date, reel, estAujourdhui, total: acocher.length, faits, restants: contexte.restants, rdv, priorites, phrase, redessiner }),
    estAujourdhui && bilanEnAttente(donnees, reel) && encartBilan(jourSemaine(reel) === 0),
    // Un seul encart à la fois : la préparation vient après le bilan.
    estAujourdhui && !bilanEnAttente(donnees, reel) && preparationEnAttente(donnees, reel) && encartPreparation(),
    h(
      'div',
      { class: 'actions-jour' },
      h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirAjoutTache({ date }) }, '＋ Ajouter'),
      h('button', { class: 'bouton', type: 'button', title: 'Vider ma tête', onclick: () => ouvrirBrainDump({}) }, '🧠 Brain dump'),
      estAujourdhui && !checkinDuJour(donnees, reel) && h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirCheckin({ date: reel }) }, '🌤️ Check-in')
    ),
    h(
      'div',
      { class: 'jour-temps' },
      routineMatin &&
        phaseDuJour({ id: 'matin', emoji: '🌅', titre: 'Le matin', couleur: 'jaune', maintenant: enCours === 'matin', contenu: rituelDuMoment(routineMatin, donnees, elements, contexte, redessiner, 'jaune') }),
      phaseDuJour({ id: 'journee', emoji: '☀️', titre: 'Ma journée', couleur: 'turquoise', maintenant: enCours === 'journee', contenu: contenuJournee }),
      routineSoir &&
        phaseDuJour({ id: 'soir', emoji: '🌙', titre: 'Le soir', couleur: 'violet', maintenant: enCours === 'soir', contenu: rituelDuMoment(routineSoir, donnees, elements, contexte, redessiner, 'violet') }),
      autresRoutines.length > 0 &&
        phaseDuJour({
          id: 'autres',
          emoji: '🔁',
          titre: 'Mes autres routines',
          couleur: 'creme-fonce',
          maintenant: false,
          contenu: h('div', { class: 'grille-bas' }, autresRoutines.map((r) => blocRoutine(r, donnees, elements, contexte, redessiner))),
        })
    ),
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
