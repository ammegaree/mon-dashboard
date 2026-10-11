// Dates sous forme de texte « AAAA-MM-JJ » (heure locale), pour éviter tout décalage de fuseau.

const pad = (n) => String(n).padStart(2, '0');

export function versCle(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function depuisCle(cle) {
  const [a, m, j] = cle.split('-').map(Number);
  return new Date(a, m - 1, j);
}

export function aujourdhui() {
  return versCle(new Date());
}

export function ajouterJours(cle, n) {
  const d = depuisCle(cle);
  d.setDate(d.getDate() + n);
  return versCle(d);
}

// 0 = dimanche … 6 = samedi
export function jourSemaine(cle) {
  return depuisCle(cle).getDay();
}

export function jourDuMois(cle) {
  return depuisCle(cle).getDate();
}

export function joursDansLeMois(cle) {
  const d = depuisCle(cle);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

// Lundi de la semaine qui contient la date.
export function lundiDe(cle) {
  const dow = jourSemaine(cle);
  return ajouterJours(cle, dow === 0 ? -6 : 1 - dow);
}

function majuscule(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });

export function formatLong(cle) {
  return majuscule(fmtLong.format(depuisCle(cle)));
}

export function formatCourt(cle) {
  return fmtCourt.format(depuisCle(cle));
}

export function nomDuJour(cle) {
  return majuscule(fmtJour.format(depuisCle(cle)));
}

// « 5 – 11 octobre 2026 » ou « 28 septembre – 4 octobre 2026 ».
export function formatPlage(debut, fin) {
  const d = depuisCle(debut);
  const f = depuisCle(fin);
  const jour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' });
  const jourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
  const meme = d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear();
  const debutTexte = meme ? jour.format(d) : jourMois.format(d);
  return `${debutTexte} – ${jourMois.format(f)} ${f.getFullYear()}`;
}

export function premierDuMois(cle) {
  const d = depuisCle(cle);
  return versCle(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function dernierDuMois(cle) {
  const d = depuisCle(cle);
  return versCle(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Décale de n mois et rend le 1er du mois obtenu.
export function ajouterMois(cle, n) {
  const d = depuisCle(cle);
  return versCle(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

// Toutes les dates de debut à fin (comprises).
export function joursEntre(debut, fin) {
  const jours = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) jours.push(j);
  return jours;
}

const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
export function formatMois(cle) {
  return majuscule(fmtMois.format(depuisCle(cle)));
}

// « 5 oct. »
const fmtJourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export function formatJourMois(cle) {
  return fmtJourMois.format(depuisCle(cle));
}

// « lun. » → « Lun »
export function jourCourt(cle) {
  const texte = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(depuisCle(cle)).replace('.', '');
  return majuscule(texte);
}

// Lundi en premier, comme dans le calendrier français.
export const JOURS = [
  { dow: 1, court: 'L', long: 'lundi' },
  { dow: 2, court: 'M', long: 'mardi' },
  { dow: 3, court: 'M', long: 'mercredi' },
  { dow: 4, court: 'J', long: 'jeudi' },
  { dow: 5, court: 'V', long: 'vendredi' },
  { dow: 6, court: 'S', long: 'samedi' },
  { dow: 0, court: 'D', long: 'dimanche' },
];
