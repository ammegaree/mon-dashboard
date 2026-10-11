// Onglet « Minuteur » : sessions de concentration (25 min + 5 min de pause, réglables).

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, formatCourt } from '../dates.js';
import * as M from './minuteur.js';
import { formaterDuree, statsTemps, nomChapitre } from './etudes-donnees.js';
import { selecteurChapitre } from './etudes-composants.js';

function nombreMinutes(valeur, defaut, min, max) {
  const n = Math.round(Number(valeur));
  if (!Number.isFinite(n)) return defaut;
  return Math.min(max, Math.max(min, n));
}

export function rendreMinuteur(conteneur, ctx) {
  const donnees = store.lire();
  if (ctx.params && 'chapitreId' in ctx.params) M.choisirChapitre(ctx.params.chapitreId);

  const e = M.etat();
  const actif = e.phase !== 'inactif';
  const reglages = donnees.etudes.reglages;
  const stats = statsTemps(donnees, aujourdhui());
  const recentes = [...donnees.etudes.temps].sort((a, b) => (a.debut < b.debut ? 1 : -1)).slice(0, 6);

  // ---- Le compte à rebours ----
  const chiffres = h('div', { class: 'minuteur-chiffres mono', role: 'timer', 'aria-live': 'off' }, M.formaterCompteARebours(actif ? e.restantMs : reglages.concentrationMin * 60000));
  const remplissage = h('div', { class: 'remplissage', style: 'width: 0%' });
  const mettreAJour = () => {
    const s = M.etat();
    chiffres.textContent = M.formaterCompteARebours(s.restantMs);
    const pourcent = s.dureePhaseMs ? Math.min(100, Math.round((1 - s.restantMs / s.dureePhaseMs) * 100)) : 0;
    remplissage.style.width = `${pourcent}%`;
  };
  mettreAJour();
  if (!actif) {
    chiffres.textContent = M.formaterCompteARebours(reglages.concentrationMin * 60000);
    remplissage.style.width = '0%';
  }

  // Le compte à rebours se met à jour seul ; un changement de phase redessine l'onglet.
  const arreterEcoute = M.abonner(({ type }) => {
    if (!chiffres.isConnected) {
      arreterEcoute();
      return;
    }
    if (type === 'tick') mettreAJour();
    else ctx.redessiner();
  });

  let phaseLibelle = 'Prête quand tu l\'es';
  if (e.phase === 'travail') phaseLibelle = e.enPause ? 'En pause — reprends quand tu veux' : 'Concentration en cours';
  if (e.phase === 'pause') phaseLibelle = "Pause — respire, bois un verre d'eau ✦";

  const boutons = [];
  if (!actif) {
    boutons.push(h('button', { class: 'bouton bouton-jaune bouton-grand', type: 'button', onclick: () => M.demarrer() }, `▶ Démarrer ${reglages.concentrationMin} min`));
  } else if (e.phase === 'travail') {
    boutons.push(h('button', { class: 'bouton bouton-jaune bouton-grand', type: 'button', onclick: () => M.basculerPause() }, e.enPause ? '▶ Reprendre' : '⏸ Pause'));
    boutons.push(h('button', { class: 'bouton bouton-grand', type: 'button', onclick: () => M.arreter() }, '⏹ Terminer la session'));
  } else {
    boutons.push(h('button', { class: 'bouton bouton-grand', type: 'button', onclick: () => M.passerPause() }, 'Passer la pause'));
  }

  const selection = actif
    ? h('p', { class: 'minuteur-chapitre' }, `📖 ${nomChapitre(donnees, e.chapitreId)}`)
    : h(
        'div',
        { class: 'rangee-champ champ-large' },
        h('label', { class: 'etiquette', for: 'minuteur-chapitre' }, 'Je travaille sur'),
        selecteurChapitre(donnees, { valeur: M.chapitreSelectionne(), id: 'minuteur-chapitre', texteAucun: 'Sans chapitre précis', surChangement: (id) => M.choisirChapitre(id) })
      );

  const reglage = (cle, libelle, min, max) =>
    h(
      'div',
      { class: 'rangee-champ' },
      h('label', { class: 'etiquette', for: `reglage-${cle}` }, libelle),
      h('input', {
        type: 'number',
        class: 'champ champ-court',
        id: `reglage-${cle}`,
        min,
        max,
        value: reglages[cle],
        disabled: actif,
        onchange: (ev) => {
          const v = nombreMinutes(ev.target.value, reglages[cle], min, max);
          ev.target.value = v;
          store.modifier((d) => (d.etudes.reglages[cle] = v), { rendre: false });
          if (cle === 'concentrationMin') chiffres.textContent = M.formaterCompteARebours(v * 60000);
        },
      }),
      h('span', { class: 'meta' }, 'min')
    );

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'section',
        { class: 'fenetre fenetre-minuteur', style: `--cat: var(--${e.phase === 'pause' ? 'turquoise' : 'jaune'})` },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Minuteur de concentration')),
        h(
          'div',
          { class: 'fenetre-corps pile minuteur-corps' },
          h('p', { class: 'minuteur-phase' }, phaseLibelle),
          chiffres,
          h('div', { class: 'barre-progression' }, remplissage),
          selection,
          h('div', { class: 'rangee rangee-souple rangee-centre' }, boutons)
        )
      ),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--ciel)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Réglages')),
        h(
          'div',
          { class: 'fenetre-corps rangee-options' },
          reglage('concentrationMin', 'Concentration', 5, 120),
          reglage('pauseMin', 'Pause', 0, 60),
          actif && h('p', { class: 'doux' }, 'Les durées se règlent entre deux sessions.')
        )
      ),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--violet)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes dernières sessions'), h('span', { class: 'mono' }, `Aujourd'hui : ${formaterDuree(stats.aujourdhui)}`)),
        recentes.length
          ? h(
              'ul',
              { class: 'fenetre-corps liste' },
              recentes.map((t) =>
                h(
                  'li',
                  { class: 'ligne ligne-simple' },
                  h('span', { class: 'rdv-heure mono' }, formatCourt(t.date)),
                  h('span', { class: 'ligne-bloc' }, nomChapitre(donnees, t.chapitreId)),
                  h('span', { class: 'mono' }, formaterDuree(t.secondes))
                )
              )
            )
          : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Tes sessions apparaîtront ici. Chaque minute de concentration compte ✦'))
      )
    )
  );
}
