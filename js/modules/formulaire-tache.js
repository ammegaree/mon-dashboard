// Formulaire d'une tâche : sert à l'ajout rapide et à la modification.

import { h } from '../ui.js';
import { JOURS, jourSemaine } from '../dates.js';
import { champCategories } from './champs.js';

let compteur = 0;

// valeurs : { titre, categorieId, date, recurrence }
// Renvoie { element, focus(), reinitialiser() }
export function formulaireTache({ donnees, valeurs, texteBouton, avecFin = true, surValidation, surAnnulation, surSaisie, boutonsSupplementaires = [] }) {
  const numero = ++compteur;
  const etat = {
    categorieId: valeurs.categorieId,
    frequence: valeurs.recurrence?.frequence || 'aucune',
    jours: new Set(valeurs.recurrence?.jours || []),
  };

  const champTitre = h('input', {
    type: 'text',
    class: 'champ champ-titre',
    placeholder: 'Une chose à faire…',
    value: valeurs.titre || '',
    maxLength: 200,
    required: true,
    'aria-label': 'Titre de la tâche',
    oninput: (e) => surSaisie?.(e.target.value),
  });

  const champDate = h('input', { type: 'date', class: 'champ', value: valeurs.date, required: true, id: `tache-date-${numero}` });
  const etiquetteDate = h('label', { class: 'etiquette', for: `tache-date-${numero}` }, 'Pour le');

  const champFin = h('input', { type: 'date', class: 'champ', value: valeurs.recurrence?.fin || '', id: `tache-fin-${numero}` });

  const choixFrequence = h(
    'select',
    { class: 'champ', id: `tache-freq-${numero}`, 'aria-label': 'Répétition' },
    h('option', { value: 'aucune' }, 'Une seule fois'),
    h('option', { value: 'jour' }, 'Tous les jours'),
    h('option', { value: 'semaine' }, 'Chaque semaine (jours au choix)'),
    h('option', { value: 'mois' }, 'Chaque mois (même jour)')
  );
  choixFrequence.value = etat.frequence;

  // Catégories
  const zoneCategories = champCategories({
    donnees,
    valeur: etat.categorieId,
    surChangement: (id) => (etat.categorieId = id),
  });

  // Jours de la semaine
  const zoneJours = h(
    'div',
    { class: 'puces puces-jours', role: 'group', 'aria-label': 'Jours de la semaine' },
    JOURS.map((j) =>
      h(
        'label',
        { class: 'puce puce-jour', title: j.long },
        h('input', {
          type: 'checkbox',
          value: String(j.dow),
          checked: etat.jours.has(j.dow),
          'aria-label': j.long,
          onchange: (e) => (e.target.checked ? etat.jours.add(j.dow) : etat.jours.delete(j.dow)),
        }),
        h('span', null, j.court)
      )
    )
  );

  const zoneFin = h(
    'div',
    { class: 'rangee-champ' },
    h('label', { class: 'etiquette', for: `tache-fin-${numero}` }, "Jusqu'au (facultatif)"),
    champFin
  );

  function rafraichir() {
    const recurrente = etat.frequence !== 'aucune';
    etiquetteDate.textContent = recurrente ? 'À partir du' : 'Pour le';
    zoneJours.hidden = etat.frequence !== 'semaine';
    zoneFin.hidden = !recurrente || !avecFin;
  }

  function cocherJourParDefaut() {
    if (etat.jours.size === 0 && champDate.value) {
      const dow = jourSemaine(champDate.value);
      etat.jours.add(dow);
      zoneJours.querySelectorAll('input').forEach((i) => (i.checked = etat.jours.has(Number(i.value))));
    }
  }

  choixFrequence.addEventListener('change', () => {
    etat.frequence = choixFrequence.value;
    if (etat.frequence === 'semaine') cocherJourParDefaut();
    rafraichir();
  });

  const bouton = h('button', { class: 'bouton bouton-jaune', type: 'submit' }, texteBouton);

  const element = h(
    'form',
    {
      class: 'formulaire-tache',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const titre = champTitre.value.trim();
        if (!titre) {
          champTitre.focus();
          champTitre.classList.add('champ-erreur');
          return;
        }
        champTitre.classList.remove('champ-erreur');
        if (!champDate.value) {
          champDate.focus();
          return;
        }
        let recurrence = null;
        if (etat.frequence !== 'aucune') {
          recurrence = { frequence: etat.frequence, fin: champFin.value || null, exceptions: [] };
          if (etat.frequence === 'semaine') {
            recurrence.jours = etat.jours.size ? [...etat.jours] : [jourSemaine(champDate.value)];
          }
        }
        surValidation({ titre, categorieId: etat.categorieId, date: champDate.value, recurrence });
      },
    },
    h('div', { class: 'rangee-champ rangee-titre' }, champTitre),
    zoneCategories,
    h(
      'div',
      { class: 'rangee-options' },
      h('div', { class: 'rangee-champ' }, etiquetteDate, champDate),
      h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: `tache-freq-${numero}` }, 'Se répète'), choixFrequence)
    ),
    zoneJours,
    zoneFin,
    h(
      'div',
      { class: 'rangee droite' },
      surAnnulation && h('button', { class: 'bouton', type: 'button', onclick: surAnnulation }, 'Annuler'),
      boutonsSupplementaires,
      bouton
    )
  );

  rafraichir();

  return {
    element,
    focus: () => champTitre.focus(),
    reinitialiser: () => {
      champTitre.value = '';
      champTitre.classList.remove('champ-erreur');
    },
    definirDate: (date) => {
      champDate.value = date;
    },
  };
}
