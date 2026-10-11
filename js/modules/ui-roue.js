// La roue des envies : quand je ne sais pas quoi choisir, elle tire une envie « à faire » au hasard,
// dans la liste que je choisis (ou dans toutes).

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import * as L from './loisirs-donnees.js';
import { lienEnvie, auteurEnvie } from './ui-loisirs.js';

const DUREE_MS = 2600;

const reduireMouvement = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ouvrirRoue({ listeId = '' } = {}) {
  const donnees = store.lire();
  const listes = donnees.loisirs.listes;
  const etat = { listeId: listes.some((l) => l.id === listeId) ? listeId : '', dernier: null, angle: 0, enCours: false };
  let minuteurs = [];

  const { surFermeture } = ouvrirModale({
    titre: 'La roue des envies',
    couleur: 'jaune',
    corps: (fermer) => {
      const roue = h('div', { class: 'roue', 'aria-hidden': 'true' }, h('span', { class: 'roue-moyeu' }));
      const pointe = h('span', { class: 'roue-pointe', 'aria-hidden': 'true' }, '▼');
      const resultat = h('div', { class: 'roue-resultat', 'aria-live': 'polite' });
      const bouton = h('button', { class: 'bouton bouton-jaune bouton-grand', type: 'button' }, '🎡 Tourner la roue');

      const nbPar = (id) => L.candidates(store.lire(), id).length;
      const choixListes = [{ id: '', nom: 'Toutes les listes', icone: '🎲' }, ...listes].map((l) =>
        h(
          'label',
          { class: 'puce', style: '--cat: var(--jaune)' },
          h('input', { type: 'radio', name: 'roue-liste', value: l.id, checked: l.id === etat.listeId, onchange: () => { if (!etat.enCours) { etat.listeId = l.id; etat.dernier = null; message(); } } }),
          h('span', null, `${l.icone} ${l.nom} (${nbPar(l.id)})`)
        )
      );

      const message = () => {
        const n = nbPar(etat.listeId);
        resultat.replaceChildren(
          h('p', { class: 'doux' }, n === 0 ? 'Aucune envie « à faire » ici : ajoute-en une, ou choisis une autre liste.' : `${n} envie${n > 1 ? 's' : ''} dans la roue. Prête ?`)
        );
        bouton.disabled = n === 0;
      };

      const afficher = (envie) => {
        const liste = L.listeParId(store.lire(), envie.listeId);
        resultat.replaceChildren(
          h(
            'div',
            { class: 'roue-gagnant' },
            h('p', { class: 'meta mono' }, liste ? `${liste.icone} ${liste.nom}` : ''),
            h('strong', { class: 'roue-gagnant-titre' }, envie.titre),
            auteurEnvie(envie),
            envie.note && h('p', { class: 'doux' }, envie.note),
            lienEnvie(envie),
            h(
              'div',
              { class: 'rangee rangee-souple' },
              h(
                'button',
                {
                  class: 'bouton bouton-turquoise',
                  type: 'button',
                  onclick: () => {
                    store.modifier((d) => L.changerStatut(d, envie.id, 'en-cours'));
                    fermer();
                    notifier('C’est parti, bon moment ✦');
                  },
                },
                'Je commence !'
              )
            )
          )
        );
      };

      bouton.addEventListener('click', () => {
        if (etat.enCours) return;
        const donneesCourantes = store.lire();
        const tire = L.tirerEnvie(donneesCourantes, { listeId: etat.listeId, exclure: etat.dernier });
        if (!tire) {
          message();
          return;
        }
        etat.dernier = tire.id;

        if (reduireMouvement()) {
          afficher(tire);
          return;
        }
        // La roue tourne (plusieurs tours puis ralentit) et les titres défilent jusqu'au gagnant.
        etat.enCours = true;
        bouton.disabled = true;
        etat.angle += 1440 + Math.round(Math.random() * 360);
        roue.style.transform = `rotate(${etat.angle}deg)`;
        const titres = L.candidates(donneesCourantes, etat.listeId).map((e) => e.titre);
        let i = 0;
        const defile = setInterval(() => {
          i++;
          resultat.replaceChildren(h('p', { class: 'roue-defile' }, titres[i % titres.length]));
        }, 90);
        minuteurs.push(defile);
        const fin = setTimeout(() => {
          clearInterval(defile);
          etat.enCours = false;
          bouton.disabled = false;
          bouton.textContent = '🔁 Tourner encore';
          afficher(tire);
        }, DUREE_MS);
        minuteurs.push(fin);
      });

      message();
      return h(
        'div',
        { class: 'pile roue-fenetre' },
        h('div', { class: 'pile pile-serre' }, h('span', { class: 'etiquette' }, 'Je tire dans…'), h('div', { class: 'puces', role: 'radiogroup', 'aria-label': 'Liste' }, choixListes)),
        h('div', { class: 'roue-zone' }, pointe, roue),
        resultat,
        h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Fermer'), bouton)
      );
    },
  });
  // Ferme proprement : plus aucun défilement ne tourne quand la fenêtre est partie.
  surFermeture(() => {
    minuteurs.forEach((m) => {
      clearInterval(m);
      clearTimeout(m);
    });
    minuteurs = [];
  });
}
