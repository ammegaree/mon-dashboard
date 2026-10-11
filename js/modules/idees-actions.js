// Ce qu'on peut faire d'une idée du brain dump, selon la catégorie où elle est rangée.
// (La transformation en simple tâche existe pour toutes les catégories : voir ui-carnet.js.)

import { enregistrerActionIdee } from './idees-registre.js';
import { ouvrirRepas, ouvrirListeCourses, ouvrirRecette } from './ui-nourriture.js';
import { ouvrirProjet } from './ui-projets.js';
import { ouvrirTacheMaison } from './ui-maison.js';
import { ouvrirEcheance } from './ui-echeances.js';
import { ouvrirPlanification } from './ui-sport.js';
import { ouvrirCircuit, ouvrirAjoutExercice } from './ui-circuits.js';
import { ouvrirDepense } from './ui-budget.js';
import { ouvrirEnvie } from './ui-loisirs.js';
import { ouvrirEntree } from './bien-etre-journal.js';
import { ouvrirNote } from './etudes-recherche.js';

// Nourriture
enregistrerActionIdee('nourriture', { id: 'recette', libelle: '📖 Adapter en recette', executer: (n, retirer) => ouvrirRecette({ titre: n.texte, surEnregistrement: retirer }) });
enregistrerActionIdee('nourriture', { id: 'courses', libelle: '🛒 Créer la liste de courses', executer: (n, retirer) => ouvrirListeCourses({ texte: n.texte, surEnregistrement: retirer }) });
enregistrerActionIdee('nourriture', { id: 'planning', libelle: '🍽️ Enregistrer dans le planning des repas', executer: (n, retirer) => ouvrirRepas({ texte: n.texte, surEnregistrement: retirer }) });

// Maison
enregistrerActionIdee('maison', { id: 'projet', libelle: '🧱 En faire un projet', executer: (n, retirer) => ouvrirProjet({ titre: n.texte, surCreation: retirer }) });
enregistrerActionIdee('maison', { id: 'menage', libelle: '🧹 Ajouter au ménage', executer: (n, retirer) => ouvrirTacheMaison({ titre: n.texte, surEnregistrement: retirer }) });

// Administratif
enregistrerActionIdee('administratif', { id: 'echeance', libelle: '📅 En faire une échéance', executer: (n, retirer) => ouvrirEcheance({ titre: n.texte, surEnregistrement: retirer }) });

// Budget
enregistrerActionIdee('budget', { id: 'depense', libelle: '💶 Noter comme dépense', executer: (n, retirer) => ouvrirDepense({ note: n.texte, surEnregistrement: retirer }) });

// Loisirs
enregistrerActionIdee('loisirs', { id: 'envie', libelle: '🎬 L’ajouter à mes envies', executer: (n, retirer) => ouvrirEnvie({ titre: n.texte, surEnregistrement: retirer }) });

// Sport : l'idée devient un exercice (dans un circuit qui existe, ou au début d'un nouveau circuit), ou une séance prévue.
enregistrerActionIdee('sport', { id: 'circuit', libelle: '🔁 Ajouter à un circuit', executer: (n, retirer) => ouvrirAjoutExercice({ titre: n.texte, surEnregistrement: retirer }) });
enregistrerActionIdee('sport', { id: 'nouveau-circuit', libelle: '🆕 Créer un nouveau circuit', executer: (n, retirer) => ouvrirCircuit({ exercicesInitiaux: [{ titre: n.texte }], surCreation: retirer }) });
enregistrerActionIdee('sport', { id: 'seance', libelle: '🗓 Planifier une séance', executer: (n, retirer) => ouvrirPlanification({ note: n.texte, surEnregistrement: retirer }) });

// Bien-être
enregistrerActionIdee('bien-etre', { id: 'journal', libelle: '📖 L’écrire dans mon journal', executer: (n, retirer) => ouvrirEntree({ texte: n.texte, surEnregistrement: retirer }) });

// Études
enregistrerActionIdee('etudes', { id: 'recherche', libelle: '🔎 En faire une note de recherche', executer: (n, retirer) => ouvrirNote({ titre: n.texte, surEnregistrement: retirer }) });

