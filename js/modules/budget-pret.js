// Budget › « Prêt » : où j'en suis dans le remboursement. Des repères, jamais de reproche.

import { h, vider, pastilles, etincelles, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, formatMois } from '../dates.js';
import * as G from './budget-donnees.js';
import * as PR from './pret-donnees.js';
import { ecran, dateLongue } from './budget-commun.js';
import { ouvrirPret, ouvrirPaiement } from './ui-pret.js';

const e = G.formaterEuros;

function barre(ratio, texte) {
  const pourcent = Math.round(ratio * 100);
  return h(
    'div',
    { class: 'progression-fine' },
    h('div', { class: 'barre-progression', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent }, h('div', { class: 'remplissage', style: `width: ${pourcent}%` })),
    h('span', { class: 'progression-texte mono' }, texte)
  );
}

function cartePret(p, ctx) {
  const etat = PR.etatPret(p);
  return h(
    'button',
    {
      class: 'carte-zone carte-enveloppe',
      type: 'button',
      onclick: () => {
        ecran.pret = p.id;
        ctx.redessiner();
      },
    },
    h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, p.icone),
    h(
      'span',
      { class: 'carte-zone-texte' },
      h('strong', null, p.nom),
      h('span', { class: 'meta' }, etat.termine ? 'Remboursé 🎉' : `Il reste ${e(etat.restant)} sur ${e(p.capital)}`),
      h('span', { class: 'mini-barre', 'aria-hidden': 'true' }, h('span', { class: 'mini-remplissage', style: `width: ${Math.round(etat.ratio * 100)}%` }))
    )
  );
}

function rendreListe(conteneur, ctx, donnees) {
  const { prets } = donnees.budget;
  const creer = () => ouvrirPret({ surCreation: (id) => { ecran.pret = id; } });
  if (prets.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--orange)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mon prêt 🏦')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, 'Prêt étudiant, prêt personnel… Tu notes ce que tu as emprunté et ta mensualité ; à chaque paiement, tu vois ce qu’il reste à rembourser et la date de fin prévue.'),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: creer }, '＋ Ajouter mon prêt'))
        )
      )
    );
    return;
  }
  const restant = PR.resteTotalPrets(donnees);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h('p', { class: 'reste-grand' }, h('span', { class: 'reste-montant' }, e(restant)), h('span', { class: 'reste-phrase' }, restant > 0 ? 'à rembourser en tout' : 'Tout est remboursé 🎉')),
      h('div', { class: 'grille-zones' }, prets.map((p) => cartePret(p, ctx))),
      h('div', { class: 'barre-discrete' }, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: creer }, '＋ Prêt'))
    )
  );
}

function rendreDetail(conteneur, ctx, donnees, p) {
  const etat = PR.etatPret(p);
  const paiements = [...p.paiements].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const payer = (ev) => {
    etincelles(ev.currentTarget);
    store.modifier((d) => PR.ajouterPaiement(d, p.id, { montant: p.mensualite, date: aujourdhui() }));
    notifier(`${e(p.mensualite)} noté ✦`);
  };

  const infos = [
    h('span', null, `Mensualité : ${e(p.mensualite)}`),
    p.taux > 0 && h('span', null, `Taux : ${String(p.taux).replace('.', ',')} % par an`),
    p.debut && h('span', null, `Début : ${dateLongue(p.debut)}`),
    p.taux > 0 && etat.interets > 0 && h('span', null, `Intérêts déjà payés : ${e(etat.interets)}`),
  ].filter(Boolean);

  let fin = null;
  if (etat.termine) fin = 'Prêt remboursé, bravo ! 🎉';
  else if (etat.insuffisant) fin = 'Avec cette mensualité, les intérêts ne sont pas couverts : vérifie la mensualité ou le taux.';
  else if (etat.finPrevue) fin = `Fin prévue vers ${formatMois(`${etat.finPrevue}-01`).toLowerCase()}, dans ${etat.moisRestants} mois si tu gardes ce rythme.`;

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        null,
        h(
          'button',
          {
            class: 'bouton bouton-petit',
            type: 'button',
            onclick: () => {
              ecran.pret = null;
              ctx.redessiner();
            },
          },
          '← Tous mes prêts'
        )
      ),
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--orange)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, `${p.icone} ${p.nom}`),
          h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier le prêt', 'aria-label': `Modifier le prêt ${p.nom}`, onclick: () => ouvrirPret({ id: p.id }) }, '✎')
        ),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('div', { class: 'reste-grand' }, h('span', { class: 'reste-montant' }, e(etat.restant)), h('span', { class: 'reste-phrase' }, `à rembourser, sur ${e(p.capital)} empruntés`)),
          barre(etat.ratio, `${Math.round(etat.ratio * 100)} % remboursé`),
          fin && h('p', { class: 'doux' }, fin),
          h('p', { class: 'meta mono infos-pret' }, infos),
          !etat.termine &&
            h(
              'div',
              { class: 'rangee rangee-souple' },
              etat.payeCeMois
                ? h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirPaiement({ pretId: p.id }) }, '＋ Autre paiement')
                : [
                    h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: payer }, `✓ Mensualité payée (${e(p.mensualite)})`),
                    h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirPaiement({ pretId: p.id }) }, 'Autre montant…'),
                  ]
            ),
          etat.payeCeMois && !etat.termine && h('p', { class: 'doux' }, '✓ Ta mensualité de ce mois est notée.'),
          h('p', { class: 'meta' }, 'Pas besoin de l’ajouter à tes charges fixes : un paiement noté ici est compté dans ton budget du mois.')
        )
      ),
      h(
        'section',
        { class: 'fenetre' },
        h('div', { class: 'fenetre-barre', style: '--cat: var(--orange)' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Paiements')),
        paiements.length
          ? h(
              'ul',
              { class: 'fenetre-corps liste' },
              paiements.map((x) =>
                h(
                  'li',
                  { class: 'ligne ligne-depense' },
                  h(
                    'div',
                    { class: 'ligne-bloc' },
                    h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier', onclick: () => ouvrirPaiement({ pretId: p.id, id: x.id }) }, dateLongue(x.date)),
                    x.note && h('span', { class: 'meta' }, x.note)
                  ),
                  h('strong', { class: 'montant mono' }, e(x.montant))
                )
              )
            )
          : h('div', { class: 'fenetre-corps' }, h('p', { class: 'vide' }, 'Aucun paiement noté pour l’instant. Si tu as déjà remboursé une partie, note ces paiements avec « Autre montant… » (la date peut être dans le passé).'))
      )
    )
  );
}

export function rendrePret(conteneur, ctx) {
  const donnees = store.lire();
  vider(conteneur);
  const p = ecran.pret ? PR.pretParId(donnees, ecran.pret) : null;
  if (!p) ecran.pret = null;
  if (p) rendreDetail(conteneur, ctx, donnees, p);
  else rendreListe(conteneur, ctx, donnees);
}
