// Onglet « QCM » : importer, passer un QCM, voir la correction expliquée,
// suivre ses scores et refaire seulement les questions ratées.

import { h, vider, ouvrirModale, confirmer, notifier, pastilles } from '../ui.js';
import * as store from '../store.js';
import { formatCourt } from '../dates.js';
import * as E from './etudes-donnees.js';
import { selecteurChapitre } from './etudes-composants.js';
import { LETTRES, PROMPT_CLAUDE, estJuste } from './qcm-format.js';
import { sourcesQcm } from './sources-qcm.js';

// ---- État de l'onglet (le temps de la visite) ----
let vue = { mode: 'liste' }; // 'liste' | 'quiz' | 'resultat'
let filtreChapitre = ''; // '' = tous
const historiquesOuverts = new Set();
let ecranPrecedent = '';

// ---- Prompt pour Claude ----

function ouvrirPrompt() {
  ouvrirModale({
    titre: 'Obtenir un QCM avec Claude',
    couleur: 'violet',
    large: true,
    corps: () => {
      const zone = h('pre', { class: 'prompt-texte', tabindex: 0 }, PROMPT_CLAUDE);
      const copier = h(
        'button',
        {
          class: 'bouton bouton-jaune',
          type: 'button',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(PROMPT_CLAUDE);
              notifier('Prompt copié ✦');
            } catch {
              const plage = document.createRange();
              plage.selectNodeContents(zone);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(plage);
              notifier('Sélectionné : fais Cmd + C pour le copier.');
            }
          },
        },
        '📋 Copier le prompt'
      );
      return h(
        'div',
        { class: 'pile' },
        h(
          'ol',
          { class: 'etapes' },
          h('li', null, 'Ouvre Claude, joins le PDF du chapitre de ton cours.'),
          h('li', null, 'Colle le prompt ci-dessous et envoie. Les QCM sont à choix unique (une seule bonne réponse).'),
          h('li', null, 'Claude répond avec un bloc de code : copie tout son contenu.'),
          h('li', null, 'Reviens ici, onglet QCM, « Importer un QCM », et colle-le (ou enregistre-le dans un fichier .json et choisis-le).')
        ),
        h('div', { class: 'rangee droite' }, copier),
        zone
      );
    },
  });
}

// ---- Importer ----

function ouvrirImport({ chapitreId = null } = {}) {
  const donnees = store.lire();
  const sources = sourcesQcm();

  ouvrirModale({
    titre: 'Importer un QCM',
    couleur: 'violet',
    large: true,
    corps: (fermer) => {
      let resultat = null;
      const apercu = h('div', { class: 'apercu-qcm', 'aria-live': 'polite' });
      const bouton = h('button', { class: 'bouton bouton-jaune', type: 'button', disabled: true }, 'Importer');
      const chapitre = selecteurChapitre(donnees, { valeur: chapitreId, id: 'import-chapitre', texteAucun: 'Sans chapitre précis' });

      const surProduit = (r) => {
        resultat = r;
        vider(apercu);
        bouton.disabled = !(r && r.qcm);
        if (!r) return;
        if (r.erreurs?.length) {
          apercu.append(
            h(
              'div',
              null,
              h('p', { class: 'apercu-titre erreur' }, 'Ce QCM ne peut pas être importé tel quel :'),
              h('ul', null, r.erreurs.slice(0, 8).map((e) => h('li', null, e))),
              r.erreurs.length > 8 && h('p', { class: 'meta' }, `… et ${r.erreurs.length - 8} autre(s).`),
              h('p', { class: 'doux' }, 'Tu peux redemander à Claude de corriger en lui collant ces messages.')
            )
          );
          return;
        }
        const n = r.qcm.questions.length;
        apercu.append(
          h(
            'div',
            null,
            h('p', { class: 'apercu-titre ok' }, `✓ « ${r.qcm.titre} » — ${n} question${n > 1 ? 's' : ''} à choix unique`),
            r.avertissements?.length > 0 && h('ul', { class: 'avertissements' }, r.avertissements.map((a) => h('li', null, a)))
          )
        );
      };

      bouton.addEventListener('click', () => {
        if (!resultat?.qcm) return;
        store.modifier((d) => E.ajouterQcm(d, { chapitreId: chapitre.value || null, qcm: resultat.qcm }));
        fermer();
        notifier('QCM importé ✦ Tu peux le passer quand tu veux.');
      });

      const zoneSource = h('div', { class: 'pile' });
      sources[0].monter(zoneSource, surProduit);

      return h(
        'div',
        { class: 'pile' },
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'import-chapitre' }, 'Rattacher à ce chapitre'), chapitre),
        zoneSource,
        apercu,
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { fermer(); ouvrirPrompt(); } }, 'Comment obtenir un QCM ?'),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          bouton
        )
      );
    },
  });
}

// ---- Passer un QCM (correction immédiate, question par question) ----

function demarrerQuiz(qcmId, ids, partiel) {
  vue = { mode: 'quiz', qcmId, ids, index: 0, reponses: {}, valides: {}, partiel };
}

function questionsDuQuiz(qcm, ids) {
  return ids.map((id) => qcm.questions.find((q) => q.id === id)).filter(Boolean);
}

function vueQuiz(conteneur, ctx, donnees) {
  const qcm = donnees.etudes.qcm.find((q) => q.id === vue.qcmId);
  if (!qcm) {
    vue = { mode: 'liste' };
    return ctx.redessiner();
  }
  const questions = questionsDuQuiz(qcm, vue.ids);
  const total = questions.length;
  if (total === 0) {
    vue = { mode: 'liste' };
    return ctx.redessiner();
  }
  const q = questions[vue.index];
  const valide = Boolean(vue.valides[q.id]);
  const choisis = vue.reponses[q.id] || [];
  const juste = valide && estJuste(q, choisis);
  const derniere = vue.index === total - 1;
  const nbValides = questions.filter((x) => vue.valides[x.id]).length;
  const nbJustes = questions.filter((x) => vue.valides[x.id] && estJuste(x, vue.reponses[x.id] || [])).length;
  const lettresBonnes = q.bonnes.map((i) => LETTRES[i]).join(', ');

  // ---- Les choix : à cocher avant la validation, corrigés après ----
  let zoneChoix;
  let boutonAction;
  if (!valide) {
    const boutonValider = h('button', { class: 'bouton bouton-jaune', type: 'button', disabled: choisis.length === 0 }, 'Valider ma réponse');
    boutonValider.addEventListener('click', () => {
      vue.valides[q.id] = true;
      ctx.redessiner();
    });
    const nomGroupe = `choix-${q.id}`;
    zoneChoix = h(
      'div',
      { class: 'choix-liste', role: 'radiogroup', 'aria-label': 'Réponses possibles' },
      q.choix.map((texte, i) =>
        h(
          'label',
          { class: 'choix' },
          h('input', {
            type: q.type === 'multiple' ? 'checkbox' : 'radio', // les anciens QCM importés peuvent en contenir
            name: nomGroupe,
            checked: choisis.includes(i),
            onchange: (e) => {
              const actuel = new Set(vue.reponses[q.id] || []);
              if (q.type !== 'multiple') actuel.clear();
              if (e.target.checked) actuel.add(i);
              else actuel.delete(i);
              vue.reponses[q.id] = [...actuel];
              boutonValider.disabled = actuel.size === 0;
            },
          }),
          h('span', { class: 'choix-lettre mono' }, LETTRES[i]),
          h('span', { class: 'choix-texte' }, texte)
        )
      )
    );
    boutonAction = boutonValider;
  } else {
    zoneChoix = h(
      'div',
      { class: 'choix-liste', 'aria-label': 'Correction' },
      q.choix.map((texte, i) => {
        const bonne = q.bonnes.includes(i);
        const choisie = choisis.includes(i);
        const classe = bonne ? ' bonne' : choisie ? ' mauvaise' : ' neutre';
        return h(
          'div',
          { class: `choix corrige${classe}` },
          h('span', { class: 'choix-lettre mono' }, LETTRES[i]),
          h('span', { class: 'choix-texte' }, texte),
          h('span', { class: 'choix-etat mono' }, bonne ? (choisie ? '✓ ta réponse' : '✓ bonne réponse') : choisie ? '✗ ta réponse' : '')
        );
      })
    );
    boutonAction = derniere
      ? h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: terminer }, 'Voir mon résultat ✦')
      : h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => { vue.index++; ctx.redessiner(); } }, 'Question suivante →');
  }

  function terminer() {
    const detail = questions.map((x) => {
      const choisisX = vue.reponses[x.id] || [];
      return { questionId: x.id, choisis: choisisX, juste: estJuste(x, choisisX) };
    });
    const { qcmId, partiel } = vue;
    vue = { mode: 'resultat', qcmId, detail, partiel };
    store.modifier((d) => E.enregistrerResultat(d, { qcmId, detail, partiel }));
  }

  // ---- L'encadré d'explication, affiché que la réponse soit juste ou non ----
  const encadre =
    valide &&
    h(
      'aside',
      { class: 'encadre-correction ' + (juste ? 'juste' : 'a-revoir'), role: 'status' },
      h('p', { class: 'encadre-titre' }, juste ? '✓ Bien vu !' : `Pas tout à fait — la bonne réponse est ${lettresBonnes}.`),
      q.explication
        ? h('p', { class: 'encadre-texte' }, q.explication)
        : h('p', { class: 'meta' }, "Pas d'explication fournie pour cette question."),
      q.reference && h('p', { class: 'encadre-reference mono' }, `📖 Dans ton cours : ${q.reference}`)
    );

  const quitter = async () => {
    if (nbValides > 0) {
      const ok = await confirmer({
        titre: 'Quitter le QCM ?',
        message: "Tes réponses de cette session ne seront pas enregistrées. Tu pourras recommencer quand tu veux.",
        oui: 'Quitter',
        non: 'Continuer',
        couleur: 'jaune',
      });
      if (!ok) return;
    }
    vue = { mode: 'liste' };
    ctx.redessiner();
  };

  conteneur.append(
    h(
      'section',
      { class: 'fenetre', style: '--cat: var(--violet)' },
      h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, qcm.titre), h('span', { class: 'mono' }, `${vue.index + 1}/${total}`)),
      h(
        'div',
        { class: 'fenetre-corps pile' },
        h('div', { class: 'barre-progression barre-fine' }, h('div', { class: 'remplissage', style: `width: ${Math.round((nbValides / total) * 100)}%` })),
        h('p', { class: 'meta mono' }, `${vue.partiel ? 'On refait seulement les questions à revoir · ' : ''}${nbJustes} bonne${nbJustes > 1 ? 's' : ''} réponse${nbJustes > 1 ? 's' : ''} sur ${nbValides} répondue${nbValides > 1 ? 's' : ''}`),
        h('h3', { class: 'question-texte' }, q.question),
        zoneChoix,
        encadre,
        h(
          'div',
          { class: 'rangee rangee-souple' },
          h('button', { class: 'bouton', type: 'button', onclick: quitter }, 'Quitter'),
          h('span', { class: 'espaceur' }),
          boutonAction
        )
      )
    )
  );
}

// ---- Correction ----

function messageDeScore(pourcent) {
  if (pourcent >= 80) return 'Superbe travail ✦ Tu maîtrises bien ce chapitre.';
  if (pourcent >= 50) return 'Bien joué, tu avances ✦ Quelques points à consolider.';
  return "C'est en s'entraînant qu'on retient ✦ Voici de quoi progresser, à ton rythme.";
}

function vueResultat(conteneur, ctx, donnees) {
  const qcm = donnees.etudes.qcm.find((q) => q.id === vue.qcmId);
  if (!qcm) {
    vue = { mode: 'liste' };
    return ctx.redessiner();
  }
  const { detail } = vue;
  const juste = detail.filter((x) => x.juste).length;
  const total = detail.length;
  const pourcent = total ? Math.round((juste / total) * 100) : 0;
  const ratees = detail.filter((x) => !x.juste).map((x) => x.questionId);

  const cartes = detail.map((x, n) => {
    const q = qcm.questions.find((y) => y.id === x.questionId);
    if (!q) return null;
    return h(
      'article',
      { class: 'correction ' + (x.juste ? 'juste' : 'a-revoir') },
      h('p', { class: 'correction-entete mono' }, `Question ${n + 1} · ${x.juste ? '✓ Réussie' : 'À revoir'}`),
      h('p', { class: 'question-texte' }, q.question),
      h(
        'ul',
        { class: 'correction-choix' },
        q.choix.map((texte, i) => {
          const bonne = q.bonnes.includes(i);
          const choisi = x.choisis.includes(i);
          let marque = '○';
          let classe = '';
          if (bonne) {
            marque = '✓';
            classe = 'bonne';
          } else if (choisi) {
            marque = '✗';
            classe = 'mauvaise';
          }
          return h(
            'li',
            { class: `correction-ligne ${classe}${choisi ? ' choisie' : ''}` },
            h('span', { class: 'correction-marque mono', 'aria-hidden': 'true' }, marque),
            h('span', { class: 'choix-lettre mono' }, LETTRES[i]),
            h('span', null, texte),
            choisi && h('span', { class: 'meta' }, '(ta réponse)')
          );
        })
      ),
      x.choisis.length === 0 && h('p', { class: 'meta' }, 'Pas de réponse donnée.'),
      q.explication && h('p', { class: 'explication' }, h('strong', null, 'Explication : '), q.explication),
      q.reference && h('p', { class: 'encadre-reference mono' }, `📖 Dans ton cours : ${q.reference}`)
    );
  });

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'section',
        { class: 'fenetre', style: `--cat: var(--${pourcent >= 50 ? 'turquoise' : 'jaune'})` },
        h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, qcm.titre)),
        h(
          'div',
          { class: 'fenetre-corps pile score-bloc' },
          h('p', { class: 'score-grand mono' }, `${juste} / ${total}`),
          h('div', { class: 'barre-progression' }, h('div', { class: 'remplissage', style: `width: ${pourcent}%` })),
          h('p', { class: 'message-progression' }, messageDeScore(pourcent)),
          h(
            'div',
            { class: 'rangee rangee-souple' },
            ratees.length > 0 &&
              h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => { demarrerQuiz(qcm.id, ratees, true); ctx.redessiner(); } }, `↻ Refaire les ${ratees.length} à revoir`),
            h('button', { class: 'bouton', type: 'button', onclick: () => { demarrerQuiz(qcm.id, qcm.questions.map((q) => q.id), false); ctx.redessiner(); } }, 'Recommencer tout'),
            h('button', { class: 'bouton', type: 'button', onclick: () => { vue = { mode: 'liste' }; ctx.redessiner(); } }, 'Retour aux QCM')
          )
        )
      ),
      h('h3', null, 'La correction'),
      cartes
    )
  );
}

// ---- Liste des QCM ----

function carteQcm(qcm, donnees, ctx) {
  const resume = E.resumeScores(donnees, qcm.id);
  const ratees = E.questionsRatees(donnees, qcm.id).filter((id) => qcm.questions.some((q) => q.id === id));
  const historique = E.historiqueQcm(donnees, qcm.id).slice().reverse();
  const ouvert = historiquesOuverts.has(qcm.id);

  return h(
    'section',
    { class: 'fenetre', style: '--cat: var(--violet)' },
    h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, qcm.titre), h('span', { class: 'mono' }, `${qcm.questions.length} q.`)),
    h(
      'div',
      { class: 'fenetre-corps pile' },
      h('p', { class: 'meta' }, `📖 ${E.nomChapitre(donnees, qcm.chapitreId)}`),
      resume
        ? h('p', { class: 'mono' }, `Dernier : ${resume.dernier.juste}/${resume.dernier.total} (${resume.dernier.pourcent} %) · Meilleur : ${resume.meilleur} % · ${resume.essais} essai${resume.essais > 1 ? 's' : ''}`)
        : h('p', { class: 'doux' }, 'Pas encore passé.'),
      h(
        'div',
        { class: 'rangee rangee-souple' },
        h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: () => { demarrerQuiz(qcm.id, qcm.questions.map((q) => q.id), false); ctx.redessiner(); } }, '▶ Commencer'),
        ratees.length > 0 && h('button', { class: 'bouton', type: 'button', onclick: () => { demarrerQuiz(qcm.id, ratees, true); ctx.redessiner(); } }, `↻ Refaire les ${ratees.length} à revoir`),
        historique.length > 0 &&
          h('button', { class: 'bouton bouton-petit', type: 'button', 'aria-expanded': String(ouvert), onclick: () => { ouvert ? historiquesOuverts.delete(qcm.id) : historiquesOuverts.add(qcm.id); ctx.redessiner(); } }, ouvert ? 'Masquer l\'historique' : 'Historique'),
        h(
          'button',
          {
            class: 'bouton bouton-petit',
            type: 'button',
            onclick: async () => {
              const ok = await confirmer({
                titre: 'Supprimer ce QCM ?',
                message: `« ${qcm.titre} » et son historique de scores seront supprimés. Tu pourras le réimporter depuis le fichier.`,
                oui: 'Supprimer',
                non: 'Garder',
              });
              if (ok) store.modifier((d) => E.supprimerQcm(d, qcm.id));
            },
          },
          'Supprimer'
        )
      ),
      ouvert &&
        h(
          'ul',
          { class: 'liste-simple' },
          historique.map((r) => {
            const pct = r.total ? Math.round((r.juste / r.total) * 100) : 0;
            return h(
              'li',
              { class: 'ligne ligne-simple' },
              h('span', { class: 'rdv-heure mono' }, formatCourt(r.date.slice(0, 10))),
              h('span', { class: 'ligne-bloc' }, r.partiel ? 'Questions à revoir' : 'QCM complet'),
              h('div', { class: 'barre-progression barre-mini', 'aria-hidden': 'true' }, h('div', { class: 'remplissage', style: `width: ${pct}%` })),
              h('span', { class: 'mono' }, `${r.juste}/${r.total}`)
            );
          })
        )
    )
  );
}

function vueListe(conteneur, ctx, donnees) {
  const tous = donnees.etudes.qcm;
  const visibles = filtreChapitre ? tous.filter((q) => q.chapitreId === filtreChapitre) : tous;

  conteneur.append(
    h(
      'div',
      { class: 'pile pile-large' },
      h(
        'div',
        { class: 'barre-actions' },
        tous.length > 0 &&
          h(
            'div',
            { class: 'rangee-champ' },
            h('label', { class: 'etiquette', for: 'filtre-qcm' }, 'Chapitre'),
            selecteurChapitre(donnees, { valeur: filtreChapitre || null, id: 'filtre-qcm', texteAucun: 'Tous', surChangement: (id) => { filtreChapitre = id || ''; ctx.redessiner(); } })
          )
      ),
      tous.length === 0
        ? h(
            'section',
            { class: 'fenetre', style: '--cat: var(--jaune)' },
            h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, 'Comment ça marche')),
            h(
              'div',
              { class: 'fenetre-corps pile' },
              h('p', null, "Donne à Claude le PDF d'un chapitre de ton cours avec le prompt prêt à copier : il te renvoie un QCM que tu importes ici. Tu passes le QCM : après chaque réponse, tu vois tout de suite la correction avec l'explication tirée de ton cours. Tu gardes ton historique de scores et tu peux refaire seulement les questions à revoir."),
              h('div', { class: 'rangee rangee-souple' }, h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: ouvrirPrompt }, '📋 Voir le prompt à copier'), h('button', { class: 'bouton', type: 'button', onclick: () => ouvrirImport() }, '＋ Importer un QCM'))
            )
          )
        : visibles.length === 0
          ? h('p', { class: 'vide' }, 'Aucun QCM pour ce chapitre. Importes-en un avec le bouton ci-dessous.')
          : visibles.map((q) => carteQcm(q, donnees, ctx)),
      // Une fois qu'il y a des QCM : l'import et le prompt restent à portée, discrètement, en bas.
      tous.length > 0 &&
        h(
          'div',
          { class: 'barre-discrete' },
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => ouvrirImport({ chapitreId: filtreChapitre || null }) }, '＋ Importer un QCM'),
          h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ouvrirPrompt }, '📋 Prompt pour Claude')
        )
    )
  );
}

export function rendreQcm(conteneur, ctx) {
  const donnees = store.lire();
  if (ctx.params && 'chapitreId' in ctx.params) {
    filtreChapitre = ctx.params.chapitreId || '';
    vue = { mode: 'liste' };
  }
  vider(conteneur);
  if (vue.mode === 'quiz') vueQuiz(conteneur, ctx, donnees);
  else if (vue.mode === 'resultat') vueResultat(conteneur, ctx, donnees);
  else vueListe(conteneur, ctx, donnees);
  // On remonte en haut seulement quand l'écran change (nouvelle question, résultat…).
  const cle = `${vue.mode}:${vue.index ?? ''}:${vue.qcmId ?? ''}`;
  if (cle !== ecranPrecedent && vue.mode !== 'liste') window.scrollTo(0, 0);
  ecranPrecedent = cle;
}

// Quand on quitte l'onglet, on referme un éventuel résultat affiché.
export function reinitialiserVueQcm() {
  if (vue.mode === 'resultat') vue = { mode: 'liste' };
}
