// Rendez-vous : un titre, une date, une heure (facultative), un lieu ou un lien,
// une note et une catégorie. Ce fichier ne touche pas à l'affichage : il décide
// « quel rendez-vous tombe quel jour » et propose les actions.

import { enregistrerFournisseur } from '../registry.js';
import { nouvelId } from '../schema.js';
import { estUnLien } from './liens.js';

enregistrerFournisseur((date, donnees) =>
  donnees.rendezvous
    .filter((r) => r.date === date)
    .map((r) => ({
      source: 'rdv',
      id: r.id,
      date,
      titre: r.titre,
      categorieId: r.categorieId,
      type: 'rdv',
      heure: r.heure || '',
      lieu: r.lieu || '',
      note: r.note || '',
    }))
);

// Tri : « toute la journée » d'abord, puis par heure.
export function trierRendezVous(items) {
  return [...items].sort((a, b) => {
    if ((a.heure || '') === (b.heure || '')) return a.titre.localeCompare(b.titre, 'fr');
    return (a.heure || '') < (b.heure || '') ? -1 : 1;
  });
}

export { estUnLien };

function nettoyer({ titre, date, heure, lieu, note, categorieId }) {
  return {
    titre: titre.trim(),
    date,
    heure: heure || '',
    lieu: (lieu || '').trim(),
    note: (note || '').trim(),
    categorieId,
  };
}

export function ajouterRendezVous(donnees, valeurs) {
  const rdv = { id: nouvelId(), ...nettoyer(valeurs), creeLe: new Date().toISOString() };
  donnees.rendezvous.push(rdv);
  return rdv;
}

export function modifierRendezVous(donnees, id, valeurs) {
  const rdv = donnees.rendezvous.find((r) => r.id === id);
  if (rdv) Object.assign(rdv, nettoyer(valeurs));
}

export function supprimerRendezVous(donnees, id) {
  const index = donnees.rendezvous.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const [rdv] = donnees.rendezvous.splice(index, 1);
  return { rdv, index };
}

export function restaurerRendezVous(donnees, { rdv, index }) {
  donnees.rendezvous.splice(Math.min(index, donnees.rendezvous.length), 0, rdv);
}
