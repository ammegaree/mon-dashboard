// Onglet « Cours » : le cours que j'écris pour chaque chapitre.
// Une liste de mes chapitres (avec ceux qui ont déjà un cours), puis, pour un chapitre :
// « Écrire » (boutons de mise en forme, enregistrement automatique à chaque lettre) et « Lire ».

import { h, vider, pastilles } from '../ui.js';
import * as store from '../store.js';
import { formatCourt } from '../dates.js';
import * as E from './etudes-donnees.js';
import { selecteurChapitre } from './etudes-composants.js';
import { analyserCours, compterMots, appliquerFormat, continuerListe, FORMATS } from './cours-format.js';

let chapitreOuvert = null; // le chapitre dont on voit le cours (null : la liste)
let mode = null; // 'ecrire' | 'lire' (null : au choix selon qu'il y a déjà du texte)

// ---- Affichage d'un cours (jamais d'HTML brut : on construit des éléments) ----

function morceauxVersDom(morceaux) {
  return morceaux.map((m) => {
    if (m.t === 'gras') return h('strong', null, m.v);
    if (m.t === 'surligne') return h('mark', { class: 'cours-surligne' }, m.v);
    if (m.t === 'lien') return h('a', { href: m.v, target: '_blank', rel: 'noopener noreferrer' }, m.v);
    return m.v;
  });
}

function coursVersDom(texte) {
  return analyserCours(texte).map((b) => {
    if (b.type === 'titre') return h('h3', { class: 'cours-titre' }, morceauxVersDom(b.morceaux));
    if (b.type === 'sous-titre') return h('h4', { class: 'cours-sous-titre' }, morceauxVersDom(b.morceaux));
    if (b.type === 'retenir') return h('p', { class: 'cours-retenir' }, h('span', { 'aria-hidden': 'true' }, '💡 '), morceauxVersDom(b.morceaux));
    if (b.type === 'liste') return h(b.ordonnee ? 'ol' : 'ul', { class: 'cours-liste' }, b.items.map((it) => h('li', null, morceauxVersDom(it))));
    return h('p', null, morceauxVersDom(b.morceaux));
  });
}

// ---- La liste de mes cours ----

function listeCours(conteneur, donnees, ctx) {
  const { modules } = donnees.etudes;
  const nb = E.chapitresAvecCours(donnees).length;
  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h('p', { class: 'doux' }, nb ? `${nb} chapitre${nb > 1 ? 's' : ''} avec un cours écrit. Clique sur un chapitre pour lire ou écrire son cours.` : 'Choisis un chapitre pour écrire ton cours : tout est enregistré au fur et à mesure.'),
      modules
        .map((m) => ({ m, chapitres: E.chapitresDuModule(donnees, m.id) }))
        .filter((g) => g.chapitres.length > 0)
        .map((g) =>
          h(
            'section',
            { class: 'fenetre', style: '--cat: var(--violet)' },
            h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, g.m.titre)),
            h(
              'ul',
              { class: 'fenetre-corps liste' },
              g.chapitres.map((c) =>
                h(
                  'li',
                  { class: 'ligne ligne-simple' },
                  h(
                    'button',
                    { class: 'titre-cliquable ligne-bloc', type: 'button', onclick: () => ouvrir(c.id, ctx) },
                    c.titre
                  ),
                  c.cours
                    ? h('span', { class: 'meta mono' }, `📖 ${compterMots(c.cours)} mots · ${formatCourt(c.coursLe.slice(0, 10))}`)
                    : h('span', { class: 'meta' }, 'pas encore écrit')
                )
              )
            )
          )
        )
    )
  );
}

function ouvrir(id, ctx) {
  chapitreOuvert = id;
  mode = null;
  ctx.redessiner();
}

// ---- Un cours : écrire ou lire ----

function vueCours(conteneur, donnees, ctx, chapitre) {
  const module = donnees.etudes.modules.find((m) => m.id === chapitre.moduleId);
  const tous = donnees.etudes.modules.flatMap((m) => E.chapitresDuModule(donnees, m.id));
  const i = tous.findIndex((c) => c.id === chapitre.id);
  const precedent = tous[i - 1] || null;
  const suivant = tous[i + 1] || null;
  const modeActuel = mode || (chapitre.cours ? 'lire' : 'ecrire');

  const changerMode = (m) => {
    mode = m;
    ctx.redessiner();
  };

  const entete = h(
    'div',
    { class: 'barre-actions' },
    h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { chapitreOuvert = null; mode = null; ctx.redessiner(); } }, '← Tous mes cours'),
    h(
      'div',
      { class: 'rangee rangee-souple' },
      h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Chapitre précédent', disabled: !precedent, onclick: () => precedent && ouvrir(precedent.id, ctx) }, '◀'),
      selecteurChapitre(donnees, { valeur: chapitre.id, avecAucun: false, id: 'cours-chapitre', surChangement: (id) => id && ouvrir(id, ctx) }),
      h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Chapitre suivant', disabled: !suivant, onclick: () => suivant && ouvrir(suivant.id, ctx) }, '▶')
    )
  );

  const bascule = h(
    'div',
    { class: 'choix-vue', role: 'group', 'aria-label': 'Écrire ou lire' },
    [
      { id: 'ecrire', nom: '✎ Écrire' },
      { id: 'lire', nom: '👁 Lire' },
    ].map((v) =>
      h(
        'button',
        { class: 'choix-vue-bouton' + (v.id === modeActuel ? ' actif' : ''), type: 'button', 'aria-pressed': v.id === modeActuel ? 'true' : 'false', onclick: () => v.id !== modeActuel && changerMode(v.id) },
        v.nom
      )
    )
  );

  let corps;
  if (modeActuel === 'lire') {
    corps = chapitre.cours
      ? h('div', { class: 'cours-lecture' }, coursVersDom(chapitre.cours))
      : h('p', { class: 'vide' }, 'Rien d’écrit pour ce chapitre pour l’instant. Clique sur « Écrire » pour commencer.');
  } else {
    corps = editeur(chapitre);
  }

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      entete,
      h(
        'section',
        { class: 'fenetre carte-cours', style: '--cat: var(--violet)' },
        h(
          'div',
          { class: 'fenetre-barre' },
          pastilles(),
          h('h2', { class: 'fenetre-titre' }, chapitre.titre),
          module && h('span', { class: 'meta mono' }, module.titre)
        ),
        h('div', { class: 'fenetre-corps pile' }, bascule, corps)
      )
    )
  );
}

// L'éditeur : une grande zone de texte, des boutons de mise en forme, un enregistrement automatique.
function editeur(chapitre) {
  const id = chapitre.id;
  const champ = h('textarea', {
    class: 'champ champ-cours',
    rows: 16,
    placeholder: 'Écris ici ton cours : ce que dit le professeur, ce que tu comprends, les mots importants…',
    'aria-label': `Mon cours : ${chapitre.titre}`,
    spellcheck: 'true',
  });
  champ.value = chapitre.cours || '';
  const etat = h('span', { class: 'meta mono', role: 'status' });

  const afficherEtat = (texte) => {
    etat.textContent = `${compterMots(champ.value)} mot${compterMots(champ.value) > 1 ? 's' : ''}${texte ? ` · ${texte}` : ''}`;
  };
  afficherEtat(chapitre.cours ? 'enregistré ✓' : '');

  // Chaque modification est enregistrée tout de suite (sans redessiner la page : le curseur ne bouge pas).
  const enregistrer = () => {
    store.modifier((d) => E.enregistrerCours(d, id, champ.value), { rendre: false });
    afficherEtat('enregistré ✓');
  };
  champ.addEventListener('input', enregistrer);

  champ.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && champ.selectionStart === champ.selectionEnd) {
      const suite = continuerListe(champ.value, champ.selectionStart);
      if (suite) {
        e.preventDefault();
        champ.value = suite.texte;
        champ.setSelectionRange(suite.curseur, suite.curseur);
        enregistrer();
      }
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      appliquer('gras');
    }
  });

  function appliquer(formatId) {
    const r = appliquerFormat(champ.value, champ.selectionStart, champ.selectionEnd, formatId);
    champ.value = r.texte;
    champ.focus();
    champ.setSelectionRange(r.debut, r.fin);
    enregistrer();
  }

  const barreOutils = h(
    'div',
    { class: 'outils-cours', role: 'toolbar', 'aria-label': 'Mise en forme' },
    FORMATS.map((f) =>
      h(
        'button',
        {
          class: 'bouton bouton-petit' + (f.id === 'gras' ? ' outil-gras' : ''),
          type: 'button',
          title: f.id === 'gras' ? 'Gras (⌘ + B)' : f.libelle,
          // On garde le curseur dans le texte quand on clique sur un bouton.
          onmousedown: (e) => e.preventDefault(),
          onclick: () => appliquer(f.id),
        },
        f.libelle
      )
    )
  );

  setTimeout(() => {
    // Un cours vide : on est prêt à écrire. Un cours déjà écrit : on arrive à la fin pour continuer.
    if (champ.isConnected) {
      champ.focus();
      champ.setSelectionRange(champ.value.length, champ.value.length);
    }
  }, 0);

  return h('div', { class: 'pile' }, barreOutils, champ, h('div', { class: 'rangee droite' }, etat));
}

// ---- L'onglet ----

export function rendreCours(conteneur, ctx) {
  const donnees = store.lire();
  if (ctx.params && ctx.params.chapitreId) {
    chapitreOuvert = ctx.params.chapitreId;
    mode = null;
  }
  const chapitre = chapitreOuvert ? E.chapitreParId(donnees, chapitreOuvert) : null;
  if (!chapitre) chapitreOuvert = null;

  vider(conteneur);
  if (donnees.etudes.chapitres.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--jaune)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mon cours')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, 'Pour écrire ton cours, il faut d’abord un chapitre : ajoute tes modules et tes chapitres dans le Parcours, puis reviens ici.'),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ctx.aller('parcours') }, 'Aller au Parcours'))
        )
      )
    );
    return;
  }

  if (chapitre) vueCours(conteneur, donnees, ctx, chapitre);
  else listeCours(conteneur, donnees, ctx);
}
