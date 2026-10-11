// Budget › « Vue d'ensemble » : le tableau de bord du mois.
// En haut, ce qui compte (il te reste, ce qui rentre, ce qui sort, ce qui est mis de côté), puis le mois par mois,
// mes enveloppes, mes dépenses, et — repliés — mes réglages (revenus, charges fixes, enveloppes).

import { h, vider } from '../ui.js';
import * as store from '../store.js';
import * as G from './budget-donnees.js';
import * as EP from './epargne-donnees.js';
import * as PR from './pret-donnees.js';
import { barreMois, moisVu, choisirMois, choisirPoste, ecran } from './budget-commun.js';
import { ouvrirEnveloppe, ouvrirIdeesEnveloppes } from './ui-budget.js';
import { blocDepenses } from './budget-depenses.js';
import { blocReglage } from './budget-reglage.js';
import { pastilles } from '../ui.js';

const e = G.formaterEuros;

function barre(ratio, texte, etiquette) {
  const pourcent = Math.round(ratio * 100);
  return h(
    'div',
    { class: 'progression-fine' },
    h('div', { class: 'barre-progression', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent, 'aria-label': etiquette }, h('div', { class: 'remplissage', style: `width: ${pourcent}%` })),
    h('span', { class: 'progression-texte mono' }, texte)
  );
}

// ---- Les tuiles ----

function tuile({ etiquette, montant, sous, couleur, grande = false }) {
  return h(
    'div',
    { class: 'tuile' + (grande ? ' tuile-grande' : ''), style: `--cat: var(--${couleur})` },
    h('span', { class: 'tuile-etiquette mono' }, etiquette),
    h('strong', { class: 'tuile-montant' }, montant),
    sous && h('span', { class: 'tuile-sous' }, sous)
  );
}

function tuiles(b, ctx) {
  const rien = b.revenus === 0 && b.fixes === 0;
  const positif = b.reste >= 0;
  return h(
    'div',
    { class: 'pile' },
    h(
      'div',
      { class: 'tuiles-budget' },
      tuile({
        etiquette: positif ? 'Il te reste' : 'En trop ce mois-ci',
        montant: e(Math.abs(b.reste)),
        sous: rien ? 'à calculer : indique tes revenus' : b.parJour !== null ? `environ ${e(b.parJour)} par jour` : null,
        couleur: 'ciel',
        grande: true,
      }),
      tuile({ etiquette: 'Revenus', montant: e(b.revenus), sous: 'ce qui rentre', couleur: 'vert' }),
      tuile({ etiquette: 'Sorti', montant: e(b.sorti), sous: b.fixes > 0 ? `dont ${e(b.fixes)} de charges fixes` : 'dépenses et charges', couleur: 'rose' }),
      tuile({ etiquette: 'Mis de côté', montant: e(b.epargne), sous: 'ce mois-ci', couleur: 'jaune' })
    ),
    !rien && b.revenus > 0 && barre(b.ratioUtilise, `${Math.round(b.ratioUtilise * 100)} % utilisé`, 'Part du budget utilisée'),
    rien &&
      h(
        'div',
        { class: 'encart-budget' },
        h('p', { class: 'doux' }, 'Pour voir ce qu’il te reste, indique tes revenus et tes charges fixes (loyer, abonnements…).'),
        h(
          'button',
          {
            class: 'bouton bouton-jaune',
            type: 'button',
            onclick: () => {
              ecran.reglageOuvert = true;
              ctx.redessiner();
              setTimeout(() => document.getElementById('budget-reglage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            },
          },
          'Régler mon budget'
        )
      )
  );
}

// ---- Mois par mois ----

function graphique(serie, moisActuel, ctx) {
  const max = Math.max(1, ...serie.map((m) => Math.max(m.revenus, m.sorti)));
  const court = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  const long = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
  const annee = moisActuel.slice(0, 4);
  return h(
    'section',
    { class: 'fenetre' },
    h('div', { class: 'fenetre-barre', style: '--cat: var(--rose)' }, pastilles(), h('h2', { class: 'fenetre-titre' }, `Mois par mois · ${annee}`)),
    h(
      'div',
      { class: 'fenetre-corps' },
      h(
        'div',
        { class: 'graphique-mois', role: 'list' },
        serie.map((m) => {
          const date = new Date(Number(annee), Number(m.mois.slice(5)) - 1, 1);
          const hauteur = m.actif ? Math.round((m.sorti / max) * 100) : 0;
          const repere = m.revenus > 0 ? Math.round((m.revenus / max) * 100) : null;
          return h(
            'button',
            {
              class: 'colonne-mois' + (m.mois === moisActuel ? ' actif' : '') + (m.actif ? '' : ' vide'),
              type: 'button',
              role: 'listitem',
              title: m.actif ? `${long.format(date)} : ${e(m.sorti)} sorti, ${e(m.reste)} de reste` : long.format(date),
              'aria-label': `${long.format(date)}${m.actif ? ` : ${e(m.sorti)} sorti` : ''}`,
              onclick: () => {
                choisirMois(m.mois);
                ctx.redessiner();
              },
            },
            h('span', { class: 'colonne-zone' }, repere !== null && m.actif && h('span', { class: 'repere-revenus', style: `bottom: ${repere}%` }), h('span', { class: 'colonne-barre', style: `height: ${hauteur}%` })),
            h('span', { class: 'colonne-nom mono' }, h('span', { class: 'nom-long' }, court.format(date).replace('.', '')), h('span', { class: 'nom-court' }, court.format(date).charAt(0).toUpperCase()))
          );
        })
      ),
      h('p', { class: 'meta' }, 'La barre rose, c’est ce qui est sorti ; le trait noir, ce qui rentre. Clique sur un mois pour l’ouvrir.')
    )
  );
}

// ---- Économies et prêt, en deux lignes ----

function resumeEpargnePret(donnees, ctx) {
  const objectifs = donnees.budget.objectifs;
  const prets = donnees.budget.prets;
  if (objectifs.length === 0 && prets.length === 0) return null;
  const lignes = [];
  if (objectifs.length > 0) {
    const t = EP.totalCibles(donnees);
    const total = EP.totalEpargne(donnees);
    lignes.push(
      h(
        'button',
        { class: 'resume-ligne', type: 'button', onclick: () => ctx.aller('epargne') },
        h('span', { class: 'resume-titre' }, `💰 ${e(total)} de côté`),
        t.nb > 0 ? barre(t.cible > 0 ? Math.min(1, t.verse / t.cible) : 0, `${e(t.verse)} sur ${e(t.cible)}`, 'Objectifs d’économies') : h('span', { class: 'meta' }, `${objectifs.length} objectif${objectifs.length > 1 ? 's' : ''}`)
      )
    );
  }
  if (prets.length > 0) {
    const restant = PR.resteTotalPrets(donnees);
    const capital = PR.capitalTotalPrets(donnees);
    lignes.push(
      h(
        'button',
        { class: 'resume-ligne', type: 'button', onclick: () => ctx.aller('pret') },
        h('span', { class: 'resume-titre' }, restant > 0 ? `🏦 Il reste ${e(restant)} à rembourser` : '🏦 Prêt remboursé 🎉'),
        barre(capital > 0 ? Math.min(1, (capital - restant) / capital) : 0, `${e(capital - restant)} sur ${e(capital)}`, 'Remboursement du prêt')
      )
    );
  }
  return h(
    'section',
    { class: 'fenetre' },
    h('div', { class: 'fenetre-barre', style: '--cat: var(--jaune)' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Économies et prêt')),
    h('div', { class: 'fenetre-corps pile' }, lignes)
  );
}

// ---- Enveloppes ----

function carteEnveloppe(env, ouvrir) {
  const { poste, depense, plafond } = env;
  const texte = plafond ? `${e(depense)} sur ${e(plafond)}` : depense > 0 ? `${e(depense)} dépensés` : 'Rien de dépensé';
  return h(
    'button',
    { class: 'carte-zone carte-enveloppe' + (env.depasse ? ' a-surveiller' : ''), type: 'button', onclick: () => ouvrir(poste.id) },
    h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, poste.icone),
    h(
      'span',
      { class: 'carte-zone-texte' },
      h('strong', null, poste.nom),
      h('span', { class: 'meta' }, texte),
      plafond && h('span', { class: 'mini-barre', 'aria-hidden': 'true' }, h('span', { class: 'mini-remplissage', style: `width: ${Math.round(env.ratio * 100)}%` }))
    )
  );
}

function blocEnveloppes(b, ctx) {
  // Un clic sur une enveloppe filtre la liste des dépenses juste en dessous.
  const filtrer = (posteId) => {
    choisirPoste(posteId);
    ctx.redessiner();
    setTimeout(() => document.getElementById('budget-depenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  return h(
    'div',
    { class: 'pile' },
    h('h2', { class: 'titre-section' }, 'Mes enveloppes'),
    b.enveloppes.length === 0 && b.sansEnveloppe === 0
      ? h(
          'div',
          { class: 'pile' },
          h('p', { class: 'doux' }, 'Une enveloppe, c’est un endroit où tu ranges tes dépenses : courses, sorties, transport… Tu vois d’un coup d’œil où part l’argent.'),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: ouvrirIdeesEnveloppes }, "💡 Partir d'idées"),
            h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirEnveloppe({}) }, '＋ Créer une enveloppe')
          )
        )
      : h(
          'div',
          { class: 'grille-zones' },
          b.enveloppes.map((env) => carteEnveloppe(env, filtrer)),
          b.sansEnveloppe > 0 &&
            h(
              'button',
              { class: 'carte-zone', type: 'button', onclick: () => filtrer('aucune') },
              h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, '🗃️'),
              h('span', { class: 'carte-zone-texte' }, h('strong', null, 'Sans enveloppe'), h('span', { class: 'meta' }, `${e(b.sansEnveloppe)} dépensés`))
            )
        )
  );
}

export function rendreEnsemble(conteneur, ctx) {
  const donnees = store.lire();
  const mois = moisVu();
  const b = G.bilanDuMois(donnees, mois);
  const serie = G.serieAnnee(donnees, mois);

  vider(conteneur);
  conteneur.append(
    ...[
      h(
        'div',
        { class: 'pile pile-large' },
        barreMois(ctx.redessiner),
        tuiles(b, ctx),
        graphique(serie, mois, ctx),
        resumeEpargnePret(donnees, ctx),
        blocEnveloppes(b, ctx),
        blocDepenses(donnees, ctx),
        blocReglage(donnees)
      ),
    ]
  );
}
