// Administratif › « Fiches » : mes contacts, mes garanties, mes références. Même style que le reste :
// trois cartes à ouvrir une par une, puis une liste simple (un titre cliquable, un petit résumé).

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import * as F from './fiches-donnees.js';
import { ouvrirFiche } from './ui-fiches.js';

let typeOuvert = null; // null : les trois cartes ; sinon 'contact' | 'garantie' | 'reference'
let recherche = '';

function majuscule(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Un bouton « ＋ Contact » : crée la fiche, puis ouvre la liste de cette sorte.
function boutonAjout(t, avecIcone = false) {
  return h(
    'button',
    {
      class: 'bouton bouton-petit' + (t.id === 'contact' ? ' bouton-jaune' : ''),
      type: 'button',
      onclick: () => ouvrirFiche({ type: t.id, surCreation: () => { typeOuvert = t.id; } }),
    },
    `＋ ${avecIcone ? `${t.icone} ` : ''}${majuscule(t.un)}`
  );
}

// Le petit résumé d'une fiche, selon sa sorte.
function resume(f) {
  if (f.type === 'contact') {
    return [f.role, f.telephone, f.email].filter(Boolean).join(' · ');
  }
  if (f.type === 'garantie') {
    return [f.magasin, F.texteGarantie(f)].filter(Boolean).join(' · ');
  }
  return [f.valeur, f.ou].filter(Boolean).join(' · ');
}

function ligneFiche(f) {
  const garantieBientot = f.type === 'garantie' && F.etatGarantie(f).bientot;
  return h(
    'li',
    { class: 'ligne ligne-tache-maison' + (garantieBientot ? ' a-faire' : '') },
    h(
      'div',
      { class: 'ligne-bloc' },
      h('button', { class: 'titre-cliquable', type: 'button', title: 'Ouvrir cette fiche', onclick: () => ouvrirFiche({ id: f.id }) }, f.titre),
      h('span', { class: 'meta' }, resume(f))
    ),
    // Un téléphone ou un e-mail : un seul geste pour appeler / écrire.
    f.type === 'contact' && f.telephone
      ? h('div', { class: 'actions-ligne' }, h('a', { class: 'bouton bouton-petit', href: `tel:${f.telephone.replace(/\s+/g, '')}` }, '📞 Appeler'))
      : null
  );
}

export function rendreFiches(conteneur, ctx) {
  const donnees = store.lire();
  const total = donnees.administratif.fiches.length;
  vider(conteneur);

  if (total === 0) {
    typeOuvert = null;
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes fiches 📇')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, 'Les repères qu’on cherche toujours au mauvais moment : le numéro du plombier, la fin de garantie du lave-linge, la teinte de la peinture du salon. Jamais de mot de passe.'),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            F.TYPES_FICHE.map((t) => boutonAjout(t, true))
          )
        )
      )
    );
    return;
  }

  // Une sorte de fiche ouverte : sa liste. En haut : retour à gauche, ajout à droite, puis la recherche.
  if (typeOuvert) {
    const t = F.typeFiche(typeOuvert);
    const liste = F.fichesDuType(donnees, t.id, recherche);
    const nb = donnees.administratif.fiches.filter((f) => f.type === t.id).length;
    conteneur.append(
      h(
        'div',
        { class: 'pile pile-large' },
        h(
          'div',
          { class: 'barre-actions' },
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { typeOuvert = null; recherche = ''; ctx.redessiner(); } }, '← Toutes les fiches'),
          h('button', { class: 'bouton bouton-petit bouton-jaune', type: 'button', onclick: () => ouvrirFiche({ type: t.id }) }, `＋ ${majuscule(t.un)}`)
        ),
        nb >= 8 &&
          h('input', {
            type: 'search',
            class: 'champ champ-recherche',
            placeholder: 'Chercher…',
            value: recherche,
            'aria-label': 'Chercher une fiche',
            oninput: (e) => {
              recherche = e.target.value;
              ctx.redessiner();
            },
          }),
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--turquoise)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, `${t.icone} ${t.nom}`), h('span', { class: 'mono' }, String(nb))),
          liste.length
            ? h('ul', { class: 'fenetre-corps liste' }, liste.map(ligneFiche))
            : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, recherche ? 'Aucune fiche ne correspond.' : `Rien ici pour le moment : ajoute ${t.id === 'contact' ? 'un premier contact' : t.id === 'garantie' ? 'une première garantie' : 'une première référence'} avec le bouton en haut.`))
        )
      )
    );
    return;
  }

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'grille-zones' },
        F.TYPES_FICHE.map((t) => {
          const n = donnees.administratif.fiches.filter((f) => f.type === t.id).length;
          const bientot = t.id === 'garantie' ? donnees.administratif.fiches.filter((f) => f.type === 'garantie' && F.etatGarantie(f).bientot).length : 0;
          return h(
            'button',
            {
              class: 'carte-zone' + (bientot ? ' a-faire' : ''),
              type: 'button',
              onclick: () => {
                typeOuvert = t.id;
                ctx.redessiner();
              },
            },
            h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, t.icone),
            h(
              'span',
              { class: 'carte-zone-texte' },
              h('strong', null, t.nom),
              h('span', { class: 'meta' }, n === 0 ? 'aucune' : `${n} fiche${n > 1 ? 's' : ''}${bientot ? ` · ${bientot} se termine bientôt` : ''}`)
            )
          );
        })
      )
    )
  );
}

// Quand on arrive d'ailleurs, on repart des trois cartes.
export function reinitialiserFiches() {
  typeOuvert = null;
  recherche = '';
}
