// La recherche rapide : une fenêtre où l'on tape quelques lettres pour retrouver n'importe quoi.
// Ouverte par le bouton « Rechercher » de la barre latérale, ou par Cmd + K (Ctrl + K) et la touche « / ».

import { h, ouvrirModale } from '../ui.js';
import * as store from '../store.js';
import * as R from './recherche-donnees.js';
import { ouvrirEdition } from './actions-taches.js';
import { ouvrirRendezVous } from './ui-rendezvous.js';
import { ouvrirEnvie } from './ui-loisirs.js';
import { ouvrirRecette, ouvrirRepas } from './ui-nourriture.js';
import { ouvrirIdee } from './ui-carnet.js';
import { ouvrirEcheance } from './ui-echeances.js';
import { ouvrirFiche } from './ui-fiches.js';
import { ouvrirNote } from './etudes-recherche.js';
import { ouvrirOngletEtudes } from './etudes.js';
import { ouvrirTacheMaison } from './ui-maison.js';
import { ouvrirPlante } from './ui-plantes.js';
import { ouvrirProjet } from './ui-projets.js';
import { ouvrirCircuit } from './ui-circuits.js';
import { ouvrirHabitude } from './bien-etre-habitudes.js';
import { ouvrirEntree } from './bien-etre-journal.js';
import { ouvrirDepense } from './ui-budget.js';
import { ouvrirObjectif } from './ui-epargne.js';
import { ouvrirPret } from './ui-pret.js';

// Va à une page ; si on y est déjà, on redessine simplement.
function versRoute(route) {
  if (location.hash === `#/${route}`) store.modifier(() => {});
  else location.hash = `#/${route}`;
}

const ACTIONS = {
  page: (r) => versRoute(r.route),
  tache: (r) => ouvrirEdition(r.id, r.date || undefined),
  rdv: (r) => ouvrirRendezVous({ id: r.id }),
  envie: (r) => ouvrirEnvie({ id: r.id }),
  recette: (r) => ouvrirRecette({ id: r.id }),
  repas: (r) => ouvrirRepas({ id: r.id }),
  idee: (r) => ouvrirIdee({ id: r.id }),
  echeance: (r) => ouvrirEcheance({ id: r.id }),
  fiche: (r) => ouvrirFiche({ id: r.id }),
  note: (r) => ouvrirNote({ id: r.id }),
  chapitre: () => {
    ouvrirOngletEtudes('parcours');
    versRoute('domaine/etudes');
  },
  qcm: () => {
    ouvrirOngletEtudes('qcm');
    versRoute('domaine/etudes');
  },
  'maison-tache': (r) => ouvrirTacheMaison({ id: r.id }),
  plante: (r) => ouvrirPlante({ id: r.id }),
  projet: (r) => ouvrirProjet({ id: r.id }),
  circuit: (r) => ouvrirCircuit({ id: r.id }),
  habitude: (r) => ouvrirHabitude({ id: r.id }),
  journal: (r) => ouvrirEntree({ id: r.id }),
  depense: (r) => ouvrirDepense({ id: r.id }),
  objectif: (r) => ouvrirObjectif({ id: r.id }),
  pret: (r) => ouvrirPret({ id: r.id }),
};

export function ouvrirRecherche() {
  // Une seule fenêtre de recherche à la fois.
  if (document.querySelector('dialog.recherche')) return;

  const { element } = ouvrirModale({
    titre: 'Rechercher',
    couleur: 'turquoise',
    large: true,
    corps: (fermer) => {
      const champ = h('input', { type: 'text', class: 'champ champ-titre champ-recherche', placeholder: 'Une tâche, une recette, un contact…', 'aria-label': 'Rechercher', autocomplete: 'off', spellcheck: 'false' });
      const zone = h('div', { class: 'recherche-resultats', role: 'listbox', 'aria-label': 'Résultats' });
      let boutons = [];
      let actif = -1;

      const choisir = (r) => {
        fermer();
        setTimeout(() => ACTIONS[r.type]?.(r), 40);
      };

      const marquerActif = (i) => {
        actif = i;
        boutons.forEach((b, k) => {
          b.classList.toggle('actif', k === i);
          b.setAttribute('aria-selected', k === i ? 'true' : 'false');
        });
        if (boutons[i]) boutons[i].scrollIntoView({ block: 'nearest' });
      };

      const ligne = (r) =>
        h(
          'button',
          { class: 'recherche-ligne', type: 'button', role: 'option', 'aria-selected': 'false', onclick: () => choisir(r) },
          h('span', { class: 'recherche-icone', 'aria-hidden': 'true' }, r.icone),
          h(
            'span',
            { class: 'recherche-texte' },
            h('strong', null, r.titre),
            (r.extrait || r.sous) && h('span', { class: 'meta' }, r.extrait || r.sous)
          )
        );

      const dessiner = () => {
        const q = champ.value;
        const donnees = store.lire();
        zone.replaceChildren();
        boutons = [];
        actif = -1;

        if (R.termes(q).length === 0 || q.trim().length < 2) {
          // Rien de tapé : des raccourcis pour aller quelque part.
          zone.append(
            h('p', { class: 'doux' }, 'Tape au moins 2 lettres. Les accents et les majuscules n’ont pas d’importance.'),
            h('p', { class: 'recherche-groupe mono' }, 'Aller à'),
            h(
              'div',
              { class: 'puces' },
              R.destinations(donnees).map((dest) =>
                h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => choisir(dest) }, `${dest.icone} ${dest.titre}`)
              )
            )
          );
          return;
        }

        const resultats = R.rechercher(donnees, q);
        if (resultats.length === 0) {
          zone.append(h('p', { class: 'vide' }, `Rien trouvé pour « ${q.trim()} ».`));
          return;
        }
        // Regroupés par sorte, dans l'ordre où ils apparaissent (les meilleurs en premier).
        const groupes = [];
        for (const r of resultats) {
          let g = groupes.find((x) => x.nom === r.groupe);
          if (!g) groupes.push((g = { nom: r.groupe, liste: [] }));
          g.liste.push(r);
        }
        for (const g of groupes) {
          zone.append(h('p', { class: 'recherche-groupe mono' }, g.nom));
          for (const r of g.liste) {
            const b = ligne(r);
            boutons.push(b);
            zone.append(b);
          }
        }
        marquerActif(0);
      };

      champ.addEventListener('input', dessiner);
      champ.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' && boutons.length) {
          e.preventDefault();
          marquerActif((actif + 1) % boutons.length);
        } else if (e.key === 'ArrowUp' && boutons.length) {
          e.preventDefault();
          marquerActif((actif - 1 + boutons.length) % boutons.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (boutons[actif]) boutons[actif].click();
        }
      });

      dessiner();
      return h('div', { class: 'pile' }, champ, zone);
    },
  });
  element.classList.add('recherche');
  setTimeout(() => element.querySelector('.champ-recherche')?.focus(), 0);
}

// Le raccourci du clavier : Cmd + K (ou Ctrl + K) depuis n'importe où, ou « / » quand on ne tape pas de texte.
export function activerRaccourciRecherche() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const cible = e.target;
    const tape = cible && (['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName) || cible.isContentEditable);
    const autreFenetre = document.querySelector('dialog[open]');
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (!autreFenetre) ouvrirRecherche();
    } else if (e.key === '/' && !tape && !autreFenetre && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      ouvrirRecherche();
    }
  });
}
