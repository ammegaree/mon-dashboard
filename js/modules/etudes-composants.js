// Petites briques partagées par les onglets Études.

import { h } from '../ui.js';
import { STATUTS } from './etudes-donnees.js';

// Liste déroulante des chapitres, regroupés par module.
export function selecteurChapitre(donnees, { valeur = null, avecAucun = true, texteAucun = 'Sans chapitre précis', id = null, surChangement = null } = {}) {
  const { modules, chapitres } = donnees.etudes;
  const groupes = modules
    .map((m) => ({ m, liste: chapitres.filter((c) => c.moduleId === m.id) }))
    .filter((g) => g.liste.length > 0)
    .map((g) =>
      h(
        'optgroup',
        { label: g.m.titre },
        g.liste.map((c) => h('option', { value: c.id, selected: c.id === valeur }, c.titre))
      )
    );
  const select = h(
    'select',
    { class: 'champ', id, 'aria-label': 'Chapitre', onchange: surChangement ? (e) => surChangement(e.target.value || null) : null },
    avecAucun && h('option', { value: '' }, texteAucun),
    groupes
  );
  select.value = valeur || '';
  return select;
}

export function nomStatut(id) {
  return STATUTS.find((s) => s.id === id)?.nom || id;
}
