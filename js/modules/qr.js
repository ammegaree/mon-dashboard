// Un générateur de QR code, sans aucune bibliothèque (le dashboard n'a aucune dépendance).
// Texte en octets (UTF-8), niveau de correction L ou M, versions 1 à 10 : largement assez pour une adresse web.
// Sert à afficher le QR code à scanner avec le téléphone (Réglages et fenêtre du Terminal).
// Aucun affichage ici : on rend une grille de modules (vrai = carré noir) et deux petites mises en forme.

// ---- Tables (ISO/IEC 18004), versions 1 à 10 ----

// Pour chaque version : [octets de correction par bloc, [nb blocs, octets de données par bloc], …]
const BLOCS = {
  L: [
    null,
    [7, [1, 19]],
    [10, [1, 34]],
    [15, [1, 55]],
    [20, [1, 80]],
    [26, [1, 108]],
    [18, [2, 68]],
    [20, [2, 78]],
    [24, [2, 97]],
    [30, [2, 116]],
    [18, [2, 68], [2, 69]],
  ],
  M: [
    null,
    [10, [1, 16]],
    [16, [1, 28]],
    [26, [1, 44]],
    [18, [2, 32]],
    [24, [2, 43]],
    [16, [4, 27]],
    [18, [4, 31]],
    [22, [2, 38], [2, 39]],
    [22, [3, 36], [2, 37]],
    [26, [4, 43], [1, 44]],
  ],
};

const POSITIONS_ALIGNEMENT = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const BITS_NIVEAU = { L: 1, M: 0 }; // pour l'information de format
const VERSION_MAX = 10;

// ---- Corps de Galois GF(256) et Reed-Solomon ----

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function multiplier(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function polynomeGenerateur(degre) {
  let p = [1];
  for (let i = 0; i < degre; i++) {
    const suivant = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      suivant[j] ^= p[j];
      suivant[j + 1] ^= multiplier(p[j], EXP[i]);
    }
    p = suivant;
  }
  return p;
}

function correction(donnees, nbCorrection) {
  const gen = polynomeGenerateur(nbCorrection);
  const reste = new Array(nbCorrection).fill(0);
  for (const octet of donnees) {
    const facteur = octet ^ reste.shift();
    reste.push(0);
    if (facteur !== 0) for (let i = 0; i < nbCorrection; i++) reste[i] ^= multiplier(gen[i + 1], facteur);
  }
  return reste;
}

// ---- Les données ----

function octets(texte) {
  return Array.from(new TextEncoder().encode(texte));
}

function capaciteDonnees(version, niveau) {
  const [, ...groupes] = BLOCS[niveau][version];
  return groupes.reduce((t, [n, d]) => t + n * d, 0);
}

function choisirVersion(nbOctets, niveau) {
  for (let v = 1; v <= VERSION_MAX; v++) {
    const bitsLongueur = v < 10 ? 8 : 16;
    if (4 + bitsLongueur + nbOctets * 8 <= capaciteDonnees(v, niveau) * 8) return v;
  }
  return null;
}

function flux(donnees, version, niveau) {
  const bits = [];
  const ajouter = (valeur, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valeur >>> i) & 1);
  };
  ajouter(0b0100, 4); // mode « octets »
  ajouter(donnees.length, version < 10 ? 8 : 16);
  for (const o of donnees) ajouter(o, 8);
  const capaciteBits = capaciteDonnees(version, niveau) * 8;
  ajouter(0, Math.min(4, capaciteBits - bits.length)); // terminateur
  while (bits.length % 8 !== 0) bits.push(0);
  const mots = [];
  for (let i = 0; i < bits.length; i += 8) mots.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0; mots.length < capaciteBits / 8; pad++) mots.push(pad % 2 === 0 ? 0xec : 0x11);
  return mots;
}

// Découpe en blocs, ajoute la correction, puis entrelace (données puis correction).
function entrelacer(mots, version, niveau) {
  const [nbCorr, ...groupes] = BLOCS[niveau][version];
  const blocs = [];
  let position = 0;
  for (const [n, d] of groupes) {
    for (let i = 0; i < n; i++) {
      const donnees = mots.slice(position, position + d);
      position += d;
      blocs.push({ donnees, correction: correction(donnees, nbCorr) });
    }
  }
  const sortie = [];
  const maxDonnees = Math.max(...blocs.map((b) => b.donnees.length));
  for (let i = 0; i < maxDonnees; i++) for (const b of blocs) if (i < b.donnees.length) sortie.push(b.donnees[i]);
  for (let i = 0; i < nbCorr; i++) for (const b of blocs) sortie.push(b.correction[i]);
  return sortie;
}

// ---- La grille ----

function creerGrille(taille) {
  return { taille, modules: Array.from({ length: taille }, () => new Array(taille).fill(false)), reserve: Array.from({ length: taille }, () => new Array(taille).fill(false)) };
}

function poser(g, x, y, noir, reserver = true) {
  if (x < 0 || y < 0 || x >= g.taille || y >= g.taille) return;
  g.modules[y][x] = noir;
  if (reserver) g.reserve[y][x] = true;
}

function motifRepere(g, cx, cy) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      poser(g, cx + dx, cy + dy, d !== 4 && d !== 2);
    }
  }
}

function motifAlignement(g, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poser(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
}

function dessinerFonctions(g, version) {
  const n = g.taille;
  motifRepere(g, 3, 3);
  motifRepere(g, n - 4, 3);
  motifRepere(g, 3, n - 4);
  for (let i = 8; i < n - 8; i++) {
    poser(g, i, 6, i % 2 === 0);
    poser(g, 6, i, i % 2 === 0);
  }
  const pos = POSITIONS_ALIGNEMENT[version];
  for (const cy of pos) {
    for (const cx of pos) {
      const surRepere = (cx === 6 && cy === 6) || (cx === 6 && cy === pos[pos.length - 1]) || (cx === pos[pos.length - 1] && cy === 6);
      if (!surRepere) motifAlignement(g, cx, cy);
    }
  }
  // Zones réservées pour l'information de format (remplies plus tard) et de version.
  for (let i = 0; i < 9; i++) {
    g.reserve[8][i] = true;
    g.reserve[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    g.reserve[8][n - 1 - i] = true;
    g.reserve[n - 1 - i][8] = true;
  }
  poser(g, 8, n - 8, true); // le module noir fixe
  if (version >= 7) {
    let reste = version;
    for (let i = 0; i < 12; i++) reste = (reste << 1) ^ ((reste >>> 11) * 0x1f25);
    const bits = (version << 12) | reste;
    for (let i = 0; i < 18; i++) {
      const noir = ((bits >>> i) & 1) === 1;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      poser(g, a, b, noir);
      poser(g, b, a, noir);
    }
  }
}

function placerDonnees(g, mots) {
  const bits = [];
  for (const o of mots) for (let i = 7; i >= 0; i--) bits.push((o >>> i) & 1);
  const n = g.taille;
  let k = 0;
  let montant = true;
  for (let colonne = n - 1; colonne >= 1; colonne -= 2) {
    if (colonne === 6) colonne--; // la colonne du motif de synchronisation est sautée
    for (let l = 0; l < n; l++) {
      const y = montant ? n - 1 - l : l;
      for (const x of [colonne, colonne - 1]) {
        if (g.reserve[y][x]) continue;
        g.modules[y][x] = k < bits.length ? bits[k] === 1 : false;
        k++;
      }
    }
    montant = !montant;
  }
}

const MASQUES = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function appliquerMasque(g, numero) {
  const n = g.taille;
  const copie = g.modules.map((l) => l.slice());
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!g.reserve[y][x] && MASQUES[numero](x, y)) copie[y][x] = !copie[y][x];
  return copie;
}

function ecrireFormat(modules, n, niveau, masque) {
  const donnees = (BITS_NIVEAU[niveau] << 3) | masque;
  let reste = donnees;
  for (let i = 0; i < 10; i++) reste = (reste << 1) ^ ((reste >>> 9) * 0x537);
  const bits = ((donnees << 10) | reste) ^ 0x5412;
  const bit = (i) => ((bits >>> i) & 1) === 1;
  // Première copie, autour du repère en haut à gauche.
  for (let i = 0; i <= 5; i++) modules[i][8] = bit(i);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8][14 - i] = bit(i);
  // Seconde copie, le long des deux autres repères.
  for (let i = 0; i < 8; i++) modules[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) modules[n - 15 + i][8] = bit(i);
  modules[n - 8][8] = true;
}

// Les pénalités de la norme (quatre règles) : on garde le masque le moins « chargé ».
function penalite(m) {
  const n = m.length;
  let score = 0;
  for (let y = 0; y < n; y++) {
    for (const ligne of [m[y], m.map((l) => l[y])]) {
      let serie = 1;
      for (let i = 1; i < n; i++) {
        if (ligne[i] === ligne[i - 1]) serie++;
        else {
          if (serie >= 5) score += 3 + (serie - 5);
          serie = 1;
        }
      }
      if (serie >= 5) score += 3 + (serie - 5);
      const motif = [true, false, true, true, true, false, true];
      for (let i = 0; i + 11 <= n; i++) {
        const dedans = motif.every((v, k) => ligne[i + k] === v);
        if (!dedans) continue;
        const avant = [0, 1, 2, 3].every((k) => i - 1 - k >= 0 && !ligne[i - 1 - k]) || i === 0;
        const apres = [0, 1, 2, 3].every((k) => i + 7 + k < n && !ligne[i + 7 + k]) || i + 7 >= n;
        if (avant && i - 4 >= 0) score += 40;
        else if (apres && i + 11 <= n) score += 40;
      }
    }
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
  const noirs = m.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((noirs * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

// ---- L'interface ----

// Rend { version, taille, modules } où modules[y][x] vaut vrai pour un carré noir. Lève une erreur si le texte est trop long.
export function genererQr(texte, { niveau = 'M' } = {}) {
  if (!BLOCS[niveau]) throw new Error('Niveau de correction inconnu.');
  const donnees = octets(String(texte));
  const version = choisirVersion(donnees.length, niveau);
  if (!version) throw new Error('Texte trop long pour ce QR code.');
  const taille = 17 + 4 * version;
  const g = creerGrille(taille);
  dessinerFonctions(g, version);
  placerDonnees(g, entrelacer(flux(donnees, version, niveau), version, niveau));

  let meilleur = null;
  for (let masque = 0; masque < 8; masque++) {
    const modules = appliquerMasque(g, masque);
    ecrireFormat(modules, taille, niveau, masque);
    const score = penalite(modules);
    if (!meilleur || score < meilleur.score) meilleur = { score, modules, masque };
  }
  return { version, taille, masque: meilleur.masque, modules: meilleur.modules };
}

// Une image vectorielle (SVG) : noir sur blanc, avec la marge blanche de 4 modules exigée par les lecteurs.
export function qrEnSvg(qr, { pixel = 6, marge = 4 } = {}) {
  const total = (qr.taille + marge * 2) * pixel;
  let chemin = '';
  for (let y = 0; y < qr.taille; y++) {
    for (let x = 0; x < qr.taille; x++) {
      if (qr.modules[y][x]) chemin += `M${(x + marge) * pixel} ${(y + marge) * pixel}h${pixel}v${pixel}h-${pixel}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${total}" height="${total}" fill="#fff"/><path d="${chemin}" fill="#000"/></svg>`;
}

// Pour le Terminal : deux lignes de modules par ligne de texte, fond blanc et encre noire
// (quel que soit le thème du Terminal, le QR code reste lisible).
export function qrEnTexte(qr, { marge = 4 } = {}) {
  const n = qr.taille;
  const noir = (x, y) => x >= 0 && y >= 0 && x < n && y < n && qr.modules[y][x];
  const lignes = [];
  for (let y = -marge; y < n + marge; y += 2) {
    let ligne = '';
    for (let x = -marge; x < n + marge; x++) {
      const haut = noir(x, y);
      const bas = noir(x, y + 1);
      ligne += haut && bas ? '█' : haut ? '▀' : bas ? '▄' : ' ';
    }
    lignes.push(`\u001b[47;30m${ligne}\u001b[0m`);
  }
  return lignes.join('\n');
}
