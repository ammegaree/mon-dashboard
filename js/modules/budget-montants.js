// Budget : les petits outils communs (montants en euros, mois « AAAA-MM »).
// Aucun affichage ici : seulement des règles de calcul.

// ---- Montants ----

export function arrondir(x) {
  return Math.round((Number(x) + Number.EPSILON) * 100) / 100;
}

// « 12,50 », « 12.5 », « 12 € » → 12.5 ; rend null si ce n'est pas un montant valable (négatif, vide, texte…).
export function lireMontant(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v <= 10_000_000 ? arrondir(v) : null;
  const texte = String(v ?? '')
    .replace(/[\s  €]/g, '')
    .replace(',', '.');
  if (!/^\d*\.?\d*$/.test(texte) || texte === '' || texte === '.') return null;
  return lireMontant(Number(texte));
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eurosRonds = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// « 1 234,50 € » ; sans les centimes quand c'est un compte rond.
export function formaterEuros(n) {
  const x = arrondir(n || 0);
  return Number.isInteger(x) ? eurosRonds.format(x) : euros.format(x);
}

export function somme(liste, champ = 'montant') {
  return arrondir(liste.reduce((t, x) => t + Math.round(Number(x[champ] || 0) * 100), 0) / 100);
}

// ---- Mois ----
// Un mois s'écrit « AAAA-MM ».

export function moisDe(date) {
  return String(date).slice(0, 7);
}

export function moisValide(v) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''));
}

export function decalerMois(mois, n) {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}


export function texteCourt(v, max = 80) {
  return String(v ?? '').trim().slice(0, max);
}

// Un taux annuel en % : « 1,5 » → 1.5 ; vide → 0 ; rend null si ce n'est pas un taux plausible.
export function lireTaux(v) {
  if (v === null || v === undefined || String(v).trim() === '') return 0;
  const t = String(v).replace(/[\s%]/g, '').replace(',', '.');
  if (!/^\d*\.?\d*$/.test(t) || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= 100 ? Math.round(n * 100) / 100 : null;
}

export function dateValide(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null;
}
