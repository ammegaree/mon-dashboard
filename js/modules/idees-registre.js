// Les « adaptations » d'une idée du brain dump, par catégorie.
//
// Une idée rangée dans Nourriture peut devenir une recette, une liste de courses ou un repas du planning ;
// dans Maison, un projet ou une tâche de ménage ; etc. Chaque module décrit ses adaptations ici
// (voir idees-actions.js) ; la fenêtre d'une idée les affiche selon la catégorie choisie.
//
//   action = { id, libelle, executer(note, retirer) }
//   `retirer()` retire l'idée du brain dump : à appeler une fois l'adaptation enregistrée.

const parCategorie = new Map();

export function enregistrerActionIdee(categorieId, action) {
  if (!parCategorie.has(categorieId)) parCategorie.set(categorieId, []);
  parCategorie.get(categorieId).push(action);
}

export function actionsIdee(categorieId) {
  return categorieId ? parCategorie.get(categorieId) || [] : [];
}
