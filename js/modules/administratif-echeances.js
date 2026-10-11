// Administratif › « Échéances » : ce qui revient à date fixe (assurance, impôts, contrats…).
// Même style que le reste : « à régler bientôt » d'abord, puis la liste, une action par ligne.

import { h, vider, pastilles, etincelles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as E from './echeances-donnees.js';
import { ouvrirEcheance, ouvrirIdeesEcheances } from './ui-echeances.js';

function boutonRegle(e, etat) {
  return h(
    'button',
    {
      class: 'bouton bouton-petit bouton-turquoise',
      type: 'button',
      title: 'C’est réglé',
      onclick: (ev) => {
        etincelles(ev.currentTarget);
        store.modifier((d) => E.marquerFaite(d, e.id, aujourdhui()));
      },
    },
    etat.depassee ? 'C’est réglé ✓' : 'Réglé ✓'
  );
}

function titreCliquable(e) {
  return h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier cette échéance', onclick: () => ouvrirEcheance({ id: e.id }) }, e.titre);
}

function metaEcheance(e, etat, jour) {
  const morceaux = [];
  if (e.date) morceaux.push(E.dateLisible(e.date, jour));
  if (e.repeteMois > 0) morceaux.push(E.nomRepetition(e.repeteMois).toLowerCase());
  const relatif = E.texteRelatif(etat);
  if (etat.sansDate || etat.visible) morceaux.unshift(relatif);
  return morceaux.join(' · ');
}

export function rendreEcheances(conteneur) {
  const donnees = store.lire();
  const jour = aujourdhui();
  const toutes = donnees.administratif.echeances.map((e) => ({ e, etat: E.etatEcheance(e, jour) }));
  vider(conteneur);

  if (toutes.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--turquoise)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes échéances 📅')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, "Assurance, impôts, contrats : note la date une fois, et le dashboard te le rappelle à l'approche, puis chaque année si tu veux. Jamais de mot de passe ici."),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: ouvrirIdeesEcheances }, "💡 Partir d'idées"),
            h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirEcheance({}) }, '＋ Ajouter une échéance')
          )
        )
      )
    );
    return;
  }

  const bientot = toutes.filter((x) => x.etat.visible).sort((a, b) => a.etat.joursAvant - b.etat.joursAvant);
  const avecDate = toutes.filter((x) => !x.etat.archivee && !x.etat.sansDate && !x.etat.visible).sort((a, b) => (a.e.date < b.e.date ? -1 : 1));
  const sansDate = toutes.filter((x) => x.etat.sansDate);
  const reglees = toutes.filter((x) => x.etat.archivee);

  const ligne = ({ e, etat }, avecBouton) =>
    h(
      'li',
      { class: 'ligne ligne-tache-maison' + (etat.visible ? ' a-faire' : '') },
      h('div', { class: 'ligne-bloc' }, titreCliquable(e), h('span', { class: 'meta' }, metaEcheance(e, etat, jour))),
      avecBouton && h('div', { class: 'actions-ligne' }, boutonRegle(e, etat))
    );

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'À régler bientôt')),
        bientot.length === 0
          ? h('div', { class: 'fenetre-corps' }, h('p', { class: 'doux' }, 'Rien à régler pour le moment ✦'))
          : h('ul', { class: 'fenetre-corps liste' }, bientot.map((x) => ligne(x, true)))
      ),

      (avecDate.length > 0 || sansDate.length > 0) &&
        h(
          'div',
          { class: 'pile' },
          h('h2', { class: 'titre-section' }, 'Mes autres échéances'),
          h('ul', { class: 'liste-simple' }, avecDate.map((x) => ligne(x, false)), sansDate.map((x) => ligne(x, false)))
        ),

      reglees.length > 0 &&
        h(
          'details',
          { class: 'repliable-discret' },
          h('summary', null, `Déjà réglées (${reglees.length})`),
          h('ul', { class: 'liste-simple' }, reglees.map((x) => ligne(x, false)))
        ),

      h(
        'div',
        { class: 'barre-discrete' },
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirEcheance({}) }, '＋ Échéance'),
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ouvrirIdeesEcheances }, '💡 Des idées')
      )
    )
  );
}
