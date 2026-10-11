// Page « Préparer ma semaine » : cinq minutes guidées pour regarder la semaine qui vient.
// Étapes : ce qui est prévu, mes priorités, mon sport, mes repas, mes sous. Chacune se passe d'un clic.
// Seules les priorités sont enregistrées (elles s'affichent en haut d'Aujourd'hui) ; le reste est un coup d'œil.
// Ton : une invitation, jamais une obligation.

import { h, vider, pastilles, notifier, confettis } from '../ui.js';
import { enregistrerPage } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours, lundiDe, formatPlage, jourCourt, jourDuMois } from '../dates.js';
import * as K from './preparation-donnees.js';
import { formaterEuros } from './budget-montants.js';
import { barreOnglets } from './composants-onglets.js';
import { ouvrirRendezVous } from './ui-rendezvous.js';
import { ouvrirPlanification } from './ui-sport.js';
import { ouvrirRepas } from './ui-nourriture.js';

const ETAPES = [
  { id: 'agenda', titre: 'Ce qui est prévu', icone: '🗓️' },
  { id: 'priorites', titre: 'Mes priorités', icone: '🎯' },
  { id: 'sport', titre: 'Mon sport', icone: '🏃‍♀️' },
  { id: 'repas', titre: 'Mes repas', icone: '🍽️' },
  { id: 'sous', titre: 'Mes sous', icone: '💶' },
];

// lundi : la semaine regardée (null = celle qu'on propose) ; etape : 0..4 ; priorites : le texte en cours d'écriture ;
// fini : on affiche la fenêtre « ta semaine est prête ».
const etat = { lundi: null, etape: 0, priorites: null, fini: false };

function reinitialiser() {
  Object.assign(etat, { lundi: null, etape: 0, priorites: null, fini: false });
}

// En quittant la page, on repart de zéro la prochaine fois.
window.addEventListener('hashchange', () => {
  if (location.hash !== '#/preparer') reinitialiser();
});

const e = formaterEuros;

function nomJour(date) {
  return `${jourCourt(date)} ${jourDuMois(date)}`;
}

// ---- Les étapes ----

function etapeAgenda(a, ctx, premierJourLibre) {
  return h(
    'div',
    { class: 'pile' },
    h('p', { class: 'doux' }, a.nbRdv + a.nbTaches === 0 ? 'Rien n’est encore prévu cette semaine : une page blanche.' : `${a.nbRdv} rendez-vous · ${a.nbTaches} chose${a.nbTaches > 1 ? 's' : ''} à faire`),
    h(
      'ul',
      { class: 'liste liste-sans-cadre' },
      a.jours.map((j) =>
        h(
          'li',
          { class: 'ligne ligne-prepa' + (j.passe ? ' passe' : '') },
          h('span', { class: 'jour-prepa mono' }, nomJour(j.date)),
          h(
            'div',
            { class: 'ligne-bloc' },
            j.rdv.map((r) => h('strong', { class: 'rdv-prepa' }, `${r.heure ? `${r.heure} · ` : ''}${r.titre}`)),
            j.taches.length > 0 && h('span', { class: 'meta' }, `${j.taches.length} chose${j.taches.length > 1 ? 's' : ''} à faire`),
            j.rdv.length === 0 && j.taches.length === 0 && h('span', { class: 'meta' }, 'Libre')
          )
        )
      )
    ),
    h(
      'div',
      { class: 'rangee rangee-souple' },
      h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirRendezVous({ date: premierJourLibre }) }, '＋ Rendez-vous'),
      h('a', { class: 'bouton bouton-petit', href: '#/semaine' }, 'Ouvrir la Semaine')
    )
  );
}

function etapePriorites(ctx, depart, venaitDuBilan) {
  const champ = h('textarea', {
    class: 'champ champ-note',
    rows: 5,
    id: 'prepa-priorites',
    'aria-label': 'Mes priorités',
    placeholder: 'Une par ligne. Une à trois, c’est déjà très bien.',
    oninput: (ev) => {
      etat.priorites = ev.target.value;
    },
  }, etat.priorites ?? depart.join('\n'));
  return h(
    'div',
    { class: 'pile' },
    h('p', null, 'Qu’est-ce qui compterait vraiment, cette semaine ? Elles resteront en haut d’« Aujourd’hui » tous les jours.'),
    champ,
    venaitDuBilan && etat.priorites === null && h('p', { class: 'meta' }, 'Reprises de ton bilan de la semaine dernière : change-les comme tu veux.')
  );
}

function etapeSport(a, premierJourLibre) {
  const seances = a.jours.flatMap((j) => j.seances.map((s) => ({ s, date: j.date })));
  return h(
    'div',
    { class: 'pile' },
    seances.length === 0
      ? h('p', { class: 'doux' }, 'Aucune séance prévue cette semaine. Une petite, si l’envie est là ?')
      : h(
          'ul',
          { class: 'liste liste-sans-cadre' },
          seances.map(({ s, date }) => h('li', { class: 'ligne ligne-prepa' }, h('span', { class: 'jour-prepa mono' }, nomJour(date)), h('div', { class: 'ligne-bloc' }, h('strong', null, s.titre))))
        ),
    h(
      'div',
      { class: 'rangee rangee-souple' },
      h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirPlanification({ date: premierJourLibre }) }, '＋ Planifier une séance'),
      h('a', { class: 'bouton bouton-petit', href: '#/domaine/sport' }, 'Ouvrir le Sport')
    )
  );
}

function etapeRepas(a) {
  return h(
    'div',
    { class: 'pile' },
    h('p', { class: 'doux' }, `${a.nbDiners} dîner${a.nbDiners > 1 ? 's' : ''} prévu${a.nbDiners > 1 ? 's' : ''} sur 7`),
    h(
      'ul',
      { class: 'liste liste-sans-cadre' },
      a.jours.map((j) =>
        h(
          'li',
          { class: 'ligne ligne-prepa' + (j.passe ? ' passe' : '') },
          h('span', { class: 'jour-prepa mono' }, nomJour(j.date)),
          h('div', { class: 'ligne-bloc' }, j.diner ? h('strong', null, `🍲 ${j.diner.texte}`) : h('span', { class: 'meta' }, j.passe ? '' : 'Rien de prévu pour le dîner')),
          !j.passe &&
            h(
              'button',
              {
                class: 'bouton bouton-petit',
                type: 'button',
                onclick: () => (j.diner ? ouvrirRepas({ id: j.diner.id }) : ouvrirRepas({ date: j.date, moment: 'diner' })),
              },
              j.diner ? '✎' : '＋ Dîner'
            )
        )
      )
    ),
    h('a', { class: 'bouton bouton-petit', href: '#/domaine/nourriture' }, 'Ouvrir la Nourriture')
  );
}

function etapeSous(a) {
  const b = a.budget;
  return h(
    'div',
    { class: 'pile' },
    b.configure
      ? h(
          'div',
          { class: 'tuiles-budget' },
          h(
            'div',
            { class: 'tuile', style: '--cat: var(--ciel)' },
            h('span', { class: 'tuile-etiquette mono' }, b.reste >= 0 ? 'Il te reste ce mois-ci' : 'En trop ce mois-ci'),
            h('strong', { class: 'tuile-montant' }, e(Math.abs(b.reste))),
            b.parJour !== null && h('span', { class: 'tuile-sous' }, `environ ${e(Math.round(b.parJour * 7))} pour la semaine`)
          )
        )
      : h('p', { class: 'doux' }, 'Ton budget n’est pas encore réglé : indique tes revenus et tes charges fixes pour voir ce qu’il te reste.'),
    a.echeances.length > 0 &&
      h(
        'div',
        { class: 'pile pile-serre' },
        h('span', { class: 'etiquette' }, 'Échéances de la semaine'),
        h('ul', { class: 'liste liste-sans-cadre' }, a.echeances.map((x) => h('li', { class: 'ligne ligne-prepa' }, h('span', { class: 'jour-prepa mono' }, nomJour(x.date)), h('div', { class: 'ligne-bloc' }, h('strong', null, x.titre)))))
      ),
    h('a', { class: 'bouton bouton-petit', href: '#/domaine/budget' }, 'Ouvrir le Budget')
  );
}

// ---- Page ----

function rendre(racine, ctx) {
  const donnees = store.lire();
  const reel = aujourdhui();
  const proposee = K.semaineAPreparer(reel);
  const lundi = etat.lundi || proposee;
  const existante = K.preparationDeLaSemaine(donnees, lundi);
  const a = K.apercuSemaine(donnees, lundi, reel);
  const depart = K.prioritesDepart(donnees, lundi);
  const venaitDuBilan = !existante && depart.length > 0;
  const premierJourLibre = a.jours.find((j) => !j.passe)?.date || lundi;

  const changerSemaine = (n) => {
    const cible = ajouterJours(lundi, 7 * n);
    // Pas de retour avant la semaine en cours : on prépare l'avenir.
    if (cible < lundiDe(reel)) return;
    etat.lundi = cible === proposee ? null : cible;
    etat.etape = 0;
    etat.priorites = null;
    etat.fini = false;
    ctx.redessiner();
  };

  const terminer = () => {
    const texte = etat.priorites ?? depart.join('\n');
    const premiere = !existante;
    // L'état d'abord : l'enregistrement redessine la page tout de suite.
    etat.fini = true;
    etat.priorites = null;
    store.modifier((d) => K.enregistrerPreparation(d, { lundi, priorites: texte }));
    if (premiere) confettis();
    notifier('Ta semaine est prête ✦');
  };

  const entete = h(
    'header',
    { class: 'entete-page' },
    h('div', null, h('h1', null, '🧭 Préparer ma semaine'), h('p', { class: 'sous-titre mono' }, `Semaine du ${formatPlage(lundi, ajouterJours(lundi, 6))}`)),
    h(
      'nav',
      { class: 'rangee rangee-souple', 'aria-label': 'Changer de semaine' },
      h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Semaine précédente', disabled: ajouterJours(lundi, -7) < lundiDe(reel), onclick: () => changerSemaine(-1) }, '◀'),
      lundi !== proposee && h('button', { class: 'bouton', type: 'button', onclick: () => { reinitialiser(); ctx.redessiner(); } }, 'Semaine proposée'),
      h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Semaine suivante', onclick: () => changerSemaine(1) }, '▶')
    )
  );

  let contenu;
  if (etat.fini) {
    const prios = K.preparationDeLaSemaine(donnees, lundi)?.priorites || [];
    contenu = h(
      'section',
      { class: 'fenetre', style: '--cat: var(--jaune)' },
      h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ta semaine est prête ✦')),
      h(
        'div',
        { class: 'fenetre-corps pile' },
        prios.length > 0
          ? h('div', { class: 'pile pile-serre' }, h('strong', null, '🎯 Mes priorités'), h('ul', { class: 'liste-puces' }, prios.map((p) => h('li', null, p))))
          : h('p', { class: 'doux' }, 'Aucune priorité choisie, et c’est très bien aussi.'),
        h('p', { class: 'doux' }, `${a.nbRdv} rendez-vous · ${a.nbTaches} chose${a.nbTaches > 1 ? 's' : ''} à faire · ${a.nbSeances} séance${a.nbSeances > 1 ? 's' : ''} · ${a.nbDiners} dîner${a.nbDiners > 1 ? 's' : ''} prévu${a.nbDiners > 1 ? 's' : ''}`),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('a', { class: 'bouton bouton-jaune', href: '#/aujourdhui' }, 'Aller à Aujourd’hui'),
          h('a', { class: 'bouton', href: '#/semaine' }, 'Voir la Semaine'),
          h('button', { class: 'bouton', type: 'button', onclick: () => { etat.fini = false; etat.etape = 0; ctx.redessiner(); } }, 'Revoir')
        )
      )
    );
  } else {
    const etape = ETAPES[etat.etape];
    const corps = {
      agenda: () => etapeAgenda(a, ctx, premierJourLibre),
      priorites: () => etapePriorites(ctx, depart, venaitDuBilan),
      sport: () => etapeSport(a, premierJourLibre),
      repas: () => etapeRepas(a),
      sous: () => etapeSous(a),
    }[etape.id]();
    const derniere = etat.etape === ETAPES.length - 1;
    const aller = (n) => {
      etat.etape = Math.max(0, Math.min(ETAPES.length - 1, etat.etape + n));
      ctx.redessiner();
    };
    contenu = [
      existante && h('p', { class: 'doux' }, '✓ Cette semaine est déjà préparée. Tu peux tout revoir ou modifier.'),
      barreOnglets({
        onglets: ETAPES.map((x, i) => ({ id: String(i), titre: x.titre, icone: x.icone })),
        actif: String(etat.etape),
        surChoix: (id) => {
          etat.etape = Number(id);
          ctx.redessiner();
        },
      }),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, `${etape.icone} ${etape.titre}`), h('span', { class: 'mono' }, `${etat.etape + 1}/${ETAPES.length}`)),
        h('div', { class: 'fenetre-corps' }, corps)
      ),
      h(
        'div',
        { class: 'rangee droite' },
        etat.etape > 0 && h('button', { class: 'bouton', type: 'button', onclick: () => aller(-1) }, '← Retour'),
        derniere
          ? h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: terminer }, 'Terminer ✦')
          : h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => aller(1) }, 'Suivant ›')
      ),
    ];
  }

  vider(racine);
  racine.append(h('div', { class: 'page' }, entete, ...[contenu].flat().filter(Boolean)));
}

enregistrerPage('preparer', rendre);
