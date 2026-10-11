// Enveloppe de l'application : barre latérale, choix de la page, état d'enregistrement.

import * as store from './store.js';
import { PAGES, renduDePage, renduDeDomaine } from './registry.js';
import { h, pastilles, ouvrirModale } from './ui.js';
import { aujourdhui } from './dates.js';

// Chaque module s'enregistre en étant importé.
import './modules/taches.js';
import './modules/routines.js';
import './modules/rendezvous.js';
import './modules/aujourdhui.js';
import './modules/semaine.js';
import './modules/bien-etre.js';
import './modules/carnet.js';
import './modules/sport.js';
import './modules/nourriture.js';
import './modules/bilan.js';
import './modules/preparer.js';
import './modules/maison.js';
import './modules/ui-maison.js';
import './modules/administratif.js';
import './modules/budget.js';
import './modules/loisirs.js';
import './modules/corps.js';
import './modules/idees-actions.js';
import { reinitialiserOnglets } from './modules/composants-onglets.js';
import { bilanEnAttente } from './modules/bilan-donnees.js';
import './modules/reglages.js';
import { rendreDomaine } from './modules/domaine.js';
import { ouvrirOngletEtudes } from './modules/etudes.js';
import * as Minuteur from './modules/minuteur.js';
import { demarrerRappelCheckin } from './modules/bien-etre-checkin.js';
import { ouvrirRecherche, activerRaccourciRecherche } from './modules/recherche.js';

const racine = document.getElementById('app');
let zoneContenu = null;
let zoneNav = null;
let zoneNavMobile = null;
let zoneStatut = null;
let zoneBandeau = null;
let zoneMinuteur = null;
let routeCourante = 'aujourdhui'; // 'aujourdhui', 'reglages'… ou 'domaine/<id de catégorie>'
let jourAffiche = null;

const TEXTES_STATUT = {
  ok: '✓ Enregistré sur ton ordinateur',
  enregistrement: '… Enregistrement',
  erreur: '⚠ Pas enregistré, nouvelle tentative…',
  conflit: '⚠ Rechargement nécessaire',
};

function categoriesActives() {
  return store.lire().categories.filter((c) => !c.archivee);
}

// Lit l'adresse (#/xxx). On accepte aussi #/etudes (ancien format) pour un domaine.
function routeDeLAdresse() {
  const id = location.hash.replace(/^#\/?/, '') || 'aujourdhui';
  if (PAGES.some((p) => p.id === id)) return id;
  const idDomaine = id.startsWith('domaine/') ? id.slice('domaine/'.length) : id;
  if (store.lire().categories.some((c) => c.id === idDomaine)) return `domaine/${idDomaine}`;
  return 'aujourdhui';
}

function lienPage(page) {
  const disponible = Boolean(renduDePage(page.id));
  return h(
    'a',
    {
      class: 'nav-lien' + (page.id === routeCourante ? ' actif' : '') + (disponible ? '' : ' bientot'),
      href: `#/${page.id}`,
      'aria-current': page.id === routeCourante ? 'page' : null,
    },
    h('span', { class: 'nav-icone', 'aria-hidden': 'true' }, page.icone),
    h('span', null, page.titre),
    page.id === 'bilan' && store.lire() && bilanEnAttente(store.lire(), aujourdhui()) && h('span', { class: 'pastille-alerte', title: 'Ton bilan de la semaine est prêt', 'aria-label': 'Bilan à faire' }, '✦'),
    !disponible && h('span', { class: 'etiquette-bientot mono' }, `étape ${page.etape}`)
  );
}

function lienDomaine(cat) {
  const route = `domaine/${cat.id}`;
  return h(
    'a',
    {
      class: 'nav-lien nav-domaine' + (route === routeCourante ? ' actif' : ''),
      href: `#/${route}`,
      style: `--cat: var(--${cat.couleur})`,
      'aria-current': route === routeCourante ? 'page' : null,
    },
    h('span', { class: 'nav-icone nav-icone-bloc', 'aria-hidden': 'true' }, cat.icone),
    h('span', null, cat.nom)
  );
}

function dessinerNavigation() {
  const parZone = (zone) => PAGES.filter((p) => p.zone === zone).map(lienPage);
  zoneNav.replaceChildren(
    h('div', { class: 'nav-groupe' }, parZone('haut')),
    h(
      'div',
      { class: 'nav-groupe' },
      h('p', { class: 'nav-titre mono' }, 'Mes domaines'),
      categoriesActives().map(lienDomaine)
    ),
    h('div', { class: 'nav-groupe' }, parZone('bas')),
    h('div', { class: 'nav-groupe nav-pied' }, parZone('pied'))
  );
  dessinerNavigationMobile();
}

// ---- Format téléphone : barre du bas et menu ----

const ONGLETS_BAS = [
  { route: 'aujourdhui', icone: '☀️', libelle: "Aujourd'hui" },
  { route: 'semaine', icone: '🗓️', libelle: 'Semaine' },
  { route: 'carnet', icone: '🧠', libelle: 'Brain dump' },
];

// Le menu : tous les domaines et les pages, dans une feuille qui monte du bas.
function ouvrirMenuMobile() {
  ouvrirModale({
    titre: 'Menu',
    couleur: 'jaune',
    corps: (fermer) => {
      const lien = (route, contenu, classe, style) =>
        h('a', { class: classe, href: `#/${route}`, style, onclick: () => setTimeout(fermer, 0), 'aria-current': route === routeCourante ? 'page' : null }, contenu);
      const donnees = store.lire();
      const pagesBas = PAGES.filter((p) => ['preparer', 'bilan', 'reglages'].includes(p.id));
      return h(
        'div',
        { class: 'pile' },
        h('p', { class: 'menu-titre mono' }, 'Mes domaines'),
        h(
          'div',
          { class: 'menu-domaines' },
          categoriesActives().map((cat) =>
            lien(`domaine/${cat.id}`, [h('span', { class: 'menu-icone', 'aria-hidden': 'true' }, cat.icone), h('span', null, cat.nom)], 'menu-domaine' + (`domaine/${cat.id}` === routeCourante ? ' actif' : ''), `--cat: var(--${cat.couleur})`)
          )
        ),
        h('p', { class: 'menu-titre mono' }, 'Et aussi'),
        h(
          'div',
          { class: 'menu-pages' },
          pagesBas.map((p) =>
            lien(
              p.id,
              [
                h('span', { 'aria-hidden': 'true' }, p.icone),
                h('span', null, p.titre),
                p.id === 'bilan' && bilanEnAttente(donnees, aujourdhui()) && h('span', { class: 'pastille-alerte', 'aria-label': 'Bilan à faire' }, '✦'),
              ],
              'menu-page' + (p.id === routeCourante ? ' actif' : '')
            )
          )
        )
      );
    },
  });
}

function dessinerNavigationMobile() {
  const surUnDomaineOuAutre = !ONGLETS_BAS.some((o) => o.route === routeCourante);
  zoneNavMobile.replaceChildren(
    ...ONGLETS_BAS.map((o) =>
      h(
        'a',
        { class: 'nav-mobile-lien' + (o.route === routeCourante ? ' actif' : ''), href: `#/${o.route}`, 'aria-current': o.route === routeCourante ? 'page' : null },
        h('span', { class: 'nav-mobile-icone', 'aria-hidden': 'true' }, o.icone),
        h('span', { class: 'nav-mobile-texte' }, o.libelle)
      )
    ),
    h(
      'button',
      { class: 'nav-mobile-lien', type: 'button', onclick: ouvrirRecherche, 'aria-label': 'Rechercher' },
      h('span', { class: 'nav-mobile-icone', 'aria-hidden': 'true' }, '🔎'),
      h('span', { class: 'nav-mobile-texte' }, 'Chercher')
    ),
    h(
      'button',
      { class: 'nav-mobile-lien' + (surUnDomaineOuAutre ? ' actif' : ''), type: 'button', onclick: ouvrirMenuMobile, 'aria-label': 'Ouvrir le menu' },
      h('span', { class: 'nav-mobile-icone', 'aria-hidden': 'true' }, '☰'),
      h('span', { class: 'nav-mobile-texte' }, 'Menu')
    )
  );
}

function pagePasEncorePrete(page) {
  return h(
    'div',
    { class: 'page' },
    h('header', { class: 'entete-page' }, h('div', null, h('h1', null, `${page.icone} ${page.titre}`))),
    h(
      'section',
      { class: 'fenetre', style: '--cat: var(--creme-fonce)' },
      h('div', { class: 'fenetre-barre' }, pastilles(), h('strong', { class: 'fenetre-titre' }, 'Bientôt')),
      h('div', { class: 'fenetre-corps' }, h('p', null, `Cette page arrive à l'étape ${page.etape} de la construction. Tout est déjà prêt pour l'accueillir ✦`))
    )
  );
}

function dessinerPage() {
  jourAffiche = aujourdhui();
  const contexte = { redessiner: dessinerPage };

  if (routeCourante.startsWith('domaine/')) {
    const categorieId = routeCourante.slice('domaine/'.length);
    const cat = store.lire().categories.find((c) => c.id === categorieId);
    Minuteur.definirTitrePage(`${cat ? cat.nom : 'Domaine'} · Mon dashboard`);
    const rendu = renduDeDomaine(categorieId) || rendreDomaine;
    rendu(zoneContenu, { ...contexte, categorieId });
    return;
  }

  const page = PAGES.find((p) => p.id === routeCourante);
  Minuteur.definirTitrePage(`${page.titre} · Mon dashboard`);
  const rendu = renduDePage(page.id);
  if (rendu) rendu(zoneContenu, contexte);
  else zoneContenu.replaceChildren(pagePasEncorePrete(page));
}

function majMinuteurMini() {
  const e = Minuteur.etat();
  if (e.phase === 'inactif') {
    zoneMinuteur.hidden = true;
    return;
  }
  zoneMinuteur.hidden = false;
  const libelle = e.phase === 'travail' ? (e.enPause ? 'En pause' : 'Concentration') : 'Pause';
  zoneMinuteur.querySelector('.minuteur-mini-temps').textContent = Minuteur.formaterCompteARebours(e.restantMs);
  zoneMinuteur.querySelector('.minuteur-mini-libelle').textContent = libelle;
}

function dessinerStatut(etat) {
  const texte = TEXTES_STATUT[etat] || '';
  // Publié sur un site, les données sont gardées dans l'appareil lui-même.
  zoneStatut.textContent = store.modeStockage() === 'autonome' ? texte.replace('sur ton ordinateur', 'sur cet appareil') : texte;
  zoneStatut.dataset.etat = etat;
  zoneBandeau.hidden = etat !== 'conflit';
}

function allerVersLaPage() {
  routeCourante = routeDeLAdresse();
  // En arrivant dans une catégorie, on retombe sur sa « Vue d'ensemble ».
  if (routeCourante.startsWith('domaine/')) reinitialiserOnglets();
  dessinerNavigation();
  dessinerPage();
  window.scrollTo(0, 0);
  zoneContenu.focus({ preventScroll: true });
}

// Quand les données changent : la page se redessine ; la barre latérale aussi
// (une catégorie a pu être ajoutée, renommée ou masquée).
function surChangement() {
  if (routeCourante.startsWith('domaine/') && !store.lire().categories.some((c) => c.id === routeCourante.slice(8) && !c.archivee)) {
    routeCourante = 'aujourdhui';
    history.replaceState(null, '', '#/aujourdhui');
  }
  dessinerNavigation();
  dessinerPage();
}

function construireCoque() {
  zoneNav = h('nav', { class: 'navigation', 'aria-label': 'Pages' });
  zoneNavMobile = h('nav', { class: 'nav-mobile', 'aria-label': 'Navigation principale' });
  zoneStatut = h('p', { class: 'statut mono', role: 'status' });
  zoneMinuteur = h(
    'a',
    {
      class: 'minuteur-mini',
      href: '#/domaine/etudes',
      hidden: true,
      title: 'Ouvrir le minuteur',
      onclick: (e) => {
        ouvrirOngletEtudes('minuteur');
        if (routeCourante === 'domaine/etudes') {
          e.preventDefault();
          dessinerPage();
        }
      },
    },
    h('span', { class: 'minuteur-mini-temps mono' }, '00:00'),
    h('span', { class: 'minuteur-mini-libelle' }, '')
  );
  zoneContenu = h('main', { class: 'contenu', id: 'contenu', tabindex: '-1' });
  zoneBandeau = h(
    'div',
    { class: 'bandeau', role: 'alert', hidden: true },
    h('span', null, 'Tes données ont été modifiées dans un autre onglet. Recharge cette page pour retrouver la dernière version.'),
    h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => location.reload() }, 'Recharger')
  );

  racine.replaceChildren(
    zoneBandeau,
    h(
      'div',
      { class: 'coque' },
      h(
        'aside',
        { class: 'barre-laterale' },
        h('a', { class: 'logo', href: '#/aujourdhui' }, h('span', { class: 'smiley', 'aria-hidden': 'true' }), h('span', { class: 'logo-texte' }, 'Mon dashboard')),
        h(
          'button',
          { class: 'recherche-bouton', type: 'button', title: 'Rechercher partout', 'aria-label': 'Rechercher', onclick: ouvrirRecherche },
          h('span', { 'aria-hidden': 'true' }, '🔎'),
          h('span', { class: 'recherche-bouton-texte' }, 'Rechercher'),
          h('kbd', { class: 'recherche-raccourci mono' }, /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘K' : 'Ctrl K')
        ),
        zoneNav,
        zoneMinuteur,
        zoneStatut
      ),
      zoneContenu
    ),
    zoneNavMobile
  );
}

function afficherErreur(message) {
  racine.replaceChildren(
    h(
      'div',
      { class: 'page page-erreur' },
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--corail)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('strong', { class: 'fenetre-titre' }, 'Oups')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, message),
          h('p', { class: 'doux' }, 'Ferme cette page, puis relance le dashboard avec le raccourci « Lancer le dashboard ».')
        )
      )
    )
  );
}

async function demarrer() {
  try {
    await store.charger();
  } catch {
    afficherErreur("Le dashboard n'arrive pas à lire tes données. Le petit serveur est peut-être arrêté.");
    return;
  }
  construireCoque();
  // Dashboard publié sur un site : on garde les fichiers dans l'appareil pour l'ouvrir sans Wi-Fi.
  if (store.modeStockage() === 'autonome' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  Minuteur.abonner(majMinuteurMini);
  Minuteur.initialiser();
  majMinuteurMini();
  store.abonnerEtat(dessinerStatut);
  dessinerStatut(store.etatEnregistrement());
  store.abonner(surChangement);
  window.addEventListener('categories-modifiees', dessinerNavigation);
  window.addEventListener('hashchange', allerVersLaPage);
  activerRaccourciRecherche();
  // Si la page reste ouverte pendant la nuit, on remet les jours à jour au retour
  // (seulement si la date a changé, pour ne pas effacer ce qu'on est en train de taper).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && aujourdhui() !== jourAffiche) dessinerPage();
  });
  allerVersLaPage();
  demarrerRappelCheckin();
}

demarrer();
