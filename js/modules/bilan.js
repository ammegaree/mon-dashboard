// Page « Bilan » : le bilan de la semaine.
// Un récapitulatif automatique de ce qui a été fait, trois questions, des priorités
// pour la semaine suivante (affichées sur l'accueil), et les bilans passés.
// Ton : bienveillant. On met en avant ce qui a été fait.

import { h, vider, pastilles, notifier, confettis } from '../ui.js';
import { enregistrerPage } from '../registry.js';
import * as store from '../store.js';
import { aujourdhui, ajouterJours, lundiDe, formatPlage, formatJourMois } from '../dates.js';
import * as K from './bilan-donnees.js';
import { formaterDuree } from './etudes-donnees.js';
import { HUMEURS, ENERGIES, formaterHeures, emojiHumeur, emojiEnergie } from './bien-etre-donnees.js';
import { categorieDe } from './actions-taches.js';

const STATUTS = { 'en-cours': 'en cours', termine: 'terminé', revise: 'révisé' };

let lundiVu = null; // null = la semaine à bilanner
const textesEnCours = new Map(); // lundi → { fiere, difficile, priorites } : ce qu'on est en train d'écrire

function virgule(n) {
  return n.toFixed(1).replace('.', ',');
}

function tuile(valeur, libelle, couleur) {
  return h('div', { class: 'tuile', style: `--cat: var(--${couleur})` }, h('span', { class: 'tuile-valeur mono' }, valeur), h('span', { class: 'tuile-libelle' }, libelle));
}

// ---- Le récapitulatif ----

function carteRecap(recap, donnees) {
  const r = recap;
  const sections = [];

  // Choses faites, par catégorie
  const faites = r.taches.total + r.taches.routines;
  if (faites > 0) {
    sections.push(
      h(
        'div',
        { class: 'recap-bloc' },
        h('h3', null, `✅ ${r.taches.total} chose${r.taches.total > 1 ? 's' : ''} faite${r.taches.total > 1 ? 's' : ''}`),
        r.taches.total > 0 &&
          h(
            'div',
            { class: 'puces' },
            r.taches.parCategorie.map((x) => {
              const cat = categorieDe(donnees, x.categorieId);
              return h('span', { class: 'pastille-domaine', style: `--cat: var(--${cat.couleur})` }, `${cat.icone} ${cat.nom} · ${x.n}`);
            })
          ),
        r.taches.routines > 0 && h('p', { class: 'doux' }, `+ ${r.taches.routines} étape${r.taches.routines > 1 ? 's' : ''} de routine`)
      )
    );
  }

  // Études
  const e = r.etudes;
  if (e.chapitres.length || e.secondes > 0 || e.qcm.n > 0) {
    sections.push(
      h(
        'div',
        { class: 'recap-bloc' },
        h('h3', null, '📚 Études'),
        h(
          'ul',
          { class: 'liste-puces' },
          e.chapitres.map((c) => h('li', null, `Chapitre « ${c.titre} » : ${STATUTS[c.statut] || c.statut}`)),
          e.secondes > 0 && h('li', null, `${formaterDuree(e.secondes)} de concentration`),
          e.qcm.n > 0 && h('li', null, `${e.qcm.n} QCM passé${e.qcm.n > 1 ? 's' : ''}${e.qcm.moyenne != null ? ` (moyenne ${e.qcm.moyenne} %)` : ''}`)
        )
      )
    );
  }

  // Sport
  if (r.sport.n > 0) {
    sections.push(
      h('div', { class: 'recap-bloc' }, h('h3', null, '🏃‍♀️ Sport'), h('p', null, `${r.sport.n} séance${r.sport.n > 1 ? 's' : ''}${r.sport.minutes ? ` · ${formaterDuree(r.sport.minutes * 60)}` : ''}`))
    );
  }

  // Bien-être
  const b = r.bienEtre;
  if (b.nbJours > 0) {
    sections.push(
      h(
        'div',
        { class: 'recap-bloc' },
        h('h3', null, '🌸 Bien-être'),
        h(
          'ul',
          { class: 'liste-puces' },
          b.humeur != null && h('li', null, `Humeur moyenne : ${emojiHumeur(b.humeur)} ${virgule(b.humeur)}/5`),
          b.energie != null && h('li', null, `Énergie moyenne : ${emojiEnergie(b.energie)} ${virgule(b.energie)}/5`),
          b.sommeilHeures != null && h('li', null, `Sommeil moyen : 🌙 ${formaterHeures(b.sommeilHeures)}`),
          h('li', { class: 'meta' }, `sur ${b.nbJours} jour${b.nbJours > 1 ? 's' : ''} renseigné${b.nbJours > 1 ? 's' : ''}`)
        )
      )
    );
  }

  // Anciens bilans : les avancées qui avaient été notées dans le carnet
  if (r.avancees?.length) {
    sections.push(
      h(
        'div',
        { class: 'recap-bloc recap-large' },
        h('h3', null, '📓 Avancées notées'),
        h(
          'ul',
          { class: 'liste-puces' },
          r.avancees.slice(0, 6).map((n) => {
            const cat = n.categorieId ? categorieDe(donnees, n.categorieId) : null;
            return h('li', null, `${cat ? `${cat.icone} ` : ''}${n.texte}`);
          }),
          r.avancees.length > 6 && h('li', { class: 'meta' }, `… et ${r.avancees.length - 6} autre${r.avancees.length - 6 > 1 ? 's' : ''}`)
        )
      )
    );
  }

  return h(
    'section',
    { class: 'fenetre', style: '--cat: var(--jaune)' },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Ta semaine en bref')),
    h(
      'div',
      { class: 'fenetre-corps pile' },
      h('p', { class: 'message-progression' }, K.messageRecap(r)),
      sections.length > 0 && h('div', { class: 'recap-grille' }, sections)
    )
  );
}

// ---- Le formulaire des trois questions ----

function formulaire(lundi, existant, ctx) {
  const brouillon = textesEnCours.get(lundi) || {
    fiere: existant?.fiere || '',
    difficile: existant?.difficile || '',
    priorites: (existant?.priorites || []).join('\n'),
  };
  const garder = (cle) => (e) => {
    brouillon[cle] = e.target.value;
    textesEnCours.set(lundi, brouillon);
  };

  const fiere = h('textarea', { class: 'champ champ-note', rows: 3, id: 'bilan-fiere', placeholder: 'Même une toute petite chose compte…', oninput: garder('fiere') }, brouillon.fiere);
  const difficile = h('textarea', { class: 'champ champ-note', rows: 3, id: 'bilan-difficile', placeholder: "Ce qui a pesé, sans te juger. Tu peux aussi laisser vide.", oninput: garder('difficile') }, brouillon.difficile);
  const priorites = h('textarea', { class: 'champ champ-note', rows: 4, id: 'bilan-priorites', placeholder: 'Une par ligne. Une à trois, c\'est déjà très bien.', oninput: garder('priorites') }, brouillon.priorites);

  return h(
    'section',
    { class: 'fenetre', style: '--cat: var(--rose)' },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Trois petites questions'), existant && h('span', { class: 'mono' }, '✓ fait')),
    h(
      'form',
      {
        class: 'fenetre-corps pile',
        onsubmit: (e) => {
          e.preventDefault();
          const premier = !existant;
          store.modifier((d) => K.enregistrerBilan(d, { lundi, fiere: fiere.value, difficile: difficile.value, priorites: priorites.value }));
          textesEnCours.delete(lundi);
          if (premier) {
            confettis();
            notifier('Bilan enregistré, bravo ✦ Tes priorités t\'attendent sur l\'accueil.');
          } else {
            notifier('Bilan mis à jour ✦');
          }
        },
      },
      h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'bilan-fiere' }, 'De quoi suis-je fière cette semaine ?'), fiere),
      h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'bilan-difficile' }, "Qu'est-ce qui a été difficile ?"), difficile),
      h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'bilan-priorites' }, 'Mes priorités pour la semaine prochaine'), priorites),
      h(
        'div',
        { class: 'rangee droite' },
        existant &&
          h(
            'button',
            {
              class: 'bouton',
              type: 'button',
              onclick: () => {
                let retire = null;
                store.modifier((d) => (retire = K.supprimerBilan(d, existant.id)));
                if (retire) notifier('Bilan supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => K.restaurerBilan(d, retire)) } });
              },
            },
            'Supprimer ce bilan'
          ),
        h('button', { class: 'bouton bouton-jaune', type: 'submit' }, existant ? 'Mettre à jour ✦' : 'Enregistrer mon bilan ✦')
      )
    )
  );
}

// ---- Page ----

function rendre(racine, ctx) {
  const donnees = store.lire();
  const reel = aujourdhui();
  const proposee = K.semaineABilanner(reel);
  const lundi = lundiVu || proposee;
  const dimanche = ajouterJours(lundi, 6);
  const existant = K.bilanDeLaSemaine(donnees, lundi);
  const enAttente = K.bilanEnAttente(donnees, reel);
  const passes = K.bilansPasses(donnees);

  // Le récap est figé dans un bilan déjà fait ; sinon il est calculé à la volée.
  const recap = existant?.recap || K.recapSemaine(donnees, lundi);
  const derniereSemaine = lundiDe(reel);

  const aller = (n) => {
    const cible = ajouterJours(lundi, 7 * n);
    if (cible > derniereSemaine) return;
    lundiVu = cible === proposee ? null : cible;
    ctx.redessiner();
  };

  vider(racine);
  racine.append(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'entete-page' },
        h('div', null, h('h1', null, '🌟 Bilan'), h('p', { class: 'sous-titre mono' }, `Semaine du ${formatPlage(lundi, dimanche)}`)),
        h(
          'nav',
          { class: 'rangee rangee-souple', 'aria-label': 'Changer de semaine' },
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Semaine précédente', onclick: () => aller(-1) }, '◀'),
          lundi !== proposee && h('button', { class: 'bouton', type: 'button', onclick: () => { lundiVu = null; ctx.redessiner(); } }, 'Semaine à bilanner'),
          h('button', { class: 'bouton bouton-icone-grand', type: 'button', 'aria-label': 'Semaine suivante', disabled: ajouterJours(lundi, 7) > derniereSemaine, onclick: () => aller(1) }, '▶')
        )
      ),
      enAttente && lundi === enAttente && !existant && h('p', { class: 'doux' }, "C'est le moment de faire le point, à ton rythme : regarde ce qui s'est passé, puis réponds si tu en as envie."),
      carteRecap(recap, donnees),
      formulaire(lundi, existant, ctx),
      existant && lundi === proposee && h('p', null, h('a', { class: 'bouton bouton-petit', href: '#/preparer' }, '🧭 Préparer la semaine qui vient ›')),
      passes.length > 0 &&
        h(
          'section',
          { class: 'fenetre', style: '--cat: var(--ciel)' },
          h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Mes bilans passés')),
          h(
            'ul',
            { class: 'fenetre-corps liste' },
            passes.map((b) =>
              h(
                'li',
                { class: 'ligne ligne-simple' + (b.lundi === lundi ? ' ligne-courante' : '') },
                h('span', { class: 'rdv-heure mono' }, formatJourMois(b.lundi)),
                h(
                  'div',
                  { class: 'ligne-bloc' },
                  h('strong', null, `Semaine du ${formatPlage(b.lundi, ajouterJours(b.lundi, 6))}`),
                  b.fiere && h('span', { class: 'meta' }, `Fière : ${b.fiere.length > 90 ? `${b.fiere.slice(0, 90)}…` : b.fiere}`)
                ),
                h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { lundiVu = b.lundi === proposee ? null : b.lundi; ctx.redessiner(); window.scrollTo(0, 0); } }, 'Ouvrir')
              )
            )
          )
        )
    )
  );
}

enregistrerPage('bilan', rendre);
