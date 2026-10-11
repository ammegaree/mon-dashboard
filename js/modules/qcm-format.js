// Format des fichiers de QCM + validation + correction + prompt pour Claude.
//
// Ce fichier est volontairement indépendant de l'affichage : le jour où les QCM
// seront générés directement dans le dashboard depuis un PDF, le générateur n'aura
// qu'à produire un objet de ce format et à le passer à `validerQcm`.

export const FORMAT = 'qcm-v1';
export const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const MAX_QUESTIONS = 500;

const PREFIXE_LETTRE = /^\s*[A-Ha-h]\s*[).:\-]\s+/;

function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

// Valide un objet JSON déjà lu. Rend soit { qcm }, soit { erreurs } (en français),
// plus des avertissements qui n'empêchent pas l'import.
export function validerQcm(brut) {
  const erreurs = [];
  const avertissements = [];

  let source = brut;
  if (Array.isArray(source)) source = { questions: source };
  if (!source || typeof source !== 'object') {
    return { erreurs: ['Le fichier doit contenir un objet JSON avec une liste « questions ».'], avertissements };
  }
  if (!Array.isArray(source.questions) || source.questions.length === 0) {
    return { erreurs: ['Il manque la liste « questions » (ou elle est vide).'], avertissements };
  }
  if (source.questions.length > MAX_QUESTIONS) {
    return { erreurs: [`Trop de questions (${source.questions.length}) : ${MAX_QUESTIONS} au maximum.`], avertissements };
  }
  if (source.format && source.format !== FORMAT) {
    avertissements.push(`Format « ${source.format} » inattendu (attendu : « ${FORMAT} ») : j'essaie quand même.`);
  }

  const titre = texte(source.titre);
  if (!titre) avertissements.push('Le QCM n\'a pas de titre : « QCM sans titre » sera utilisé.');

  const idsVus = new Set();
  const questions = [];
  const multiplesIgnorees = [];
  let sansExplication = 0;

  source.questions.forEach((q, index) => {
    const num = index + 1;
    const problemes = [];
    if (!q || typeof q !== 'object') {
      erreurs.push(`Question ${num} : ce n'est pas un objet.`);
      return;
    }

    const enonce = texte(q.question);
    if (!enonce) problemes.push('l\'énoncé (« question ») est vide');

    let choix = Array.isArray(q.choix) ? q.choix.map(texte) : [];
    if (choix.length < 2) problemes.push('il faut au moins 2 « choix »');
    else if (choix.length > LETTRES.length) problemes.push(`au plus ${LETTRES.length} « choix »`);
    else if (choix.some((c) => !c)) problemes.push('un des choix est vide');
    // « A) Texte » → « Texte » (si tous les choix portent un préfixe).
    if (choix.length >= 2 && choix.every((c) => PREFIXE_LETTRE.test(c))) {
      choix = choix.map((c) => c.replace(PREFIXE_LETTRE, '').trim());
    }

    // Une seule bonne réponse : « bonne_reponse: "B" » (ou l'ancienne forme « bonnes_reponses: ["B"] »).
    let lettres = q.bonne_reponse ?? q.bonnes_reponses ?? q.reponses ?? q.reponse;
    if (typeof lettres === 'string') lettres = [lettres];
    const bonnes = [];
    if (!Array.isArray(lettres) || lettres.length === 0) {
      problemes.push('« bonne_reponse » est vide ou absente');
    } else {
      for (const l of lettres) {
        const i = LETTRES.indexOf(texte(String(l)).toUpperCase());
        if (i === -1 || i >= choix.length) problemes.push(`la bonne réponse « ${l} » ne correspond à aucun choix`);
        else if (!bonnes.includes(i)) bonnes.push(i);
      }
    }

    if (problemes.length) {
      erreurs.push(`Question ${num} : ${problemes.join(' ; ')}.`);
      return;
    }

    // Le dashboard ne propose que des questions à choix unique.
    if (bonnes.length > 1) {
      multiplesIgnorees.push(num);
      return;
    }

    let id = texte(String(q.id ?? '')) || `q${num}`;
    if (idsVus.has(id)) id = `q${num}`;
    idsVus.add(id);

    const explication = texte(q.explication);
    if (!explication) sansExplication++;

    const reference = texte(q.reference ?? q.source);

    questions.push({ id, type: 'unique', question: enonce, choix, bonnes, explication, reference });
  });

  if (multiplesIgnorees.length) {
    avertissements.push(
      `${multiplesIgnorees.length} question(s) à plusieurs bonnes réponses ignorée(s), car seuls les choix uniques sont acceptés (question${multiplesIgnorees.length > 1 ? 's' : ''} ${multiplesIgnorees.join(', ')}).`
    );
  }
  if (!erreurs.length && questions.length === 0) {
    erreurs.push('Aucune question à choix unique dans ce fichier.');
  }
  if (sansExplication > 0) {
    avertissements.push(`${sansExplication} question(s) sans explication : la correction n'aura rien à afficher pour elles.`);
  }
  if (erreurs.length) return { erreurs, avertissements };

  return {
    qcm: { titre: titre || 'QCM sans titre', description: texte(source.description), questions },
    avertissements,
    erreurs: [],
  };
}

// Lit du texte JSON (fichier ou collé). Tolère un bloc de code ```json ... ``` autour.
export function lireJsonQcm(texteBrut) {
  let t = String(texteBrut ?? '').trim().replace(/^﻿/, '');
  const bloc = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloc) t = bloc[1].trim();
  if (!t) return { erreurs: ['Le texte est vide.'], avertissements: [] };
  let brut;
  try {
    brut = JSON.parse(t);
  } catch (e) {
    return {
      erreurs: [`Ce texte n'est pas du JSON valide (${e.message}). Vérifie qu'il n'y a pas de texte avant ou après, ni de virgule en trop.`],
      avertissements: [],
    };
  }
  return validerQcm(brut);
}

// ---- Correction ----

// Juste = exactement les bonnes réponses, ni plus ni moins.
export function estJuste(question, choisis) {
  const a = [...new Set(choisis)].sort((x, y) => x - y);
  const b = [...question.bonnes].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---- Prompt à donner à Claude avec le PDF du cours ----

export const PROMPT_CLAUDE = `Tu es formateur·rice en accompagnement à la naissance (doula). À partir du document PDF joint (un chapitre de mon cours), crée un QCM d'entraînement qui m'aide à retenir l'essentiel.

CONSIGNES
- Nombre de questions : 15 (entre 10 et 25 selon la richesse du chapitre).
- Base-toi uniquement sur le contenu du document. N'invente rien qui n'y figure pas.
- Uniquement des questions à CHOIX UNIQUE : 4 choix, avec exactement UNE bonne réponse. Pas de question à réponses multiples.
- Varie les niveaux : définitions et faits, compréhension, mises en situation concrètes.
- Les mauvais choix doivent être plausibles (jamais absurdes) et de longueur comparable à la bonne réponse.
- Répartis les bonnes réponses sur toutes les lettres (pas toujours B ou C).
- Écris en français.

EXPLICATION (très important)
Chaque question a une explication de 2 à 4 phrases qui REPREND LE COURS : cite ou reformule fidèlement le passage du document qui justifie la bonne réponse (« D'après le cours : … »), puis, si utile, explique en une phrase pourquoi l'erreur la plus courante est fausse. L'explication doit se lire aussi bien quand on a trouvé la bonne réponse que quand on s'est trompée : ton bienveillant, sans jugement. Ajoute dans "reference" l'endroit du cours où retrouver ce passage (titre de section ou page), si tu peux l'identifier.

FORMAT DE SORTIE (très important)
Réponds uniquement avec un objet JSON valide, sans texte avant ni après, dans un seul bloc de code, exactement dans ce format :

{
  "format": "${FORMAT}",
  "titre": "Titre du QCM (ex. Module 2 – Chapitre 3 : le déroulement de l'accouchement)",
  "questions": [
    {
      "question": "Texte de la question ?",
      "choix": ["Texte du choix A", "Texte du choix B", "Texte du choix C", "Texte du choix D"],
      "bonne_reponse": "B",
      "explication": "D'après le cours : … (reprise du passage qui justifie la réponse).",
      "reference": "Section ou page du cours (facultatif)"
    }
  ]
}

Règles du format :
- "choix" : liste de 2 à 8 textes, SANS préfixe « A) » ou « B. » : la lettre est attribuée dans l'ordre (le 1er choix est A, le 2e est B, etc.).
- "bonne_reponse" : UNE seule lettre.
- JSON strict : guillemets droits ("), pas de virgule après le dernier élément, pas de commentaire, pas de retour à la ligne à l'intérieur d'un texte.`;
