// Le « service worker » du dashboard publié : il garde tous les fichiers du dashboard dans le téléphone,
// pour qu'il s'ouvre sans Wi-Fi, ordinateur éteint. (Modèle : `construire-site.js` y met la liste des fichiers.)
// Ce fichier ne touche jamais à tes données : elles sont rangées à part, dans l'appareil.

const VERSION = 'dashboard-8a725df84d';
const FICHIERS = [
  "./",
  "./css/style.css",
  "./icones/apple-touch-icon.png",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-maskable-512.png",
  "./index.html",
  "./js/app.js",
  "./js/dates.js",
  "./js/modules/actions-taches.js",
  "./js/modules/administratif-echeances.js",
  "./js/modules/administratif-fiches.js",
  "./js/modules/administratif.js",
  "./js/modules/agenda-donnees.js",
  "./js/modules/aujourdhui.js",
  "./js/modules/bien-etre-analyse.js",
  "./js/modules/bien-etre-checkin.js",
  "./js/modules/bien-etre-donnees.js",
  "./js/modules/bien-etre-habitudes.js",
  "./js/modules/bien-etre-jour.js",
  "./js/modules/bien-etre-journal.js",
  "./js/modules/bien-etre-motivation.js",
  "./js/modules/bien-etre.js",
  "./js/modules/bilan-donnees.js",
  "./js/modules/bilan.js",
  "./js/modules/budget-commun.js",
  "./js/modules/budget-depenses.js",
  "./js/modules/budget-donnees.js",
  "./js/modules/budget-ensemble.js",
  "./js/modules/budget-epargne.js",
  "./js/modules/budget-lignes.js",
  "./js/modules/budget-montants.js",
  "./js/modules/budget-pret.js",
  "./js/modules/budget-reglage.js",
  "./js/modules/budget.js",
  "./js/modules/carnet-corps.js",
  "./js/modules/carnet-donnees.js",
  "./js/modules/carnet.js",
  "./js/modules/champs.js",
  "./js/modules/chiffrement.js",
  "./js/modules/composants-onglets.js",
  "./js/modules/corps.js",
  "./js/modules/cours-format.js",
  "./js/modules/depot-github.js",
  "./js/modules/domaine.js",
  "./js/modules/echeances-donnees.js",
  "./js/modules/epargne-donnees.js",
  "./js/modules/etudes-composants.js",
  "./js/modules/etudes-cours.js",
  "./js/modules/etudes-donnees.js",
  "./js/modules/etudes-minuteur.js",
  "./js/modules/etudes-parcours.js",
  "./js/modules/etudes-qcm.js",
  "./js/modules/etudes-recherche.js",
  "./js/modules/etudes-suivi.js",
  "./js/modules/etudes.js",
  "./js/modules/fiches-donnees.js",
  "./js/modules/formulaire-tache.js",
  "./js/modules/fusion.js",
  "./js/modules/idees-actions.js",
  "./js/modules/idees-registre.js",
  "./js/modules/liens.js",
  "./js/modules/loisirs-avis.js",
  "./js/modules/loisirs-donnees.js",
  "./js/modules/loisirs-listes.js",
  "./js/modules/loisirs.js",
  "./js/modules/maison-donnees.js",
  "./js/modules/maison-menage.js",
  "./js/modules/maison-plantes.js",
  "./js/modules/maison-projets.js",
  "./js/modules/maison.js",
  "./js/modules/minuteur-moteur.js",
  "./js/modules/minuteur.js",
  "./js/modules/nourriture-donnees.js",
  "./js/modules/nourriture.js",
  "./js/modules/nuage-coeur.js",
  "./js/modules/nuage.js",
  "./js/modules/plantes-donnees.js",
  "./js/modules/preparation-donnees.js",
  "./js/modules/preparer.js",
  "./js/modules/pret-donnees.js",
  "./js/modules/projets-donnees.js",
  "./js/modules/qcm-format.js",
  "./js/modules/qr.js",
  "./js/modules/recherche-donnees.js",
  "./js/modules/recherche.js",
  "./js/modules/reglages.js",
  "./js/modules/rendezvous.js",
  "./js/modules/routines.js",
  "./js/modules/semaine.js",
  "./js/modules/sources-qcm.js",
  "./js/modules/sport-circuits.js",
  "./js/modules/sport-donnees.js",
  "./js/modules/sport.js",
  "./js/modules/synchro.js",
  "./js/modules/taches.js",
  "./js/modules/ui-agenda.js",
  "./js/modules/ui-budget.js",
  "./js/modules/ui-carnet.js",
  "./js/modules/ui-circuits.js",
  "./js/modules/ui-echeances.js",
  "./js/modules/ui-epargne.js",
  "./js/modules/ui-fiches.js",
  "./js/modules/ui-loisirs.js",
  "./js/modules/ui-maison.js",
  "./js/modules/ui-nourriture.js",
  "./js/modules/ui-plantes.js",
  "./js/modules/ui-pret.js",
  "./js/modules/ui-projets.js",
  "./js/modules/ui-rendezvous.js",
  "./js/modules/ui-roue.js",
  "./js/modules/ui-sport.js",
  "./js/modules/vue-ensemble.js",
  "./js/registry.js",
  "./js/schema.js",
  "./js/stockage-local.js",
  "./js/store.js",
  "./js/ui.js",
  "./manifest.webmanifest"
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

// À chaque nouvelle version du site : on supprime les fichiers des versions précédentes.
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// D'abord ce qui est gardé dans le téléphone ; sinon le réseau ; et sans réseau, la page d'accueil.
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  evenement.respondWith(
    caches.match(requete, { ignoreSearch: true }).then(
      (gardee) =>
        gardee ||
        fetch(requete).catch(() => (requete.mode === 'navigate' ? caches.match('index.html') : Response.error()))
    )
  );
});
