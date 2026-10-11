// Routines du matin et du soir : des listes d'étapes que tu définis toi-même,
// à cocher chaque jour. Chaque étape devient un élément du jour.

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';

enregistrerFournisseur((date, donnees) =>
  donnees.routines.flatMap((routine) =>
    routine.etapes.map((etape) => ({
      source: 'routine',
      id: etape.id,
      date,
      titre: etape.titre,
      categorieId: null,
      type: 'tache',
      groupe: `routine:${routine.id}`,
    }))
  )
);

// Remplace les étapes d'une routine. On garde les identifiants des étapes
// qui existaient déjà, pour que l'historique des cases cochées reste juste.
export function enregistrerEtapes(donnees, routineId, brouillon) {
  const routine = donnees.routines.find((r) => r.id === routineId);
  if (!routine) return;
  routine.etapes = brouillon
    .map((e) => ({ id: e.id || nouvelId(), titre: e.titre.trim() }))
    .filter((e) => e.titre);
}
