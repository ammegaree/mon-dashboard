// Loisirs › « Mes avis » : tout ce que j'ai terminé, avec ma note sur 5 et mon avis.

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import { depuisCle } from '../dates.js';
import * as L from './loisirs-donnees.js';
import { ouvrirEnvie, lienEnvie, auteurEnvie } from './ui-loisirs.js';
import { couleurListe } from './loisirs-listes.js';

let filtreListe = '';
let etoilesMin = 0;

export function reinitialiserAvis() {
  filtreListe = '';
  etoilesMin = 0;
}

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function rendreAvis(conteneur, ctx) {
  const donnees = store.lire();
  if (filtreListe && !L.listeParId(donnees, filtreListe)) filtreListe = '';
  const toutes = L.terminees(donnees);
  const liste = L.terminees(donnees, { listeId: filtreListe, etoilesMin });
  const moyenne = L.moyenneEtoiles(liste);

  vider(conteneur);
  if (toutes.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--violet)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes avis ⭐')),
        h(
          'div',
          { class: 'fenetre-corps' },
          h('p', null, 'Quand tu termines une envie (un livre, un film, une activité…), tu peux lui donner de 1 à 5 étoiles et écrire ton avis : il apparaîtra ici.')
        )
      )
    );
    return;
  }

  const filtres = h(
    'div',
    { class: 'rangee rangee-souple' },
    h(
      'select',
      {
        class: 'champ champ-filtre',
        'aria-label': 'Filtrer par liste',
        onchange: (ev) => {
          filtreListe = ev.target.value;
          ctx.redessiner();
        },
      },
      h('option', { value: '', selected: filtreListe === '' }, 'Toutes les listes'),
      donnees.loisirs.listes.map((l) => h('option', { value: l.id, selected: filtreListe === l.id }, `${l.icone} ${l.nom}`))
    ),
    h(
      'select',
      {
        class: 'champ champ-filtre',
        'aria-label': 'Filtrer par note',
        onchange: (ev) => {
          etoilesMin = Number(ev.target.value);
          ctx.redessiner();
        },
      },
      h('option', { value: '0', selected: etoilesMin === 0 }, 'Toutes les notes'),
      [4, 3].map((n) => h('option', { value: String(n), selected: etoilesMin === n }, `${n} étoiles et plus`)),
      h('option', { value: '5', selected: etoilesMin === 5 }, '5 étoiles')
    )
  );

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'barre-actions' },
        h('p', { class: 'mono doux resume-semaine' }, `${liste.length} terminé${liste.length > 1 ? 's' : ''}${moyenne !== null ? ` · moyenne ${String(moyenne).replace('.', ',')} ★` : ''}`),
        filtres
      ),
      liste.length === 0
        ? h('p', { class: 'vide' }, 'Rien ne correspond à ce filtre.')
        : h(
            'div',
            { class: 'pile' },
            liste.map((e) => {
              const l = L.listeParId(donnees, e.listeId);
              return h(
                'article',
                { class: 'carte-avis', style: `--cat: var(--${couleurListe(e.listeId)})` },
                h(
                  'div',
                  { class: 'carte-avis-tete' },
                  h('button', { class: 'titre-cliquable', type: 'button', title: 'Modifier mon avis', onclick: () => ouvrirEnvie({ id: e.id }) }, e.titre),
                  e.etoiles && h('span', { class: 'etoiles-lecture', 'aria-label': `${e.etoiles} sur 5` }, L.texteEtoiles(e.etoiles))
                ),
                auteurEnvie(e),
                h('p', { class: 'meta mono' }, [l ? `${l.icone} ${l.nom}` : null, e.termineLe ? `terminé le ${fmtDate.format(depuisCle(e.termineLe))}` : null].filter(Boolean).join(' · ')),
                e.avis && h('p', { class: 'carte-avis-texte' }, e.avis),
                lienEnvie(e)
              );
            })
          )
    )
  );
}
