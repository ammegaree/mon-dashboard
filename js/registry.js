// Le « carrefour » du dashboard.
//
// Chaque module (tâches, routines, rendez-vous, sport, études…) s'enregistre ici
// avec une fonction qui répond à une seule question :
//     « qu'est-ce qui est prévu le jour J ? »
// Les pages Aujourd'hui, Semaine et Bilan interrogent ensuite tous les modules
// de la même façon. Ajouter un domaine = ajouter un fournisseur, rien d'autre à toucher.
//
// Un élément du jour ressemble à ceci :
//   { source, id, date, titre, categorieId, type, heure?, groupe?, recurrent?, ... }
//   type : 'tache' (à cocher) | 'rdv' (rendez-vous : affiché avec son heure, pas coché)

const fournisseurs = [];

export function enregistrerFournisseur(fn) {
  fournisseurs.push(fn);
}

export function elementsDuJour(date, donnees) {
  return fournisseurs.flatMap((f) => f(date, donnees));
}

// ---- Éléments à reporter ----
// Chaque module dit quels éléments passés n'ont pas été faits, et comment les
// reporter ou les laisser partir. L'accueil propose ensuite le report, sans rien faire seul.
//   definition = { lister(donnees, aujourdhui) → [{source,id,titre,categorieId,date}],
//                  reporter(donnees, id, nouvelleDate), abandonner(donnees, id) }

const reportables = new Map();

export function enregistrerReportable(source, definition) {
  reportables.set(source, definition);
}

export function elementsEnRetard(donnees, aujourdhui) {
  return [...reportables.values()]
    .flatMap((r) => r.lister(donnees, aujourdhui))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function reporterElement(donnees, item, date) {
  reportables.get(item.source)?.reporter(donnees, item.id, date);
}

export function abandonnerElement(donnees, item) {
  reportables.get(item.source)?.abandonner(donnees, item.id);
}

// ---- Éditeurs ----
// Quand on clique sur un élément, la fenêtre de modification dépend de sa source.

const editeurs = new Map();

export function enregistrerEditeur(source, ouvrir) {
  editeurs.set(source, ouvrir);
}

export function editeurDe(source) {
  return editeurs.get(source);
}

// ---- Cases cochées (un seul endroit pour tous les modules) ----

export function cleCoche(item) {
  return `${item.source}|${item.id}|${item.date}`;
}

// Un élément est « fait » quand il est coché, ou quand son module le dit lui-même
// (par exemple le check-in du jour, fait dès qu'il est rempli).
export function estCoche(donnees, item) {
  return Boolean(donnees.coches[cleCoche(item)]) || item.fait === true;
}

// Certains éléments ne se cochent pas : cliquer sur la case ouvre autre chose
// (le check-in du jour ouvre son formulaire). Le module le déclare ici.
const actionsCoche = new Map();

export function enregistrerActionCoche(source, fn) {
  actionsCoche.set(source, fn);
}

export function actionCocheDe(source) {
  return actionsCoche.get(source);
}

// ---- Pages ----
// Pages « générales » : listées d'avance ; elles deviennent cliquables
// quand leur module a enregistré un `rendu`.
// zone : 'haut' (en haut de la barre latérale), 'bas' (sous les domaines), 'pied' (tout en bas).

export const PAGES = [
  { id: 'aujourdhui', titre: "Aujourd'hui", icone: '☀️', etape: 1, zone: 'haut' },
  { id: 'semaine', titre: 'Semaine', icone: '🗓️', etape: 2, zone: 'haut' },
  { id: 'carnet', titre: 'Brain dump', icone: '🧠', etape: 4, zone: 'bas' },
  { id: 'preparer', titre: 'Préparer ma semaine', icone: '🧭', etape: 7, zone: 'bas' },
  { id: 'bilan', titre: 'Bilan', icone: '🌟', etape: 6, zone: 'bas' },
  { id: 'reglages', titre: 'Réglages', icone: '⚙️', etape: 1, zone: 'pied' },
];

const rendus = new Map();

export function enregistrerPage(id, rendu) {
  rendus.set(id, rendu);
}

export function renduDePage(id) {
  return rendus.get(id);
}

// ---- Pages de domaine ----
// Chaque catégorie (domaine de vie) a sa page dans la barre latérale. Une page générique
// est affichée tant qu'un module n'a pas enregistré la sienne pour ce domaine.

// Ce qui est prévu plus tard pour certains domaines (affiché sur leur page générique).
export const DOMAINES_PREVUS = {
  etudes: { etape: 3, texte: 'Tes modules et chapitres, le minuteur de concentration, tes QCM et ton historique de scores.' },
  'bien-etre': { etape: 4, texte: 'Ton journal, le check-in du jour, tes habitudes et ta motivation.' },
  sport: { etape: 5, texte: 'Tes types de séances, ton planning de la semaine et ton journal de sport.' },
  nourriture: { etape: 5, texte: 'Le planning des repas de la semaine et ta liste de courses.' },
};

const rendusDomaines = new Map();

export function enregistrerPageDomaine(categorieId, rendu) {
  rendusDomaines.set(categorieId, rendu);
}

export function renduDeDomaine(categorieId) {
  return rendusDomaines.get(categorieId);
}
