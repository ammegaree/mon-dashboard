// Chiffrement des données avant leur envoi dans le dépôt privé (AES-GCM 256 bits, clé dérivée d'un mot de passe).
//
// Ce qui part sur GitHub est illisible sans le mot de passe de chiffrement : même GitHub ne peut pas le lire.
// Le mot de passe n'est jamais envoyé nulle part ; la clé qui en découle reste dans l'appareil.
// Règles seulement (pas d'affichage). Utilise l'API de chiffrement du navigateur (et de Node, pour les tests).

export const ITERATIONS_PAR_DEFAUT = 600000;
export const FORMAT_CHIFFRE = 'mon-dashboard-chiffre';

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

function sous() {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Le chiffrement n’est pas disponible dans ce navigateur.');
  return s;
}

export function enBase64(octets) {
  let texte = '';
  const morceau = 0x8000;
  for (let i = 0; i < octets.length; i += morceau) texte += String.fromCharCode(...octets.subarray(i, i + morceau));
  return btoa(texte);
}

export function deBase64(texte) {
  const brut = atob(String(texte).replace(/\s+/g, ''));
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

export function nouveauSel() {
  return enBase64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

// Le mot de passe + le sel donnent 32 octets (la clé). Rendus en base 64 pour être gardés dans l'appareil.
export async function deriverCle(motDePasse, selBase64, iterations = ITERATIONS_PAR_DEFAUT) {
  const matiere = await sous().importKey('raw', encodeur.encode(String(motDePasse)), 'PBKDF2', false, ['deriveBits']);
  const bits = await sous().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deBase64(selBase64), iterations }, matiere, 256);
  return enBase64(new Uint8Array(bits));
}

async function importerCle(cleBase64) {
  return sous().importKey('raw', deBase64(cleBase64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// Chiffre un objet : rend une « enveloppe » (du JSON ordinaire, avec le sel et les paramètres pour la relire).
export async function chiffrer(cleBase64, objet, { sel, iterations = ITERATIONS_PAR_DEFAUT, appareil = '' } = {}) {
  const cle = await importerCle(cleBase64);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const clair = encodeur.encode(JSON.stringify(objet));
  const chiffre = new Uint8Array(await sous().encrypt({ name: 'AES-GCM', iv }, cle, clair));
  return {
    format: FORMAT_CHIFFRE,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations,
    sel,
    iv: enBase64(iv),
    donnees: enBase64(chiffre),
    majLe: new Date().toISOString(),
    appareil,
  };
}

// Lit une enveloppe. Lève une erreur de code « mot-de-passe » si la clé ne convient pas (ou si le fichier est abîmé).
export async function dechiffrer(cleBase64, enveloppe) {
  if (!enveloppe || enveloppe.format !== FORMAT_CHIFFRE || !enveloppe.iv || !enveloppe.donnees) {
    const e = new Error('Ce fichier n’est pas un fichier chiffré du dashboard.');
    e.code = 'format';
    throw e;
  }
  const cle = await importerCle(cleBase64);
  try {
    const clair = await sous().decrypt({ name: 'AES-GCM', iv: deBase64(enveloppe.iv) }, cle, deBase64(enveloppe.donnees));
    return JSON.parse(decodeur.decode(clair));
  } catch {
    const e = new Error('Mot de passe incorrect, ou fichier abîmé.');
    e.code = 'mot-de-passe';
    throw e;
  }
}
