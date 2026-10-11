// Bien-être › « Analyse » : mon humeur, mon énergie et mon sommeil sur une semaine,
// un mois ou trois mois. On montre, on n'évalue pas.

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui, formatLong, formatJourMois, formatMois, jourCourt, jourDuMois, jourSemaine, depuisCle, formatPlage, ajouterJours, JOURS } from '../dates.js';
import * as B from './bien-etre-donnees.js';
import { ouvrirCheckin } from './bien-etre-checkin.js';

let typePeriode = 'semaine';
let ancre = null; // null = la période qui contient aujourd'hui

function titrePeriode(p) {
  if (p.type === 'semaine') return `Semaine du ${formatPlage(p.debut, p.fin)}`;
  if (p.type === 'mois') return formatMois(p.debut);
  return `${formatMois(p.debut)} – ${formatMois(p.fin)}`;
}

function virgule(n, decimales = 1) {
  return n.toFixed(decimales).replace('.', ',');
}

function tuile({ emoji, valeur, libelle, couleur }) {
  return h(
    'div',
    { class: 'tuile', style: `--cat: var(--${couleur})` },
    h('span', { class: 'tuile-valeur mono' }, emoji ? `${emoji} ${valeur}` : valeur),
    h('span', { class: 'tuile-libelle' }, libelle)
  );
}

// Deux barres par colonne : humeur et énergie.
function grapheHumeurEnergie(colonnes) {
  return h(
    'div',
    { class: 'graphe', role: 'img', 'aria-label': 'Humeur et énergie sur la période' },
    h(
      'div',
      { class: 'graphe-grille', style: `--colonnes: ${colonnes.length}` },
      colonnes.map((c) =>
        h(
          'div',
          { class: 'graphe-colonne' + (c.aujourdhui ? ' aujourdhui' : ''), title: c.titre },
          h(
            'div',
            { class: 'graphe-barres' },
            h('div', { class: 'barre-v barre-humeur', style: `height: ${c.humeur == null ? 0 : (c.humeur / 5) * 100}%` }),
            h('div', { class: 'barre-v barre-energie', style: `height: ${c.energie == null ? 0 : (c.energie / 5) * 100}%` })
          ),
          h('span', { class: 'graphe-etiquette mono' }, c.etiquette)
        )
      )
    )
  );
}

function grapheSommeil(colonnes) {
  const maxH = 12;
  return h(
    'div',
    { class: 'graphe', role: 'img', 'aria-label': 'Heures de sommeil sur la période' },
    h(
      'div',
      { class: 'graphe-grille', style: `--colonnes: ${colonnes.length}` },
      colonnes.map((c) =>
        h(
          'div',
          { class: 'graphe-colonne' + (c.aujourdhui ? ' aujourdhui' : ''), title: c.titreSommeil },
          h(
            'div',
            { class: 'graphe-barres graphe-barres-seule' },
            h('div', { class: 'barre-v barre-sommeil', style: `height: ${c.sommeil == null ? 0 : Math.min(100, (c.sommeil / maxH) * 100)}%` })
          ),
          h('span', { class: 'graphe-etiquette mono' }, c.etiquette)
        )
      )
    )
  );
}

function calendrierMois(a, p, reel) {
  const premier = depuisCle(p.debut);
  // Lundi = 0 … dimanche = 6
  const decalage = (premier.getDay() + 6) % 7;
  const cases = [];
  for (let i = 0; i < decalage; i++) cases.push(h('div', { class: 'cal-case vide', 'aria-hidden': 'true' }));
  for (const j of a.jours) {
    const humeur = B.HUMEURS.find((x) => x.v === j.humeur);
    const futur = j.date > reel;
    cases.push(
      h(
        'button',
        {
          class: 'cal-case' + (j.date === reel ? ' aujourdhui' : '') + (j.renseigne ? ' renseigne' : ''),
          type: 'button',
          disabled: futur,
          title: `${formatLong(j.date)}${humeur ? ` · ${humeur.nom}` : ''}`,
          'aria-label': `${formatLong(j.date)}${humeur ? ` : ${humeur.nom}` : ''}`,
          onclick: () => ouvrirCheckin({ date: j.date }),
        },
        h('span', { class: 'cal-numero mono' }, String(jourDuMois(j.date))),
        h('span', { class: 'cal-emoji', 'aria-hidden': 'true' }, humeur ? humeur.emoji : j.renseigne ? '•' : '')
      )
    );
  }
  return h(
    'div',
    { class: 'calendrier' },
    JOURS.map((j) => h('span', { class: 'cal-jour mono' }, j.court)),
    cases
  );
}

function observations(a, p) {
  const lignes = [];
  if (a.nbRenseignes > 0) {
    lignes.push(`Tu as renseigné ${a.nbRenseignes} jour${a.nbRenseignes > 1 ? 's' : ''} sur ${a.nbJours}. Chaque check-in t'aide à mieux te connaître ✦`);
  }
  if (a.meilleurJour) {
    const humeur = B.HUMEURS.find((x) => x.v === a.meilleurJour.humeur);
    lignes.push(`Ton meilleur jour : ${formatLong(a.meilleurJour.date).toLowerCase()} (${humeur.emoji} ${humeur.nom.toLowerCase()}).`);
  }
  if (a.sommeilEnergie) {
    const s = a.sommeilEnergie;
    lignes.push(
      `Les jours où tu as dormi ${s.seuil} h ou plus (${s.longs.n} jours), ton énergie moyenne est de ${virgule(s.longs.energie)}/5, contre ${virgule(s.courts.energie)}/5 les autres jours (${s.courts.n} jours). À titre indicatif.`
    );
  }
  if (a.humeur != null && a.humeur >= 4) lignes.push('Une période plutôt lumineuse : profite-en ✦');
  if (a.humeur != null && a.humeur < 2.5 && a.nbRenseignes >= 3) {
    lignes.push("Cette période semble avoir été plus lourde. Tu as le droit de ralentir : sois douce avec toi, et appuie-toi sur ton entourage si tu en ressens le besoin.");
  }
  return lignes;
}

export function rendreAnalyse(conteneur, ctx) {
  const donnees = store.lire();
  const reel = aujourdhui();
  const p = B.periode(typePeriode, ancre || reel);
  const a = B.analysePeriode(donnees, p.debut, p.fin);
  const estPeriodeCourante = !ancre || (p.debut <= reel && reel <= p.fin);

  // Les colonnes des graphiques : un jour par colonne (semaine, mois) ou une semaine (3 mois).
  let colonnes;
  if (typePeriode === 'trimestre') {
    colonnes = a.semaines.map((s) => ({
      humeur: s.humeur,
      energie: s.energie,
      sommeil: s.sommeilHeures,
      etiquette: formatJourMois(s.lundi).replace('.', ''),
      aujourdhui: s.lundi <= reel && reel <= ajouterJours(s.lundi, 6),
      titre: `Semaine du ${formatJourMois(s.lundi)} · humeur ${s.humeur != null ? `${virgule(s.humeur)}/5` : '—'} · énergie ${s.energie != null ? `${virgule(s.energie)}/5` : '—'} (${s.n} jour${s.n > 1 ? 's' : ''})`,
      titreSommeil: `Semaine du ${formatJourMois(s.lundi)} · sommeil ${s.sommeilHeures != null ? B.formaterHeures(s.sommeilHeures) : '—'}`,
    }));
  } else {
    colonnes = a.jours.map((j) => ({
      humeur: j.humeur,
      energie: j.energie,
      sommeil: j.sommeilHeures,
      etiquette: typePeriode === 'semaine' ? jourCourt(j.date) : String(jourDuMois(j.date)),
      aujourdhui: j.date === reel,
      titre: `${formatLong(j.date)} · humeur ${j.humeur ?? '—'}/5 · énergie ${j.energie ?? '—'}/5`,
      titreSommeil: `${formatLong(j.date)} · sommeil ${j.sommeilHeures != null ? B.formaterHeures(j.sommeilHeures) : '—'}`,
    }));
  }

  const maxRepartition = Math.max(1, ...a.repartition.map((r) => r.n));
  const notes = observations(a, p);

  const selecteur = h(
    'div',
    { class: 'puces', role: 'radiogroup', 'aria-label': 'Période' },
    B.TYPES_PERIODE.map((t) =>
      h(
        'label',
        { class: 'puce', style: '--cat: var(--rose)' },
        h('input', {
          type: 'radio',
          name: 'periode-analyse',
          checked: t.id === typePeriode,
          onchange: () => {
            typePeriode = t.id;
            ancre = null;
            ctx.redessiner();
          },
        }),
        h('span', null, t.nom)
      )
    )
  );

  vider(conteneur);
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'barre-actions' },
        selecteur,
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Période précédente', onclick: () => { ancre = B.decalerAncre(typePeriode, ancre || reel, -1); ctx.redessiner(); } }, '◀'),
          h('strong', { class: 'titre-periode' }, titrePeriode(p)),
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Période suivante', onclick: () => { ancre = B.decalerAncre(typePeriode, ancre || reel, 1); ctx.redessiner(); } }, '▶'),
          !estPeriodeCourante && h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { ancre = null; ctx.redessiner(); } }, 'Aujourd\'hui')
        )
      ),

      h(
        'div',
        { class: 'grille-tuiles' },
        tuile({ emoji: B.emojiHumeur(a.humeur), valeur: a.humeur != null ? `${virgule(a.humeur)}/5` : '—', libelle: 'humeur moyenne', couleur: 'jaune' }),
        tuile({ emoji: B.emojiEnergie(a.energie), valeur: a.energie != null ? `${virgule(a.energie)}/5` : '—', libelle: 'énergie moyenne', couleur: 'violet' }),
        tuile({ emoji: '🌙', valeur: a.sommeilHeures != null ? B.formaterHeures(a.sommeilHeures) : '—', libelle: 'sommeil moyen', couleur: 'ciel' }),
        tuile({ valeur: `${a.nbRenseignes}/${a.nbJours}`, libelle: 'jours renseignés', couleur: 'turquoise' })
      ),

      a.nbRenseignes === 0
        ? h(
            'p',
            { class: 'vide' },
            estPeriodeCourante
              ? "Pas encore de check-in sur cette période. Dès que tu en auras rempli quelques-uns, ton humeur, ton énergie et ton sommeil apparaîtront ici ✦"
              : 'Aucun check-in sur cette période.'
          )
        : [
            h(
              'section',
              { class: 'fenetre', style: '--cat: var(--jaune)' },
              h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, typePeriode === 'trimestre' ? 'Humeur et énergie, semaine par semaine' : 'Humeur et énergie')),
              h(
                'div',
                { class: 'fenetre-corps pile' },
                grapheHumeurEnergie(colonnes),
                h('p', { class: 'legende mono' }, h('span', { class: 'legende-pastille barre-humeur' }), ' humeur   ', h('span', { class: 'legende-pastille barre-energie' }), ' énergie   (échelle de 1 à 5)')
              )
            ),

            typePeriode === 'mois' &&
              h(
                'section',
                { class: 'fenetre', style: '--cat: var(--rose)' },
                h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, "Le calendrier de l'humeur")),
                h('div', { class: 'fenetre-corps' }, calendrierMois(a, p, reel))
              ),

            h(
              'section',
              { class: 'fenetre', style: '--cat: var(--ciel)' },
              h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Sommeil')),
              h('div', { class: 'fenetre-corps' }, a.sommeilHeures == null ? h('p', { class: 'vide' }, 'Pas de sommeil renseigné sur cette période.') : grapheSommeil(colonnes))
            ),

            h(
              'section',
              { class: 'fenetre', style: '--cat: var(--turquoise)' },
              h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes humeurs sur la période')),
              h(
                'ul',
                { class: 'fenetre-corps liste-simple repartition' },
                [...a.repartition].reverse().map((r) => {
                  const o = B.HUMEURS.find((x) => x.v === r.v);
                  return h(
                    'li',
                    { class: 'rangee' },
                    h('span', { class: 'repartition-etiquette' }, `${o.emoji} ${o.nom}`),
                    h('div', { class: 'barre-progression barre-fine ligne-bloc', 'aria-hidden': 'true' }, h('div', { class: 'remplissage', style: `width: ${(r.n / maxRepartition) * 100}%` })),
                    h('span', { class: 'mono repartition-n' }, `${r.n} j`)
                  );
                })
              )
            ),

            notes.length > 0 &&
              h(
                'section',
                { class: 'fenetre', style: '--cat: var(--orange)' },
                h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'À retenir')),
                h('ul', { class: 'fenetre-corps liste-puces observations' }, notes.map((n) => h('li', null, n)))
              ),
          ]
    )
  );
}
