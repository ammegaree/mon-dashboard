// Onglet « Parcours » : mes modules et chapitres, leur avancement, mes sessions prévues.

import { h, vider, ouvrirModale, confirmer, notifier, etincelles, pastilles } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur } from '../registry.js';
import { aujourdhui, formatCourt, formatLong } from '../dates.js';
import * as E from './etudes-donnees.js';
import { selecteurChapitre } from './etudes-composants.js';

let focusModuleId = null; // module dont le champ « nouveau chapitre » doit reprendre le focus
let moduleOuvert = null; // le module dont on voit les chapitres (null : tous les modules)

// ---- Fenêtres ----

// Une fenêtre toute simple : un seul champ de texte.
function fenetreTexte({ titre, couleur = 'violet', placeholder, valeur = '', bouton = 'Enregistrer', surValider, supplement = null }) {
  ouvrirModale({
    titre,
    couleur,
    corps: (fermer) => {
      const champ = h('input', { type: 'text', class: 'champ champ-titre', value: valeur, placeholder, maxLength: 200, 'aria-label': titre });
      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const texte = champ.value.trim();
            if (!texte) {
              champ.classList.add('champ-erreur');
              champ.focus();
              return;
            }
            surValider(texte);
            fermer();
          },
        },
        champ,
        h('div', { class: 'rangee droite' }, supplement && supplement(fermer), h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'), h('button', { class: 'bouton bouton-jaune', type: 'submit' }, bouton))
      );
      setTimeout(() => champ.focus(), 0);
      return formulaire;
    },
  });
}

function ouvrirModule(id = null) {
  const donnees = store.lire();
  const module = id ? donnees.etudes.modules.find((m) => m.id === id) : null;
  fenetreTexte({
    titre: module ? 'Modifier le module' : 'Nouveau module',
    placeholder: 'Ex. Module 1 — Les bases',
    valeur: module?.titre || '',
    bouton: module ? 'Enregistrer' : 'Ajouter',
    surValider: (titre) => {
      if (module) store.modifier((d) => E.renommerModule(d, module.id, titre));
      else {
        focusModuleId = null;
        store.modifier((d) => E.ajouterModule(d, titre));
      }
    },
    supplement: module
      ? (fermer) => [
          h('button', { class: 'bouton bouton-petit', type: 'button', 'aria-label': 'Monter le module', disabled: donnees.etudes.modules[0]?.id === module.id, onclick: () => { store.modifier((d) => E.deplacerModule(d, module.id, -1)); fermer(); } }, '↑ Monter'),
          h('button', { class: 'bouton bouton-petit', type: 'button', 'aria-label': 'Descendre le module', disabled: donnees.etudes.modules.at(-1)?.id === module.id, onclick: () => { store.modifier((d) => E.deplacerModule(d, module.id, 1)); fermer(); } }, '↓ Descendre'),
          h(
            'button',
            {
              class: 'bouton',
              type: 'button',
              onclick: async () => {
                const chapitres = E.chapitresDuModule(store.lire(), module.id);
                const n = chapitres.length;
                const nbCours = chapitres.filter((c) => c.cours).length;
                const ok = await confirmer({
                  titre: 'Supprimer ce module ?',
                  message: `« ${module.titre} » et ses ${n} chapitre${n > 1 ? 's' : ''} seront retirés du parcours${nbCours ? `, avec ${nbCours > 1 ? `les ${nbCours} cours que tu y as écrits` : 'le cours que tu y as écrit'}` : ''}. Ton temps de concentration et tes QCM déjà enregistrés sont conservés.`,
                  oui: 'Supprimer',
                  non: 'Garder',
                });
                if (ok) {
                  store.modifier((d) => E.supprimerModule(d, module.id));
                  fermer();
                }
              },
            },
            'Supprimer'
          ),
        ]
      : null,
  });
}

function ouvrirPlusieurs(moduleId) {
  ouvrirModale({
    titre: 'Ajouter plusieurs chapitres',
    couleur: 'violet',
    corps: (fermer) => {
      const zone = h('textarea', { class: 'champ champ-note', rows: 8, placeholder: 'Un chapitre par ligne.\nIntroduction\nLe corps pendant la grossesse\nL\'accouchement…', 'aria-label': 'Chapitres, un par ligne' });
      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            let n = 0;
            store.modifier((d) => (n = E.ajouterChapitres(d, moduleId, zone.value).length));
            fermer();
            if (n) notifier(`${n} chapitre${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} ✦`);
          },
        },
        h('p', { class: 'doux' }, 'Colle ou tape la liste : une ligne = un chapitre. Tu pourras les renommer et les réordonner ensuite.'),
        zone,
        h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'), h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Ajouter'))
      );
      setTimeout(() => zone.focus(), 0);
      return formulaire;
    },
  });
}

// La fiche d'un chapitre : son statut, et tous les gestes qui le concernent (minuteur, session, QCM, notes…).
function ouvrirChapitre(id, ctx) {
  const donnees = store.lire();
  const chapitre = E.chapitreParId(donnees, id);
  if (!chapitre) return;
  const nbQcm = donnees.etudes.qcm.filter((q) => q.chapitreId === id).length;
  const nbNotes = donnees.etudes.recherches.filter((r) => r.chapitreId === id).length;
  ouvrirModale({
    titre: 'Mon chapitre',
    couleur: 'violet',
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: chapitre.titre, maxLength: 200, 'aria-label': 'Titre du chapitre' });
      const statut = h('select', { class: 'champ', id: 'chap-statut' }, E.STATUTS.map((s) => h('option', { value: s.id, selected: s.id === chapitre.statut }, s.nom)));
      const module = h('select', { class: 'champ', id: 'chap-module' }, donnees.etudes.modules.map((m) => h('option', { value: m.id, selected: m.id === chapitre.moduleId }, m.titre)));
      const formulaire = h(
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
            store.modifier((d) => E.modifierChapitre(d, id, { titre: titre.value, statut: statut.value, moduleId: module.value }));
            fermer();
          },
        },
        titre,
        h(
          'div',
          { class: 'rangee-options' },
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'chap-statut' }, 'Statut'), statut),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'chap-module' }, 'Module'), module)
        ),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { fermer(); ctx.aller('minuteur', { chapitreId: id }); } }, '⏱ Travailler dessus'),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { fermer(); ouvrirSession({ chapitreId: id }); } }, '🗓 Planifier'),
          h('button', { class: 'bouton bouton-petit bouton-turquoise', type: 'button', onclick: () => { fermer(); ctx.aller('cours', { chapitreId: id }); } }, chapitre.cours ? '📖 Mon cours ✓' : '📖 Écrire mon cours'),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { fermer(); ctx.aller('qcm', { chapitreId: id }); } }, nbQcm ? `📝 QCM (${nbQcm})` : '📝 QCM'),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { fermer(); ctx.aller('recherche', { chapitreId: id }); } }, nbNotes ? `🔎 Mes notes (${nbNotes})` : '🔎 Mes notes')
        ),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton bouton-petit', type: 'button', 'aria-label': 'Monter', onclick: () => store.modifier((d) => E.deplacerChapitre(d, id, -1)) }, '↑'),
          h('button', { class: 'bouton bouton-petit', type: 'button', 'aria-label': 'Descendre', onclick: () => store.modifier((d) => E.deplacerChapitre(d, id, 1)) }, '↓'),
          h(
            'button',
            {
              class: 'bouton',
              type: 'button',
              onclick: async () => {
                const ok = await confirmer({
                  titre: 'Supprimer ce chapitre ?',
                  message: `« ${chapitre.titre} » sera retiré du parcours (ainsi que ses sessions planifiées${chapitre.cours ? ' et le cours que tu y as écrit' : ''}). Ton temps de concentration et tes QCM déjà enregistrés sont conservés.`,
                  oui: 'Supprimer',
                  non: 'Garder',
                });
                if (ok) {
                  store.modifier((d) => E.supprimerChapitre(d, id));
                  fermer();
                }
              },
            },
            'Supprimer'
          ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => titre.focus(), 0);
      return formulaire;
    },
  });
}

export function ouvrirSession({ id = null, chapitreId = null, date = aujourdhui() } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.etudes.sessions.find((s) => s.id === id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? 'Modifier la session' : 'Planifier une session',
    couleur: 'violet',
    corps: (fermer) => {
      const type = h(
        'select',
        { class: 'champ', id: 'ses-type' },
        h('option', { value: 'travail', selected: (existante?.type || 'travail') === 'travail' }, 'Travail (apprendre, lire…)'),
        h('option', { value: 'revision', selected: existante?.type === 'revision' }, 'Révision (relire, refaire un QCM…)')
      );
      const chapitre = selecteurChapitre(donnees, { valeur: existante ? existante.chapitreId : chapitreId, id: 'ses-chapitre' });
      const champDate = h('input', { type: 'date', class: 'champ', value: existante?.date || date, required: true, id: 'ses-date' });
      const champHeure = h('input', { type: 'time', class: 'champ', value: existante?.heure || '', id: 'ses-heure' });
      const champDuree = h('input', { type: 'number', class: 'champ champ-court', min: 5, max: 600, step: 5, value: existante?.dureeMin || '', placeholder: 'min', id: 'ses-duree' });
      const champNote = h('input', { type: 'text', class: 'champ', value: existante?.note || '', placeholder: 'Une note (facultatif)', maxLength: 200, id: 'ses-note' });

      return h(
        'form',
        {
          class: 'formulaire-tache',
          onsubmit: (e) => {
            e.preventDefault();
            if (!champDate.value) {
              champDate.focus();
              return;
            }
            const valeurs = { chapitreId: chapitre.value || null, type: type.value, date: champDate.value, heure: champHeure.value, dureeMin: champDuree.value, note: champNote.value };
            if (existante) store.modifier((d) => E.modifierSession(d, existante.id, valeurs));
            else store.modifier((d) => E.ajouterSession(d, valeurs));
            fermer();
            if (!existante) notifier(`Session planifiée pour le ${formatLong(valeurs.date).toLowerCase()} ✦ Elle apparaît dans Aujourd'hui et Semaine.`);
          },
        },
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ses-type' }, 'Type'), type),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ses-chapitre' }, 'Chapitre'), chapitre),
        h(
          'div',
          { class: 'rangee-options' },
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'ses-date' }, 'Le'), champDate),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'ses-heure' }, 'À (facultatif)'), champHeure),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'ses-duree' }, 'Durée prévue'), champDuree)
        ),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ses-note' }, 'Note'), champNote),
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
                  store.modifier((d) => E.supprimerSession(d, existante.id));
                  fermer();
                  notifier('Session supprimée.');
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
}

// Cliquer une session dans Aujourd'hui ou Semaine ouvre sa fenêtre.
enregistrerEditeur('session-etude', (item) => ouvrirSession({ id: item.id }));

// ---- Affichage ----

function barre(pourcent, fine = false) {
  return h(
    'div',
    { class: 'barre-progression' + (fine ? ' barre-fine' : ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pourcent },
    h('div', { class: 'remplissage', style: `width: ${pourcent}%` })
  );
}

function selectStatut(chapitre) {
  return h(
    'select',
    {
      class: `champ statut-select statut-${chapitre.statut}`,
      'aria-label': `Statut de « ${chapitre.titre} »`,
      onchange: (e) => {
        const v = e.target.value;
        if (v === 'termine' || v === 'revise') etincelles(e.target);
        store.modifier((d) => E.definirStatut(d, chapitre.id, v));
      },
    },
    E.STATUTS.map((s) => h('option', { value: s.id, selected: s.id === chapitre.statut }, s.nom))
  );
}

// Un chapitre : son statut, son titre (qui ouvre sa fiche) et, s'il y en a, ses QCM et ses notes.
function ligneChapitre(c, donnees, ctx, nbQcm) {
  const nbNotes = donnees.etudes.recherches.filter((r) => r.chapitreId === c.id).length;
  return h(
    'li',
    { class: 'ligne ligne-chapitre' },
    selectStatut(c),
    h('button', { class: 'titre-cliquable ligne-titre ligne-bloc', type: 'button', title: 'Ouvrir ce chapitre', onclick: () => ouvrirChapitre(c.id, ctx) }, c.titre),
    c.cours &&
      h('button', { class: 'bouton-icone', type: 'button', title: 'Ouvrir mon cours', 'aria-label': `Ouvrir mon cours « ${c.titre} »`, onclick: () => ctx.aller('cours', { chapitreId: c.id }) }, '📖'),
    (nbQcm > 0 || nbNotes > 0) &&
      h(
        'span',
        { class: 'meta' },
        [nbQcm > 0 && `📝 ${nbQcm}`, nbNotes > 0 && `🔎 ${nbNotes}`].filter(Boolean).join('  ')
      )
  );
}

// Une carte de module : son nom, son avancement. On clique pour voir ses chapitres.
function carteModule(module, donnees, ctx) {
  const p = E.progression(donnees, module.id);
  return h(
    'button',
    {
      class: 'carte-zone carte-module',
      type: 'button',
      onclick: () => {
        moduleOuvert = module.id;
        ctx.redessiner();
      },
    },
    h(
      'span',
      { class: 'carte-zone-texte' },
      h('strong', null, module.titre),
      h('span', { class: 'meta' }, p.total === 0 ? 'Aucun chapitre' : `${p.termines} sur ${p.total} terminé${p.termines > 1 ? 's' : ''}`),
      p.total > 0 && barre(p.pourcent, true)
    )
  );
}

// Le détail d'un module : ses chapitres.
function detailModule(module, donnees, ctx, avecRetour) {
  const chapitres = E.chapitresDuModule(donnees, module.id);
  const p = E.progression(donnees, module.id);
  const champ = h('input', { type: 'text', class: 'champ', placeholder: 'Nouveau chapitre…', maxLength: 200, 'aria-label': `Nouveau chapitre dans « ${module.titre} »`, 'data-module': module.id });
  const ajouter = () => {
    const titre = champ.value.trim();
    if (!titre) return;
    focusModuleId = module.id;
    store.modifier((d) => E.ajouterChapitre(d, module.id, titre));
  };
  champ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ajouter();
    }
  });

  return [
    avecRetour &&
      h(
        'div',
        null,
        h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { moduleOuvert = null; ctx.redessiner(); } }, '← Tous les modules')
      ),
    h(
      'section',
      { class: 'fenetre carte-module', style: '--cat: var(--violet)' },
      h(
        'div',
        { class: 'fenetre-barre' },
        pastilles(),
        h('h2', { class: 'fenetre-titre' }, module.titre),
        h('span', { class: 'mono' }, `${p.termines}/${p.total}`),
        h('button', { class: 'bouton-icone', type: 'button', title: 'Modifier le module', 'aria-label': `Modifier le module « ${module.titre} »`, onclick: () => ouvrirModule(module.id) }, '✎')
      ),
      h(
        'div',
        { class: 'fenetre-corps pile' },
        barre(p.pourcent, true),
        chapitres.length
          ? h('ul', { class: 'liste-simple' }, chapitres.map((c) => ligneChapitre(c, donnees, ctx, donnees.etudes.qcm.filter((q) => q.chapitreId === c.id).length)))
          : h('p', { class: 'doux' }, 'Aucun chapitre pour le moment : ajoute le premier ci-dessous.'),
        h(
          'div',
          { class: 'rangee rangee-souple' },
          champ,
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ajouter }, '＋ Chapitre'),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirPlusieurs(module.id) }, 'Plusieurs à la fois')
        )
      )
    ),
  ];
}

export function rendreParcours(conteneur, ctx) {
  const donnees = store.lire();
  const { modules } = donnees.etudes;
  const g = E.progression(donnees);
  const reel = aujourdhui();

  const aVenir = donnees.etudes.sessions
    .filter((s) => !s.abandonnee && s.date >= reel)
    .sort((a, b) => (a.date + a.heure < b.date + b.heure ? -1 : 1))
    .slice(0, 3);

  // Un seul module : on va directement à ses chapitres, sans étape intermédiaire.
  const ouvert = modules.find((m) => m.id === moduleOuvert) || (modules.length === 1 ? modules[0] : null);
  if (!modules.some((m) => m.id === moduleOuvert)) moduleOuvert = null;

  const barreAjout = h(
    'div',
    { class: 'barre-discrete' },
    h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirModule() }, '＋ Module'),
    h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirSession({}) }, '🗓 Planifier une session')
  );

  vider(conteneur);

  if (modules.length === 0) {
    conteneur.append(
      h(
        'section',
        { class: 'fenetre', style: '--cat: var(--violet)' },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mon parcours')),
        h(
          'div',
          { class: 'fenetre-corps pile' },
          h('p', null, "Tu ne connais pas encore toute la structure de ta formation ? Ce n'est pas grave : ajoute un premier module, et complète au fur et à mesure."),
          h('div', null, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => ouvrirModule() }, '＋ Mon premier module'))
        )
      )
    );
    return;
  }

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      // Où j'en suis : une seule ligne, sans fenêtre
      !ouvert &&
        g.total > 0 &&
        h(
          'div',
          { class: 'progression-fine' },
          barre(g.pourcent),
          h('span', { class: 'progression-texte mono' }, `${g.termines} sur ${g.total} terminé${g.termines > 1 ? 's' : ''}${g.enCours ? ` · ${g.enCours} en cours` : ''}`)
        ),

      ouvert
        ? detailModule(ouvert, donnees, ctx, modules.length > 1)
        : h(
            'div',
            { class: 'pile' },
            h('h2', { class: 'titre-section' }, 'Mes modules'),
            h('div', { class: 'grille-zones' }, modules.map((m) => carteModule(m, donnees, ctx)))
          ),

      // Prochaines sessions : au plus 3, en bas
      !ouvert &&
        aVenir.length > 0 &&
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--ciel)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Prochaines sessions')),
          h(
            'ul',
            { class: 'fenetre-corps liste' },
            aVenir.map((s) =>
              h(
                'li',
                { class: 'ligne ligne-simple' },
                h('span', { class: 'rdv-heure mono' }, formatCourt(s.date)),
                h(
                  'button',
                  { class: 'titre-cliquable ligne-bloc', type: 'button', title: 'Modifier la session', onclick: () => ouvrirSession({ id: s.id }) },
                  s.heure ? `${s.heure} · ${E.titreSession(donnees, s)}` : E.titreSession(donnees, s)
                )
              )
            )
          )
        ),
      barreAjout
    )
  );

  if (focusModuleId) {
    // L'onglet n'est pas encore dans la page à cet instant : on attend qu'il y soit.
    const moduleId = focusModuleId;
    focusModuleId = null;
    setTimeout(() => {
      const champ = [...document.querySelectorAll('input[data-module]')].find((c) => c.dataset.module === moduleId);
      champ?.focus();
    }, 0);
  }
}
