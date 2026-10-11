// Budget : mes revenus, mes charges fixes, mes enveloppes (courses, sorties…) et mes dépenses du mois.
//
// Rien de compliqué : « il te reste » = revenus − charges fixes − dépenses du mois.
// Les revenus et les charges fixes valent pour tous les mois ; seules les dépenses ont une date.
// Tout est en euros (au centime). Aucun numéro de compte ni de carte n'est jamais demandé.
// Ton : on montre où en est le mois, jamais de « dépassement » ni d'alerte rouge.
// Règles et calculs seulement (pas d'affichage).

import { nouvelId } from '../schema.js';
import { aujourdhui, joursDansLeMois, jourDuMois } from '../dates.js';
import { arrondir, lireMontant, moisDe, somme, texteCourt, dateValide } from './budget-montants.js';
import { epargneDuMois } from './epargne-donnees.js';
import { pretDuMois } from './pret-donnees.js';

const B = (d) => d.budget;

// Des idées pour démarrer (rien n'est ajouté sans que tu les coches).
export const IDEES_ENVELOPPES = [
  { nom: 'Courses', icone: '🛒' },
  { nom: 'Sorties', icone: '🍹' },
  { nom: 'Transport', icone: '🚌' },
  { nom: 'Loisirs', icone: '🎬' },
  { nom: 'Santé', icone: '💊' },
  { nom: 'Vêtements', icone: '👚' },
  { nom: 'Cadeaux', icone: '🎁' },
  { nom: 'Imprévus', icone: '🧯' },
];

export const IDEES_REVENUS = ['Bourse', 'Salaire', 'Aide de la famille', 'APL'];
export const IDEES_FIXES = ['Loyer', 'Électricité', 'Internet', 'Téléphone', 'Abonnements', 'Assurance', 'Transport (abonnement)'];

// ---- Montants et mois (voir budget-montants.js) ----

export { arrondir, lireMontant, formaterEuros, moisDe, moisValide, decalerMois } from './budget-montants.js';

// ---- Revenus et charges fixes ----

export function ajouterLigne(d, liste, { nom, montant }) {
  if (liste !== 'revenus' && liste !== 'fixes') return null;
  const m = lireMontant(montant);
  const n = texteCourt(nom);
  if (!n || m === null) return null;
  const ligne = { id: nouvelId(), nom: n, montant: m };
  B(d)[liste].push(ligne);
  return ligne;
}

export function modifierLigne(d, liste, id, { nom, montant }) {
  const ligne = (B(d)[liste] || []).find((x) => x.id === id);
  if (!ligne) return null;
  const m = lireMontant(montant);
  const n = texteCourt(nom);
  if (!n || m === null) return null;
  ligne.nom = n;
  ligne.montant = m;
  return ligne;
}

export function ligneParId(d, liste, id) {
  return (B(d)[liste] || []).find((x) => x.id === id) || null;
}

// ---- Enveloppes ----

export function posteParId(d, id) {
  return B(d).postes.find((p) => p.id === id) || null;
}

function plafondValide(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const m = lireMontant(v);
  return m && m > 0 ? m : null;
}

export function ajouterPoste(d, { nom, icone = '🧾', plafond = null }) {
  const n = texteCourt(nom, 60);
  if (!n) return null;
  const poste = { id: nouvelId(), nom: n, icone: texteCourt(icone, 8) || '🧾', plafond: plafondValide(plafond) };
  B(d).postes.push(poste);
  return poste;
}

export function modifierPoste(d, id, { nom, icone, plafond }) {
  const p = posteParId(d, id);
  const n = texteCourt(nom, 60);
  if (!p || !n) return null;
  p.nom = n;
  p.icone = texteCourt(icone, 8) || '🧾';
  p.plafond = plafondValide(plafond);
  return p;
}

// Ajoute les idées cochées (une enveloppe qui existe déjà n'est pas doublée). Rend le nombre ajouté.
export function ajouterIdeesEnveloppes(d, noms) {
  let n = 0;
  for (const nom of noms) {
    const idee = IDEES_ENVELOPPES.find((i) => i.nom === nom);
    if (!idee) continue;
    if (B(d).postes.some((p) => p.nom.toLowerCase() === idee.nom.toLowerCase())) continue;
    ajouterPoste(d, idee);
    n++;
  }
  return n;
}

// ---- Dépenses ----

export function depenseParId(d, id) {
  return B(d).depenses.find((x) => x.id === id) || null;
}

export function ajouterDepense(d, { montant, date, posteId = null, note = '' }) {
  const m = lireMontant(montant);
  if (m === null || m === 0) return null;
  const depense = {
    id: nouvelId(),
    date: dateValide(date) || aujourdhui(),
    montant: m,
    posteId: posteId && posteParId(d, posteId) ? posteId : null,
    note: texteCourt(note, 200),
    creeLe: new Date().toISOString(),
  };
  B(d).depenses.push(depense);
  return depense;
}

export function modifierDepense(d, id, { montant, date, posteId, note }) {
  const dep = depenseParId(d, id);
  const m = lireMontant(montant);
  if (!dep || m === null || m === 0) return null;
  dep.montant = m;
  dep.date = dateValide(date) || dep.date;
  dep.posteId = posteId && posteParId(d, posteId) ? posteId : null;
  dep.note = texteCourt(note, 200);
  return dep;
}

// Supprime un élément d'une des listes et rend de quoi le remettre (voir `restaurer`).
// Supprimer une enveloppe garde ses dépenses : elles passent simplement « sans enveloppe ».
export function supprimer(d, liste, id) {
  if (!['revenus', 'fixes', 'postes', 'depenses'].includes(liste)) return null;
  const l = B(d)[liste];
  const i = l.findIndex((x) => x.id === id);
  if (i === -1) return null;
  const [element] = l.splice(i, 1);
  const detaches = [];
  if (liste === 'postes') {
    for (const dep of B(d).depenses) {
      if (dep.posteId === id) {
        dep.posteId = null;
        detaches.push(dep.id);
      }
    }
  }
  return { liste, element, index: i, detaches };
}

export function restaurer(d, retire) {
  if (!retire) return;
  const l = B(d)[retire.liste];
  if (l.some((x) => x.id === retire.element.id)) return;
  l.splice(Math.min(retire.index, l.length), 0, retire.element);
  for (const id of retire.detaches || []) {
    const dep = depenseParId(d, id);
    if (dep) dep.posteId = retire.element.id;
  }
}

// Les dépenses d'un mois, les plus récentes d'abord. `posteId` : '' = toutes, 'aucune' = sans enveloppe.
export function depensesDuMois(d, mois, posteId = '') {
  return B(d)
    .depenses.filter((x) => moisDe(x.date) === mois)
    .filter((x) => {
      if (!posteId) return true;
      const rattachee = x.posteId && posteParId(d, x.posteId);
      return posteId === 'aucune' ? !rattachee : x.posteId === posteId;
    })
    .sort((a, b) => (a.date === b.date ? (a.creeLe < b.creeLe ? 1 : -1) : a.date < b.date ? 1 : -1));
}

// ---- Le point sur le mois ----

export function bilanDuMois(d, mois, jour = aujourdhui()) {
  const revenus = somme(B(d).revenus);
  const fixes = somme(B(d).fixes);
  const duMois = depensesDuMois(d, mois);
  const depenses = somme(duMois);
  // L'argent mis de côté et les mensualités de prêt notées ce mois-ci comptent aussi (voir Économies et Prêt).
  const epargne = epargneDuMois(d, mois);
  const pret = pretDuMois(d, mois);
  const disponible = arrondir(revenus - fixes);
  const reste = arrondir(disponible - depenses - pret - epargne);

  // « À peu près X € par jour » : seulement pour le mois en cours, et seulement s'il reste quelque chose.
  let parJour = null;
  if (mois === moisDe(jour) && reste > 0) {
    const joursRestants = joursDansLeMois(jour) - jourDuMois(jour) + 1;
    parJour = arrondir(reste / Math.max(1, joursRestants));
  }

  const enveloppes = B(d).postes.map((p) => {
    const depense = somme(duMois.filter((x) => x.posteId === p.id));
    const restePoste = p.plafond ? arrondir(p.plafond - depense) : null;
    return {
      poste: p,
      depense,
      plafond: p.plafond,
      reste: restePoste,
      ratio: p.plafond ? Math.min(1, depense / p.plafond) : 0,
      depasse: p.plafond ? depense > p.plafond : false,
    };
  });
  const sansEnveloppe = somme(duMois.filter((x) => !x.posteId || !posteParId(d, x.posteId)));
  const plafonds = somme(B(d).postes.filter((p) => p.plafond), 'plafond');

  return {
    revenus,
    fixes,
    depenses,
    epargne,
    pret,
    sorti: arrondir(fixes + depenses + pret),
    disponible,
    reste,
    parJour,
    enveloppes,
    sansEnveloppe,
    plafonds,
    aRepartir: arrondir(disponible - pret - plafonds),
    ratioUtilise: revenus > 0 ? Math.min(1, Math.max(0, fixes + depenses + pret + epargne) / revenus) : 0,
    nbDepenses: duMois.length,
  };
}

// Les 12 mois de l'année du mois donné, pour le petit graphique « mois par mois ».
// Un mois sans aucune dépense ni paiement (et qui n'est pas le mois en cours) reste vide : on n'invente rien.
export function serieAnnee(d, mois, jour = aujourdhui()) {
  const annee = mois.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => {
    const m = `${annee}-${String(i + 1).padStart(2, '0')}`;
    const b = bilanDuMois(d, m, jour);
    const actif = b.nbDepenses > 0 || b.pret > 0 || b.epargne !== 0 || m === moisDe(jour);
    return { mois: m, actif, revenus: b.revenus, sorti: actif ? b.sorti : 0, reste: b.reste };
  });
}
