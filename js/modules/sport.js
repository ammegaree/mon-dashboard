// Page du domaine « Sport » : Vue d'ensemble, Planning, Journal, Circuits (et les catégories de sport).
// Elle remplace la page générique des domaines pour la catégorie « sport ».
// Ton : encourageant. On montre ce qui est fait ; on ne signale jamais ce qui ne l'est pas.

import { h, vider, pastilles } from '../ui.js';
import { enregistrerPageDomaine } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours, lundiDe, formatLong, formatPlage, jourCourt, jourDuMois, JOURS } from '../dates.js';
import * as S from './sport-donnees.js';
import { barreOnglets, enregistrerReinitialisationOnglets } from './composants-onglets.js';
import { rendreVueEnsemble } from './vue-ensemble.js';
import { rendreCircuits, reinitialiserCircuits } from './sport-circuits.js';
import { ouvrirBrainDump, libelleBrainDump } from './ui-carnet.js';
import { ouvrirSeance, ouvrirPlanification, ouvrirType } from './ui-sport.js';

const ONGLETS = [
  { id: 'ensemble', titre: "Vue d'ensemble", icone: '🏃‍♀️' },
  { id: 'planning', titre: 'Planning', icone: '🗓️' },
  { id: 'journal', titre: 'Journal', icone: '📓' },
  { id: 'circuits', titre: 'Circuits', icone: '🔁' },
];

let onglet = 'ensemble';
enregistrerReinitialisationOnglets(() => {
  onglet = 'ensemble';
  reinitialiserCircuits();
});
let lundiVu = null;
let filtreType = '';

// ---- Idées de séances : un clic les ajoute ----

function suggestions(donnees) {
  const existants = new Set(donnees.sport.types.map((t) => t.nom.toLowerCase()));
  const restantes = S.SUGGESTIONS_TYPES.filter((s) => !existants.has(s.nom.toLowerCase()));
  if (!restantes.length) return null;
  return h(
    'div',
    { class: 'puces' },
    restantes.map((s) =>
      h(
        'button',
        { class: 'bouton bouton-petit', type: 'button', onclick: () => store.modifier((d) => S.ajouterType(d, s)) },
        `${s.icone} ${s.nom}`
      )
    )
  );
}

function carteDemarrage(donnees) {
  return h(
    'section',
    { class: 'fenetre', style: '--cat: var(--corail)' },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Choisis tes séances')),
    h(
      'div',
      { class: 'fenetre-corps pile' },
      h('p', null, "Quel genre de mouvement te ferait du bien ? Choisis quelques idées (tu pourras les changer) ou crée les tiennes. On planifie ensuite à ton rythme, sans pression."),
      suggestions(donnees),
      h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirType({}) }, '＋ Créer mon propre type'))
    )
  );
}

// ---- Onglet « Planning » ----

function resumeSeance(s) {
  const ressenti = S.RESSENTIS.find((r) => r.v === s.ressenti);
  return [s.dureeMin ? `${s.dureeMin} min` : null, ressenti ? ressenti.emoji : null].filter(Boolean).join(' · ');
}

// Le nom du circuit prévu pour une séance du planning (s'il y en a un).
function circuitPrevu(x, donnees) {
  const c = x.circuitId ? S.circuitParId(donnees, x.circuitId) : null;
  return c ? `🔁 ${c.nom}` : '';
}

function ligneJour(x, donnees) {
  const heure = x.heure ? `${x.heure} · ` : '';
  if (x.seance) {
    return h(
      'li',
      { class: 'seance-jour faite' },
      h(
        'button',
        { class: 'seance-bouton', type: 'button', title: 'Modifier la séance', onclick: () => ouvrirSeance({ id: x.seance.id }) },
        h('span', { class: 'seance-statut', 'aria-hidden': 'true' }, '✓'),
        h('span', { class: 'seance-texte' }, `${x.type.icone} ${x.type.nom}`),
        h('span', { class: 'meta mono' }, [resumeSeance(x.seance), x.seance.circuitNom ? `🔁 ${x.seance.circuitNom}` : ''].filter(Boolean).join(' · '))
      )
    );
  }
  return h(
    'li',
    { class: 'seance-jour' },
    h(
      'button',
      { class: 'seance-bouton', type: 'button', title: 'Modifier la séance prévue', onclick: () => ouvrirPlanification(x.genre === 'plan' ? { planId: x.source } : { ponctuelleId: x.source }) },
      h('span', { class: 'seance-statut', 'aria-hidden': 'true' }, '○'),
      h('span', { class: 'seance-texte' }, `${x.type.icone} ${x.type.nom}`),
      h('span', { class: 'meta mono' }, [`${heure}${x.dureeMin ? `${x.dureeMin} min` : ''}`.replace(/ · $/, ''), circuitPrevu(x, donnees)].filter(Boolean).join(' · '))
    ),
    h('button', { class: 'bouton bouton-petit bouton-turquoise', type: 'button', onclick: () => ouvrirSeance({ prevue: x }) }, 'Fait ✓')
  );
}

function ligneSpontanee(s) {
  return h(
    'li',
    { class: 'seance-jour faite' },
    h(
      'button',
      { class: 'seance-bouton', type: 'button', title: 'Modifier la séance', onclick: () => ouvrirSeance({ id: s.id }) },
      h('span', { class: 'seance-statut', 'aria-hidden': 'true' }, '✓'),
      h('span', { class: 'seance-texte' }, `${s.icone} ${s.typeNom}`),
      h('span', { class: 'meta mono' }, resumeSeance(s))
    )
  );
}

function colonneJour(date, reel, donnees) {
  const prevues = S.seancesPrevues(donnees, date);
  const cles = new Set(prevues.map((x) => x.seance?.id).filter(Boolean));
  const spontanees = donnees.sport.seances.filter((s) => s.date === date && !cles.has(s.id));
  const vide = prevues.length + spontanees.length === 0;
  return h(
    'section',
    { class: 'jour-semaine' + (date === reel ? ' aujourdhui' : ''), 'aria-label': formatLong(date) },
    h(
      'header',
      { class: 'jour-entete' },
      h('div', null, h('span', { class: 'jour-nom' }, jourCourt(date)), h('span', { class: 'jour-numero mono' }, String(jourDuMois(date)))),
      h('button', { class: 'bouton-icone', type: 'button', title: 'Planifier une séance ce jour', 'aria-label': `Planifier une séance le ${formatLong(date).toLowerCase()}`, onclick: () => ouvrirPlanification({ date }) }, '＋')
    ),
    vide
      ? h('p', { class: 'jour-vide' }, '·')
      : h('ul', { class: 'jour-liste' }, prevues.map((x) => ligneJour(x, donnees)), spontanees.map(ligneSpontanee))
  );
}

function rendrePlanning(conteneur, ctx) {
  const donnees = store.lire();
  vider(conteneur);
  if (donnees.sport.types.length === 0) {
    conteneur.append(carteDemarrage(donnees));
    return;
  }

  const reel = aujourdhui();
  const lundi = lundiVu || lundiDe(reel);
  const estCourante = lundi === lundiDe(reel);
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
  const stats = S.statsSport(donnees, reel);
  const aller = (n) => {
    const cible = ajouterJours(lundi, 7 * n);
    lundiVu = cible === lundiDe(reel) ? null : cible;
    ctx.redessiner();
  };

  // « Mon rythme » : les séances qui reviennent chaque semaine.
  const rythme = donnees.sport.plan.map((p) => ({ p, type: S.typeParId(donnees, p.typeId) })).filter((x) => x.type);

  // Au tout début, les idées de séances restent à portée de clic.
  const debut = donnees.sport.types.length < 3 && donnees.sport.plan.length === 0 && donnees.sport.seances.length === 0;

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      debut && carteDemarrage(donnees),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Cette semaine')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', { class: 'message-progression' }, S.messageSemaine(stats.cetteSemaine.n)),
          stats.cetteSemaine.n > 0 && h('p', { class: 'mono doux' }, `${stats.cetteSemaine.n} séance${stats.cetteSemaine.n > 1 ? 's' : ''} · ${stats.cetteSemaine.minutes} min`)
        )
      ),
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
        h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirPlanification({ date: estCourante ? reel : lundi }) }, '＋ Planifier une séance')
      ),
      h('div', { class: 'grille-semaine' }, jours.map((j) => colonneJour(j, reel, donnees))),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--corail)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mon rythme chaque semaine')),
        rythme.length === 0
          ? h('div', { class: 'fenetre-corps' }, h('p', { class: 'doux' }, "Pas encore de séance récurrente. Avec « Planifier une séance » > « Chaque semaine », tu choisis les jours où une séance revient d'elle-même."))
          : h(
              'ul',
              { class: 'fenetre-corps liste' },
              rythme.map(({ p, type }) => {
                const nomsJours = JOURS.filter((j) => p.jours.includes(j.dow)).map((j) => j.long).join(', ');
                return h(
                  'li',
                  { class: 'ligne ligne-simple' + (p.archivee ? ' archivee' : '') },
                  h('div', { class: 'ligne-bloc' }, h('strong', null, `${type.icone} ${type.nom}`), h('span', { class: 'meta' }, `${nomsJours}${p.heure ? ` · ${p.heure}` : ''}${p.dureeMin ? ` · ${p.dureeMin} min` : ''}${p.archivee ? ' · en pause' : ''}`)),
                  h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier', 'aria-label': `Modifier « ${type.nom} »`, onclick: () => ouvrirPlanification({ planId: p.id }) }, '✎'),
                  h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => store.modifier((d) => S.archiverPlan(d, p.id, !p.archivee)) }, p.archivee ? 'Reprendre' : 'Mettre en pause')
                );
              })
            )
      )
    )
  );
}

// ---- Onglet « Journal » ----

function tuile(valeur, libelle, couleur) {
  return h('div', { class: 'tuile', style: `--cat: var(--${couleur})` }, h('span', { class: 'tuile-valeur mono' }, valeur), h('span', { class: 'tuile-libelle' }, libelle));
}

function rendreJournal(conteneur, ctx) {
  const donnees = store.lire();
  const stats = S.statsSport(donnees, aujourdhui());
  const seances = S.journalTrie(donnees, { typeId: filtreType });
  const duree = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'grille-tuiles' },
        tuile(String(stats.cetteSemaine.n), 'cette semaine', 'jaune'),
        tuile(String(stats.ceMois.n), 'ce mois-ci', 'turquoise'),
        tuile(String(stats.total.n), 'au total', 'corail'),
        tuile(duree(stats.total.minutes), 'de mouvement', 'violet')
      ),
      h(
        'div',
        { class: 'barre-actions' },
        donnees.sport.types.length > 0 &&
          h(
            'div',
            { class: 'rangee-champ' },
            h('label', { class: 'etiquette', for: 'filtre-sport' }, 'Type'),
            h(
              'select',
              {
                class: 'champ',
                id: 'filtre-sport',
                onchange: (e) => {
                  filtreType = e.target.value;
                  ctx.redessiner();
                },
              },
              h('option', { value: '' }, 'Tous'),
              donnees.sport.types.map((t) => h('option', { value: t.id, selected: t.id === filtreType }, `${t.icone} ${t.nom}`))
            )
          )
      ),
      seances.length === 0
        ? h('p', { class: 'vide' }, "Ton journal t'attend : chaque séance que tu notes, même courte, y trouve sa place ✦")
        : h(
            'ul',
            { class: 'liste-simple' },
            seances.map((s) => {
              const r = S.RESSENTIS.find((x) => x.v === s.ressenti);
              return h(
                'li',
                { class: 'note-carnet', style: '--cat: var(--corail)' },
                h(
                  'div',
                  { class: 'note-carnet-entete' },
                  h('span', { class: 'pastille-domaine' }, `${s.icone} ${s.typeNom}${s.circuitNom ? ` · 🔁 ${s.circuitNom}` : ''}`),
                  h('span', { class: 'meta mono' }, `${formatLong(s.date)}${s.dureeMin ? ` · ${s.dureeMin} min` : ''}`),
                  r && h('span', { title: r.nom, 'aria-label': `Ressenti : ${r.nom}` }, r.emoji),
                  h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier', 'aria-label': `Modifier la séance du ${formatLong(s.date)}`, onclick: () => ouvrirSeance({ id: s.id }) }, '✎')
                ),
                s.note && h('p', { class: 'note-texte' }, s.note)
              );
            })
          )
    )
  );
}

// ---- Page ----

// Vue d'ensemble : les séances du jour et des jours à venir, avec un mot d'encouragement.
function resumeSport(donnees) {
  if (donnees.sport.types.length === 0 && donnees.sport.seances.length === 0) return null;
  const stats = S.statsSport(donnees, aujourdhui());
  return h('p', { class: 'message-progression' }, S.messageSemaine(stats.cetteSemaine.n));
}

const RENDUS = { ensemble: rendreVueEnsemble(resumeSport), planning: rendrePlanning, journal: rendreJournal, circuits: rendreCircuits };

function rendre(racine, { redessiner, categorieId }) {
  const donnees = store.lire();
  const cat = donnees.categories.find((c) => c.id === categorieId);
  const contenu = h('div', { class: 'etudes-contenu' });
  RENDUS[onglet](contenu, { redessiner, categorieId });

  vider(racine);
  racine.append(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'entete-page' },
        h('div', null, h('h1', null, `${cat?.icone || '🏃‍♀️'} ${cat?.nom || 'Sport'}`), h('p', { class: 'sous-titre' }, 'À ton rythme, à ta façon.')),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirBrainDump({ categorieId }) }, libelleBrainDump(store.lire(), categorieId)),
          h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirSeance({}) }, "＋ J'ai fait une séance")
        )
      ),
      barreOnglets({ onglets: ONGLETS, actif: onglet, surChoix: (id) => { onglet = id; redessiner(); } }),
      contenu
    )
  );
}

enregistrerPageDomaine('sport', rendre);
