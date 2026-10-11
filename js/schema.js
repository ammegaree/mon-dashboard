// Structure des données.
//
// Tout est rangé dans un seul objet, enregistré dans donnees/dashboard.json.
// Chaque domaine de vie ajoute simplement sa (ou ses) liste(s) ici ; les listes
// manquantes sont créées automatiquement à l'ouverture (voir `migrer`), donc
// les anciennes données restent valables quand on ajoute un module.

export const VERSION = 1;

// Palette fixe : une catégorie = un nom de couleur, utilisé partout pareil.
export const PALETTE = [
  { id: 'corail', nom: 'Corail' },
  { id: 'jaune', nom: 'Jaune' },
  { id: 'turquoise', nom: 'Turquoise' },
  { id: 'violet', nom: 'Violet' },
  { id: 'rose', nom: 'Rose' },
  { id: 'ciel', nom: 'Bleu ciel' },
  { id: 'orange', nom: 'Orange' },
  { id: 'vert', nom: 'Vert' },
];

export function donneesParDefaut() {
  return {
    meta: {
      schemaVersion: VERSION,
      rev: 0,
      creeLe: new Date().toISOString(),
    },
    // Réglages : le rappel du check-in (une fenêtre qui pose les questions à partir d'une certaine heure).
    reglages: { checkin: { actif: true, heure: '18:00' } },

    // Les « domaines de vie ». Ajouter un domaine = ajouter une ligne ici.
    categories: [
      { id: 'etudes', nom: 'Études', couleur: 'violet', icone: '📚' },
      { id: 'bien-etre', nom: 'Bien-être', couleur: 'rose', icone: '🌸' },
      { id: 'sport', nom: 'Sport', couleur: 'corail', icone: '🏃‍♀️' },
      { id: 'nourriture', nom: 'Nourriture', couleur: 'jaune', icone: '🥑' },
      { id: 'maison', nom: 'Maison', couleur: 'turquoise', icone: '🏡' },
      { id: 'administratif', nom: 'Administratif', couleur: 'vert', icone: '🗂️' },
      { id: 'budget', nom: 'Budget', couleur: 'ciel', icone: '💶' },
      { id: 'corps', nom: 'Corps', couleur: 'orange', icone: '🌿' },
      { id: 'loisirs', nom: 'Loisirs', couleur: 'violet', icone: '🎬' },
      // « Autre » reste en coulisse : c'est le tiroir des choses sans domaine (on peut le réactiver dans les réglages).
      { id: 'autre', nom: 'Autre', couleur: 'violet', icone: '✨', archivee: true },
    ],

    // Catégories du calendrier (Perso, Social, Rendez-vous…) : de simples étiquettes pour les rendez-vous et les tâches.
    // Ce ne sont pas des domaines de vie : pas de page ni d'entrée dans le menu.
    categoriesAgenda: [
      { id: 'agenda-perso', nom: 'Perso', couleur: 'rose', icone: '💛' },
      { id: 'agenda-social', nom: 'Social', couleur: 'orange', icone: '🥂' },
      { id: 'agenda-rendez-vous', nom: 'Rendez-vous', couleur: 'ciel', icone: '📅' },
    ], // { id, nom, couleur, icone }

    // Tâches libres, ponctuelles ou récurrentes.
    // { id, titre, categorieId, date, recurrence, abandonnee, creeLe }
    // recurrence = null ou { frequence: 'jour'|'semaine'|'mois', jours: [dow], debut, fin, exceptions: [date] }
    taches: [],

    // Rendez-vous (créés à l'étape 2).
    // { id, titre, date, heure, lieu, note, categorieId }
    rendezvous: [],

    // Routines : listes d'étapes cochées chaque jour.
    routines: [
      { id: 'matin', nom: 'Routine du matin', icone: '🌅', etapes: [] },
      { id: 'soir', nom: 'Routine du soir', icone: '🌙', etapes: [] },
    ],

    // Cases cochées : clé « source|id|date » → moment où c'est fait.
    // Un seul endroit pour tout (tâches, routines, habitudes, séances…).
    coches: {},

    // Études : modules et chapitres saisis par l'utilisatrice, sessions planifiées,
    // temps de concentration, QCM importés et leurs résultats.
    etudes: {
      modules: [], // { id, titre }
      chapitres: [], // { id, moduleId, titre, statut }  (l'ordre du tableau = l'ordre d'affichage)
      sessions: [], // { id, chapitreId, type: 'travail'|'revision', date, heure, dureeMin, note, abandonnee }
      temps: [], // { id, chapitreId, date, debut, secondes }
      qcm: [], // { id, chapitreId, titre, description, questions: [...], importeLe }
      recherches: [], // { id, titre, note, sources: [texte ou lien], chapitreId, creeLe, modifieLe }
      resultats: [], // { id, qcmId, date, total, juste, partiel, detail: [...] }
      reglages: { concentrationMin: 25, pauseMin: 5 },
    },

    // Sport : mes types de séances, mon rythme hebdomadaire, des séances ponctuelles, le journal des séances faites.
    sport: {
      types: [], // { id, nom, icone, dureeMin }
      plan: [], // { id, typeId, jours: [dow], heure, dureeMin, debut, archivee }   (séance qui revient chaque semaine)
      ponctuelles: [], // { id, typeId, date, heure, dureeMin, note, abandonnee }   (séance prévue une seule fois)
      seances: [], // { id, typeId, typeNom, icone, date, dureeMin, ressenti, note, prevueCle, circuitId, circuitNom, creeLe, modifieLe }
      // Circuits personnalisés, rangés par type de séance (la « catégorie de sport »).
      circuits: [], // { id, nom, typeId | null, note, exercices: [{ id, titre, series, repetitions, dureeSec, reposSec, detail }] }
    },

    // Nourriture : planning des repas de la semaine et liste de courses. Aucun compteur de calories.
    nourriture: {
      repas: [], // { id, date, moment, texte, ingredients: [texte] }
      courses: [], // { id, texte, coche, origine: 'main' | 'repas', creeLe }
      recettes: [], // { id, titre, ingredients: [texte], etapes: texte, creeLe, modifieLe }
    },

    // Maison : le ménage et l'entretien « à rythme souple » (une tâche revient un certain temps
    // après la dernière fois où elle a été faite). Les « faits » sont dans `coches`
    // (clé « maison-tache|<id>|<date> ») : une seule source de vérité.
    maison: {
      zones: [], // { id, nom, icone }  (pièces, entretien, balcon…)
      taches: [], // { id, zoneId, titre, intervalleJours, dureeMin, debut, dernierInitial, repousseJusqua, archivee }
      parJour: 2, // combien de petites choses proposées par jour dans Aujourd'hui
      // Plantes du balcon : chaque soin (arrosage, engrais…) a un rythme d'été et un rythme d'hiver.
      plantes: [], // { id, nom, emplacement, note, icone, soins: [{ id, type, joursEte, joursHiver, debut, dernierInitial, repousseJusqua }] }
      saison: { debutEte: 4, debutHiver: 10 }, // mois où l'été / l'hiver commencent (avril, octobre)
      // Projets découpés en étapes : seule la prochaine étape des projets « en cours » est proposée.
      projets: [], // { id, titre, icone, note, enCours, etapes: [{ id, titre, dureeMin, faitLe }] }
    },

    // Administratif : les échéances (assurance, impôts, contrats…). Jamais de mot de passe ni de numéro de compte.
    administratif: {
      echeances: [], // { id, titre, date | null, repeteMois, rappelJours, note, faits: [{ date, faitLe }], archivee }
      // Fiches : contacts, garanties, références (jamais de mot de passe ni de numéro de compte).
      fiches: [], // { id, type: 'contact'|'garantie'|'reference', titre, note, + champs propres au type, creeLe }
    },

    // Budget : revenus et charges fixes (valables chaque mois), enveloppes, dépenses datées. Jamais de numéro de compte.
    budget: {
      revenus: [], // { id, nom, montant }
      fixes: [], // { id, nom, montant }
      postes: [], // { id, nom, icone, plafond | null }   (les « enveloppes » : courses, sorties…)
      depenses: [], // { id, date, montant, posteId | null, note, creeLe }
      // Économies : des objectifs et ce qu'on y met de côté (un versement négatif = on reprend de l'argent).
      objectifs: [], // { id, nom, icone, cible | null, echeance | null, versements: [{ id, date, montant, note }], creeLe }
      // Prêts : ce qu'on rembourse. Les paiements notés servent à recalculer le reste à rembourser.
      prets: [], // { id, nom, icone, capital, taux, mensualite, debut | null, paiements: [{ id, date, montant, note }], creeLe }
    },

    // Loisirs : des envies rangées en listes (à lire, à voir…), avec une note sur 5 et un avis une fois terminées.
    loisirs: {
      listes: [
        { id: 'lire', nom: 'À lire', icone: '📖', auteur: true },
        { id: 'voir', nom: 'À voir', icone: '🎬', auteur: false },
        { id: 'ecouter', nom: 'À écouter', icone: '🎧', auteur: false },
        { id: 'essayer', nom: 'À essayer', icone: '🎯', auteur: false },
        { id: 'visiter', nom: 'À visiter', icone: '📍', auteur: false },
      ], // { id, nom, icone, auteur }   (auteur : la liste propose un champ « Auteur » sur chaque envie)
      envies: [], // { id, listeId, titre, auteur, note, lien, statut: 'a-faire'|'en-cours'|'fini', etoiles: 1..5 | null, avis, creeLe, termineLe | null }
    },

    // Bien-être : check-in du jour (un par date), journal, habitudes.
    bienEtre: {
      checkins: [], // { id, date, humeur, energie, sommeilHeures, sommeilQualite, note }
      journal: [], // { id, date, amorce, texte, creeLe, modifieLe }
      habitudes: [], // { id, titre, jours: [dow] (vide = chaque jour), debut, archivee }
    },

    // Motivation : mon « pourquoi » et mes phrases / citations (une s'affiche chaque jour sur l'accueil).
    motivation: {
      pourquoi: '',
      phrases: [], // { id, texte, auteur, type: 'citation' | 'phrase' }
    },

    // Bilans de la semaine : un par semaine (identifiée par son lundi), avec le récap figé au moment du bilan.
    bilan: {
      bilans: [], // { id, lundi, fiere, difficile, priorites: [texte], recap, creeLe, modifieLe }
      // « Préparer ma semaine » : une par semaine (identifiée par son lundi) ; ses priorités passent avant celles du bilan.
      preparations: [], // { id, lundi, priorites: [texte], creeLe, modifieLe }
    },

    // Brain dump : idées notées en vrac, rangées (ou non) dans une catégorie, puis transformées en tâches. Suivi du corps optionnel.
    carnet: {
      notes: [], // { id, date, texte, categorieId, creeLe, modifieLe }
      corps: {
        actif: false,
        champs: [
          { id: 'poids', nom: 'Poids', unite: 'kg', suivi: true },
          { id: 'taille', nom: 'Tour de taille', unite: 'cm', suivi: true },
          { id: 'hanches', nom: 'Hanches', unite: 'cm', suivi: true },
          { id: 'poitrine', nom: 'Poitrine', unite: 'cm', suivi: true },
          { id: 'bras', nom: 'Bras', unite: 'cm', suivi: true },
          { id: 'cuisses', nom: 'Cuisses', unite: 'cm', suivi: true },
        ],
        mesures: [], // { id, date, valeurs: { poids: 62.4, … } }
      },
    },
  };
}

// Complète les données d'un ancien fichier avec les listes ajoutées depuis.
export function migrer(donnees) {
  const defaut = donneesParDefaut();
  // Les échéances ont quitté la Maison pour leur propre domaine « Administratif ».
  if (donnees.maison && Array.isArray(donnees.maison.echeances)) {
    if (!donnees.administratif || typeof donnees.administratif !== 'object') donnees.administratif = {};
    const deja = Array.isArray(donnees.administratif.echeances) ? donnees.administratif.echeances : [];
    donnees.administratif.echeances = [...deja, ...donnees.maison.echeances];
    delete donnees.maison.echeances;
  }
  // Les fiches (contacts, garanties, références) aussi : elles vivent dans « Administratif ».
  if (donnees.maison && Array.isArray(donnees.maison.fiches)) {
    if (!donnees.administratif || typeof donnees.administratif !== 'object') donnees.administratif = {};
    const deja = Array.isArray(donnees.administratif.fiches) ? donnees.administratif.fiches : [];
    donnees.administratif.fiches = [...deja, ...donnees.maison.fiches];
    delete donnees.maison.fiches;
  }
  // Un ancien fichier reçoit la catégorie « Administratif » (juste après la Maison).
  if (Array.isArray(donnees.categories) && donnees.categories.length > 0 && !donnees.categories.some((c) => c.id === 'administratif')) {
    const nouvelle = defaut.categories.find((c) => c.id === 'administratif');
    const i = donnees.categories.findIndex((c) => c.id === 'maison');
    donnees.categories.splice(i === -1 ? donnees.categories.length : i + 1, 0, { ...nouvelle });
  }
  // Un ancien fichier reçoit la catégorie « Budget » (après l'Administratif) ; « Autre » passe en coulisse.
  if (Array.isArray(donnees.categories) && donnees.categories.length > 0 && !donnees.categories.some((c) => c.id === 'budget')) {
    const nouvelle = defaut.categories.find((c) => c.id === 'budget');
    const i = donnees.categories.findIndex((c) => c.id === 'administratif');
    donnees.categories.splice(i === -1 ? donnees.categories.length : i + 1, 0, { ...nouvelle });
    const autre = donnees.categories.find((c) => c.id === 'autre');
    if (autre) autre.archivee = true;
  }
  // Un ancien fichier reçoit la catégorie « Loisirs » (après le Corps).
  if (Array.isArray(donnees.categories) && donnees.categories.length > 0 && !donnees.categories.some((c) => c.id === 'loisirs')) {
    const nouvelle = defaut.categories.find((c) => c.id === 'loisirs');
    const i = donnees.categories.findIndex((c) => c.id === 'corps');
    donnees.categories.splice(i === -1 ? donnees.categories.length : i + 1, 0, { ...nouvelle });
  }
  // Les listes de loisirs créées avant le champ « Auteur » : seule « À lire » le propose au départ.
  if (donnees.loisirs && Array.isArray(donnees.loisirs.listes)) {
    for (const l of donnees.loisirs.listes) {
      if (l && l.auteur === undefined) l.auteur = l.id === 'lire';
    }
  }
  for (const [cle, valeur] of Object.entries(defaut)) {
    if (donnees[cle] === undefined) donnees[cle] = valeur;
    // Un niveau plus bas : les domaines (études…) qui gagnent de nouvelles listes les reçoivent aussi.
    else if (valeur && typeof valeur === 'object' && !Array.isArray(valeur) && cle !== 'meta' && cle !== 'coches') {
      for (const [sous, valeurSous] of Object.entries(valeur)) {
        if (donnees[cle][sous] === undefined) donnees[cle][sous] = valeurSous;
      }
    }
  }
  for (const [cle, valeur] of Object.entries(defaut.meta)) {
    if (donnees.meta[cle] === undefined) donnees.meta[cle] = valeur;
  }
  donnees.meta.schemaVersion = VERSION;
  return donnees;
}

export function nouvelId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---- Import d'une sauvegarde ----

// Vérifie qu'un fichier ressemble bien à une sauvegarde du dashboard avant de remplacer quoi que ce soit.
// Rend { donnees, resume } si c'est bon, ou { erreurs } sinon. Ne modifie rien.
export function validerSauvegarde(brut) {
  const erreurs = [];
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) {
    return { erreurs: ["Ce fichier n'est pas une sauvegarde du dashboard (il doit contenir un objet JSON)."] };
  }
  if (!brut.meta || typeof brut.meta !== 'object') {
    erreurs.push("Il manque la partie « meta » : ce n'est pas une sauvegarde du dashboard.");
  } else if (typeof brut.meta.schemaVersion === 'number' && brut.meta.schemaVersion > VERSION) {
    erreurs.push(`Cette sauvegarde vient d'une version plus récente du dashboard (version ${brut.meta.schemaVersion}) : elle ne peut pas être importée ici.`);
  }
  if (!Array.isArray(brut.categories) || brut.categories.length === 0) {
    erreurs.push('Il manque la liste des catégories.');
  } else if (brut.categories.some((c) => !c || typeof c.id !== 'string' || typeof c.nom !== 'string')) {
    erreurs.push('La liste des catégories est abîmée.');
  }
  for (const cle of ['taches', 'rendezvous', 'routines']) {
    if (brut[cle] !== undefined && !Array.isArray(brut[cle])) erreurs.push(`« ${cle} » devrait être une liste.`);
  }
  if (brut.coches !== undefined && (typeof brut.coches !== 'object' || Array.isArray(brut.coches))) {
    erreurs.push('Les cases cochées sont abîmées.');
  }
  if (erreurs.length) return { erreurs };

  const donnees = migrer(JSON.parse(JSON.stringify(brut)));
  const n = (liste) => (Array.isArray(liste) ? liste.length : 0);
  return {
    donnees,
    resume: {
      taches: n(donnees.taches),
      rendezvous: n(donnees.rendezvous),
      chapitres: n(donnees.etudes?.chapitres),
      journal: n(donnees.bienEtre?.journal),
      checkins: n(donnees.bienEtre?.checkins),
      avancees: n(donnees.carnet?.notes),
      seances: n(donnees.sport?.seances),
      repas: n(donnees.nourriture?.repas),
      bilans: n(donnees.bilan?.bilans),
      creeLe: donnees.meta?.creeLe || null,
    },
  };
}
