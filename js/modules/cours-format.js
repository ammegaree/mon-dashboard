// Le cours que j'écris pour un chapitre : une mise en forme très simple, sans rien à apprendre
// (des boutons font le travail), et lisible même en texte brut.
//
//   # Un titre            ## Un sous-titre
//   - une puce            1. une liste numérotée
//   > à retenir           **gras**   ==surligné==   https://un-lien
//
// Règles seulement (pas d'affichage) : l'écran est dans etudes-cours.js.

// ---- Lire : du texte vers des blocs ----

// Découpe une ligne en morceaux : { t: 'texte' | 'gras' | 'surligne' | 'lien', v }
export function analyserLigne(ligne) {
  const morceaux = [];
  const re = /\*\*(.+?)\*\*|==(.+?)==|(https?:\/\/[^\s<>"]+)/g;
  let dernier = 0;
  let m;
  while ((m = re.exec(ligne)) !== null) {
    if (m.index > dernier) morceaux.push({ t: 'texte', v: ligne.slice(dernier, m.index) });
    if (m[1] !== undefined) morceaux.push({ t: 'gras', v: m[1] });
    else if (m[2] !== undefined) morceaux.push({ t: 'surligne', v: m[2] });
    else {
      // La ponctuation qui termine une phrase ne fait pas partie du lien.
      const brut = m[3];
      const url = brut.replace(/[.,;:!?)\]»]+$/, '');
      morceaux.push({ t: 'lien', v: url });
      if (url.length < brut.length) morceaux.push({ t: 'texte', v: brut.slice(url.length) });
    }
    dernier = m.index + m[0].length;
  }
  if (dernier < ligne.length) morceaux.push({ t: 'texte', v: ligne.slice(dernier) });
  // Deux morceaux de texte qui se suivent n'en font qu'un.
  return morceaux.reduce((acc, x) => {
    const dernierMorceau = acc[acc.length - 1];
    if (dernierMorceau && dernierMorceau.t === 'texte' && x.t === 'texte') dernierMorceau.v += x.v;
    else acc.push(x);
    return acc;
  }, []);
}

// Le texte du cours → une liste de blocs :
//   { type: 'titre' | 'sous-titre' | 'retenir' | 'paragraphe', morceaux }
//   { type: 'liste', ordonnee, items: [morceaux] }
export function analyserCours(texte) {
  const blocs = [];
  const lignes = String(texte ?? '').replace(/\r\n?/g, '\n').split('\n');
  for (const brute of lignes) {
    const ligne = brute.replace(/\s+$/, '');
    if (!ligne.trim()) continue;
    let m;
    if ((m = /^##\s+(.*)$/.exec(ligne))) blocs.push({ type: 'sous-titre', morceaux: analyserLigne(m[1]) });
    else if ((m = /^#\s+(.*)$/.exec(ligne))) blocs.push({ type: 'titre', morceaux: analyserLigne(m[1]) });
    else if ((m = /^>\s?(.*)$/.exec(ligne))) blocs.push({ type: 'retenir', morceaux: analyserLigne(m[1]) });
    else if ((m = /^\s*[-•*]\s+(.*)$/.exec(ligne)) || (m = /^\s*\d+[.)]\s+(.*)$/.exec(ligne))) {
      const ordonnee = /^\s*\d+[.)]\s/.test(ligne);
      const dernier = blocs[blocs.length - 1];
      if (dernier && dernier.type === 'liste' && dernier.ordonnee === ordonnee) dernier.items.push(analyserLigne(m[1]));
      else blocs.push({ type: 'liste', ordonnee, items: [analyserLigne(m[1])] });
    } else blocs.push({ type: 'paragraphe', morceaux: analyserLigne(ligne.trim()) });
  }
  return blocs;
}

// Combien de mots (approximatif, pour le petit compteur).
export function compterMots(texte) {
  return (String(texte ?? '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
}

// ---- Écrire : les boutons de mise en forme ----

export const FORMATS = [
  { id: 'titre', libelle: 'Titre', prefixe: '# ' },
  { id: 'sous-titre', libelle: 'Sous-titre', prefixe: '## ' },
  { id: 'puce', libelle: '• Liste', prefixe: '- ' },
  { id: 'numero', libelle: '1. Liste', prefixe: '1. ' },
  { id: 'retenir', libelle: '💡 À retenir', prefixe: '> ' },
  { id: 'gras', libelle: 'Gras', marque: '**' },
  { id: 'surligne', libelle: 'Surligner', marque: '==' },
];

const PREFIXES = [/^##\s+/, /^#\s+/, /^>\s?/, /^\s*[-•*]\s+/, /^\s*\d+[.)]\s+/];

function sansPrefixe(ligne) {
  for (const re of PREFIXES) {
    if (re.test(ligne)) return ligne.replace(re, '');
  }
  return ligne;
}

// Applique une mise en forme à la sélection [debut, fin] du texte.
// Rend { texte, debut, fin } : le nouveau texte et la nouvelle sélection.
export function appliquerFormat(texte, debut, fin, formatId) {
  const format = FORMATS.find((f) => f.id === formatId);
  if (!format) return { texte, debut, fin };
  texte = String(texte);
  debut = Math.max(0, Math.min(debut, texte.length));
  fin = Math.max(debut, Math.min(fin, texte.length));

  // Gras, surligné : on entoure la sélection (ou on la désentoure si elle l'est déjà).
  if (format.marque) {
    const m = format.marque;
    const avant = texte.slice(Math.max(0, debut - m.length), debut);
    const apres = texte.slice(fin, fin + m.length);
    if (debut !== fin && avant === m && apres === m) {
      return { texte: texte.slice(0, debut - m.length) + texte.slice(debut, fin) + texte.slice(fin + m.length), debut: debut - m.length, fin: fin - m.length };
    }
    const choisi = texte.slice(debut, fin);
    const nouveau = texte.slice(0, debut) + m + choisi + m + texte.slice(fin);
    return { texte: nouveau, debut: debut + m.length, fin: fin + m.length };
  }

  // Titre, liste… : on travaille sur les lignes touchées par la sélection.
  const debutLigne = texte.lastIndexOf('\n', debut - 1) + 1;
  let finLigne = texte.indexOf('\n', fin);
  if (finLigne === -1) finLigne = texte.length;
  const lignes = texte.slice(debutLigne, finLigne).split('\n');

  const dejaLa = (l) => l.trim() !== '' && (format.id === 'numero' ? /^\s*\d+[.)]\s+/.test(l) : l.startsWith(format.prefixe));
  const toutesMarquees = lignes.filter((l) => l.trim() !== '').length > 0 && lignes.filter((l) => l.trim() !== '').every(dejaLa);

  let n = 0;
  const nouvelles = lignes.map((l) => {
    if (l.trim() === '' && lignes.length > 1) return l;
    const nue = sansPrefixe(l);
    if (toutesMarquees) return nue;
    n += 1;
    return (format.id === 'numero' ? `${n}. ` : format.prefixe) + nue;
  });
  const bloc = nouvelles.join('\n');
  return {
    texte: texte.slice(0, debutLigne) + bloc + texte.slice(finLigne),
    debut: debutLigne,
    fin: debutLigne + bloc.length,
  };
}

// Touche Entrée dans une liste : la ligne suivante reprend la puce (ou le numéro suivant) ;
// sur une puce vide, Entrée termine la liste. Rend { texte, curseur } ou null (comportement normal).
export function continuerListe(texte, curseur) {
  texte = String(texte);
  const debutLigne = texte.lastIndexOf('\n', curseur - 1) + 1;
  let finLigne = texte.indexOf('\n', curseur);
  if (finLigne === -1) finLigne = texte.length;
  const ligne = texte.slice(debutLigne, finLigne);

  const m = /^(\s*)([-•*]|\d+[.)])\s+(.*)$/.exec(ligne);
  if (!m) return null;
  const marque = m[2];
  const prefixeLongueur = ligne.length - m[3].length;
  if (curseur - debutLigne < prefixeLongueur) return null; // le curseur est devant la puce

  if (m[3].trim() === '') {
    // Puce vide : on la retire, la liste est finie.
    return { texte: texte.slice(0, debutLigne) + texte.slice(finLigne), curseur: debutLigne };
  }
  const suivante = /^\d/.test(marque) ? `${parseInt(marque, 10) + 1}${marque.slice(String(parseInt(marque, 10)).length)}` : marque;
  const ajout = `\n${m[1]}${suivante} `;
  return { texte: texte.slice(0, curseur) + ajout + texte.slice(curseur), curseur: curseur + ajout.length };
}
