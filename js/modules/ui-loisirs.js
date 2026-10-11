// Les fenêtres des loisirs : une envie (avec ses étoiles et son avis une fois terminée), une liste.

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as L from './loisirs-donnees.js';

let derniereListe = '';

// « Frank Herbert » : l'auteur d'une envie, en petit sous le titre. null s'il n'y en a pas.
export function auteurEnvie(envie) {
  return envie.auteur ? h('span', { class: 'envie-auteur' }, `de ${envie.auteur}`) : null;
}

// Le lien d'une envie, cliquable (s'ouvre dans un nouvel onglet). null s'il n'y en a pas.
export function lienEnvie(envie) {
  const url = L.lienPropre(envie.lien);
  return url ? h('a', { class: 'lien-rdv lien-envie', href: url, target: '_blank', rel: 'noopener noreferrer', title: url }, '🔗 Ouvrir le lien') : null;
}

// Cinq étoiles cliquables. Un clic sur l'étoile déjà choisie l'enlève (pas de note).
export function champEtoiles({ valeur = null, surChoix }) {
  let courante = L.etoilesValides(valeur);
  const boutons = [1, 2, 3, 4, 5].map((n) =>
    h(
      'button',
      {
        class: 'etoile-bouton',
        type: 'button',
        'aria-label': `${n} étoile${n > 1 ? 's' : ''} sur 5`,
        'aria-pressed': 'false',
        onclick: () => {
          courante = courante === n ? null : n;
          maj();
          surChoix?.(courante);
        },
      },
      '★'
    )
  );
  const maj = () => {
    boutons.forEach((b, i) => {
      const allumee = courante !== null && i < courante;
      b.classList.toggle('allumee', allumee);
      b.setAttribute('aria-pressed', courante === i + 1 ? 'true' : 'false');
    });
  };
  maj();
  return h('div', { class: 'etoiles', role: 'group', 'aria-label': 'Ma note sur 5' }, boutons);
}

// `statut` : un état de départ (par exemple « fini » depuis le bouton « Terminé ») ; `titre` / `listeId` :
// des valeurs de départ ; `surEnregistrement` : appelé une fois l'envie enregistrée.
export function ouvrirEnvie({ id = null, titre: titreInitial = '', listeId: listeInitiale = null, statut: statutInitial = null, surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existante = id ? L.envieParId(donnees, id) : null;
  if (id && !existante) return;
  const listes = donnees.loisirs.listes;
  if (listes.length === 0) {
    notifier('Crée d’abord une liste (à lire, à voir…).');
    return;
  }
  const voulue = existante?.listeId || listeInitiale || derniereListe;
  const etat = {
    listeId: listes.some((l) => l.id === voulue) ? voulue : listes[0].id,
    statut: statutInitial || existante?.statut || 'a-faire',
    etoiles: existante?.etoiles ?? null,
  };

  ouvrirModale({
    titre: statutInitial === 'fini' && existante && existante.statut !== 'fini' ? 'C’est terminé ! 🎉' : existante ? 'Modifier' : 'Nouvelle envie',
    couleur: 'violet',
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', maxLength: 160, placeholder: 'Ex. Dune, Le Voyage de Chihiro, un cours de poterie…', 'aria-label': 'Titre', value: existante?.titre || titreInitial });
      const auteur = h('input', { type: 'text', class: 'champ', maxLength: 100, placeholder: 'Auteur (facultatif)', 'aria-label': 'Auteur', value: existante?.auteur || '' });
      const montrerAuteur = () => {
        const liste = listes.find((l) => l.id === etat.listeId);
        // Le champ apparaît pour les listes qui le proposent, ou quand l'envie a déjà un auteur.
        auteur.hidden = !((liste && liste.auteur) || auteur.value.trim() !== '');
      };
      const note = h('textarea', { class: 'champ champ-note', rows: 2, maxLength: 600, placeholder: 'Qui te l’a conseillé, où le trouver, pourquoi tu en as envie… (facultatif)', 'aria-label': 'Note' }, existante?.note || '');
      const lien = h('input', { type: 'text', class: 'champ', maxLength: 500, placeholder: 'Lien (https://…) : fiche du film, du livre, de l’activité… (facultatif)', 'aria-label': 'Lien', value: existante?.lien || '' });
      const date = h('input', { type: 'date', class: 'champ', id: 'en-date', value: existante?.termineLe || aujourdhui() });
      const avis = h('textarea', { class: 'champ champ-note', rows: 4, maxLength: 2000, placeholder: 'Ton avis, en quelques mots… (facultatif)', 'aria-label': 'Mon avis' }, existante?.avis || '');

      const choixListe = listes.map((l) =>
        h(
          'label',
          { class: 'puce', style: '--cat: var(--violet)' },
          h('input', { type: 'radio', name: 'en-liste', value: l.id, checked: l.id === etat.listeId, onchange: () => {
              etat.listeId = l.id;
              montrerAuteur();
            },
          }),
          h('span', null, `${l.icone} ${l.nom}`)
        )
      );

      // Le bloc « mon avis » n'apparaît que quand c'est terminé.
      const blocAvis = h(
        'div',
        { class: 'pile bloc-avis' },
        h('span', { class: 'etiquette' }, 'Ma note'),
        champEtoiles({ valeur: etat.etoiles, surChoix: (n) => (etat.etoiles = n) }),
        avis,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'en-date' }, 'Terminé le'), date)
      );
      blocAvis.hidden = etat.statut !== 'fini';

      const choixStatut = L.STATUTS.map((s) =>
        h(
          'label',
          { class: 'puce', style: '--cat: var(--jaune)' },
          h('input', {
            type: 'radio',
            name: 'en-statut',
            value: s.id,
            checked: s.id === etat.statut,
            onchange: () => {
              etat.statut = s.id;
              blocAvis.hidden = etat.statut !== 'fini';
            },
          }),
          h('span', null, s.nom)
        )
      );

      montrerAuteur();
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!titre.value.trim()) {
              titre.classList.add('champ-erreur');
              titre.focus();
              return;
            }
            if (lien.value.trim() && !L.lienPropre(lien.value)) {
              lien.classList.add('champ-erreur');
              lien.focus();
              notifier('Ce lien n’a pas l’air valide : colle une adresse qui commence par https://');
              return;
            }
            derniereListe = etat.listeId;
            const valeurs = { titre: titre.value, auteur: auteur.value, listeId: etat.listeId, note: note.value, lien: lien.value, statut: etat.statut };
            if (etat.statut === 'fini') Object.assign(valeurs, { etoiles: etat.etoiles, avis: avis.value, termineLe: date.value || aujourdhui() });
            let ok = true;
            if (existante) store.modifier((d) => (ok = Boolean(L.modifierEnvie(d, existante.id, valeurs))));
            else {
              store.modifier((d) => {
                const cree = L.ajouterEnvie(d, { titre: titre.value, auteur: auteur.value, listeId: etat.listeId, note: note.value, lien: lien.value });
                ok = Boolean(cree);
                if (cree && etat.statut !== 'a-faire') L.modifierEnvie(d, cree.id, valeurs);
              });
            }
            if (!ok) return;
            surEnregistrement?.();
            fermer();
            notifier(existante ? 'Enregistré ✦' : etat.statut === 'fini' ? 'Noté, bravo ✦' : 'Ajouté à tes envies ✦');
          },
        },
        titre,
        auteur,
        h('div', { class: 'pile pile-serre' }, h('span', { class: 'etiquette' }, 'Dans quelle liste ?'), h('div', { class: 'puces', role: 'radiogroup', 'aria-label': 'Liste' }, choixListe)),
        note,
        lien,
        h('div', { class: 'pile pile-serre' }, h('span', { class: 'etiquette' }, 'Où j’en suis'), h('div', { class: 'puces', role: 'radiogroup', 'aria-label': 'État' }, choixStatut)),
        blocAvis,
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = L.supprimerEnvie(d, existante.id)));
                  fermer();
                  if (retire) notifier('Envie supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => L.restaurerEnvie(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
  setTimeout(() => document.querySelector('dialog[open] input.champ-titre')?.focus(), 0);
}

// ---- Une liste ----

export function ouvrirListe({ id = null, surCreation = null } = {}) {
  const donnees = store.lire();
  const existante = id ? L.listeParId(donnees, id) : null;
  if (id && !existante) return;
  const nbEnvies = existante ? L.enviesDeListe(donnees, existante.id).length : 0;

  ouvrirModale({
    titre: existante ? 'Modifier la liste' : 'Nouvelle liste',
    couleur: 'violet',
    corps: (fermer) => {
      const icone = h('input', { type: 'text', class: 'champ champ-icone', maxLength: 8, value: existante?.icone || '✨', 'aria-label': 'Emoji' });
      const nom = h('input', { type: 'text', class: 'champ champ-titre', maxLength: 40, placeholder: 'Ex. À jouer, Restos à tester, Séries…', 'aria-label': 'Nom de la liste', value: existante?.nom || '' });
      const auteur = h('input', { type: 'checkbox', checked: Boolean(existante?.auteur) });
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!nom.value.trim()) {
              nom.classList.add('champ-erreur');
              nom.focus();
              return;
            }
            if (existante) store.modifier((d) => L.modifierListe(d, existante.id, { nom: nom.value, icone: icone.value, auteur: auteur.checked }));
            else {
              let cree = null;
              store.modifier((d) => (cree = L.ajouterListe(d, { nom: nom.value, icone: icone.value, auteur: auteur.checked })));
              if (cree) surCreation?.(cree.id);
            }
            fermer();
            if (!existante) notifier('Liste créée ✦');
          },
        },
        h('div', { class: 'rangee-champ' }, icone, nom),
        h('label', { class: 'case-ligne' }, auteur, h('span', null, 'Noter l’auteur de chaque envie (pratique pour les livres)')),
        existante && nbEnvies > 0 && h('p', { class: 'doux' }, `Si tu supprimes cette liste, ses ${nbEnvies} envie${nbEnvies > 1 ? 's' : ''} partent avec (tu pourras annuler tout de suite après).`),
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = L.supprimerListe(d, existante.id)));
                  fermer();
                  if (retire) notifier('Liste supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => L.restaurerListe(d, retire)) } });
                },
              },
              'Supprimer la liste'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
  setTimeout(() => document.querySelector('dialog[open] input.champ-titre')?.focus(), 0);
}
