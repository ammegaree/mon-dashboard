// Lire et écrire UN fichier dans un dépôt GitHub (privé), avec un code d'accès limité à ce dépôt.
// Ce fichier ne contient que des données chiffrées (voir chiffrement.js).
// Règles seulement (pas d'affichage). `fetchImpl` : pour les tests.

export class ErreurDepot extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'hors-ligne' | 'jeton' | 'introuvable' | 'conflit' | 'limite' | 'autre'
  }
}

// (Pour les essais seulement : une adresse de remplacement peut être posée dans `globalThis.__apiGithub`.)
const API_PAR_DEFAUT = 'https://api.github.com';
const adresseApi = () => globalThis.__apiGithub || API_PAR_DEFAUT;

export function depotValide(depot) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(depot || '').trim());
}

function entetes(jeton) {
  return { Authorization: `Bearer ${jeton}`, Accept: 'application/vnd.github+json' };
}

async function appeler(fetchImpl, url, options) {
  let reponse;
  try {
    reponse = await fetchImpl(url, { cache: 'no-store', ...options });
  } catch {
    throw new ErreurDepot('hors-ligne', 'Pas de connexion à internet.');
  }
  return reponse;
}

function erreurDeStatut(statut) {
  if (statut === 401) return new ErreurDepot('jeton', 'Le code d’accès GitHub n’est plus valable (expiré ou refusé).');
  if (statut === 403) return new ErreurDepot('jeton', 'GitHub refuse l’accès : vérifie les droits du code d’accès sur ce dépôt.');
  if (statut === 404) return new ErreurDepot('introuvable', 'Dépôt introuvable : vérifie son nom et que le code d’accès le concerne.');
  if (statut === 409 || statut === 422) return new ErreurDepot('conflit', 'Le fichier a changé entre-temps.');
  if (statut === 429) return new ErreurDepot('limite', 'Trop de demandes à GitHub : nouvel essai bientôt.');
  return new ErreurDepot('autre', `GitHub a répondu une erreur (${statut}).`);
}

function texteDeBase64(b64) {
  const brut = atob(String(b64).replace(/\s+/g, ''));
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return new TextDecoder().decode(octets);
}

function base64DeTexte(texte) {
  const octets = new TextEncoder().encode(texte);
  let brut = '';
  for (let i = 0; i < octets.length; i += 0x8000) brut += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(brut);
}

// Vérifie le dépôt et le code d'accès (sans rien lire d'autre). Rend { prive }.
export async function verifierDepot({ depot, jeton, fetchImpl = fetch }) {
  const r = await appeler(fetchImpl, `${adresseApi()}/repos/${depot}`, { headers: entetes(jeton) });
  if (!r.ok) throw erreurDeStatut(r.status);
  const infos = await r.json();
  return { prive: Boolean(infos.private) };
}

// Rend null si le fichier n'existe pas encore, sinon { sha, texte }.
export async function lireFichier({ depot, jeton, chemin, fetchImpl = fetch }) {
  const r = await appeler(fetchImpl, `${adresseApi()}/repos/${depot}/contents/${encodeURI(chemin)}`, { headers: entetes(jeton) });
  if (r.status === 404) {
    // GitHub répond 404 aussi bien pour un fichier pas encore créé que pour un dépôt introuvable : on regarde le dépôt.
    const verif = await appeler(fetchImpl, `${adresseApi()}/repos/${depot}`, { headers: entetes(jeton) });
    if (verif.ok) return null;
    throw erreurDeStatut(verif.status);
  }
  if (!r.ok) throw erreurDeStatut(r.status);
  const infos = await r.json();
  if (Array.isArray(infos) || infos.type !== 'file') throw new ErreurDepot('autre', 'Le chemin du fichier est un dossier.');
  if (infos.content) return { sha: infos.sha, texte: texteDeBase64(infos.content) };
  // Fichier de plus de 1 Mo : le contenu n'est pas dans la réponse, on passe par le blob.
  const blob = await appeler(fetchImpl, `${adresseApi()}/repos/${depot}/git/blobs/${infos.sha}`, { headers: entetes(jeton) });
  if (!blob.ok) throw erreurDeStatut(blob.status);
  const b = await blob.json();
  return { sha: infos.sha, texte: texteDeBase64(b.content) };
}

// Écrit (ou crée) le fichier. `sha` : celui de la version qu'on remplace (absent pour une création).
export async function ecrireFichier({ depot, jeton, chemin, texte, sha = null, message = 'Synchronisation', fetchImpl = fetch }) {
  const corps = { message, content: base64DeTexte(texte) };
  if (sha) corps.sha = sha;
  const r = await appeler(fetchImpl, `${adresseApi()}/repos/${depot}/contents/${encodeURI(chemin)}`, {
    method: 'PUT',
    headers: { ...entetes(jeton), 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw erreurDeStatut(r.status);
  const infos = await r.json();
  return { sha: infos.content?.sha || null };
}
