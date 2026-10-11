// Recherche rapide : retrouver n'importe quoi (tâche, rendez-vous, fiche, recette, envie…) en tapant quelques lettres.
//
// Insensible aux majuscules et aux accents (« ete » trouve « été »). Plusieurs mots : tous doivent être présents.
// Un titre qui correspond passe avant un texte qui correspond seulement dans les détails.
// Règles et calculs seulement (pas d'affichage) : la fenêtre est dans recherche.js.

import { PAGES } from '../registry.js';
import { formatCourt } from '../dates.js';
import { formaterEuros } from './budget-montants.js';
import { toutesLesCategories } from './agenda-donnees.js';

// « Éléphant » → « elephant »
export function normaliser(texte) {
  return String(texte ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, ' ')
    .trim();
}

export function termes(requete) {
  return normaliser(requete)
    .split(' ')
    .filter((t) => t.length > 0);
}

// Tous les textes d'un objet (champs texte et listes de textes), sauf ceux qu'on exclut.
function textesDe(objet, exclure = []) {
  const sortie = [];
  for (const [cle, v] of Object.entries(objet || {})) {
    if (exclure.includes(cle) || cle === 'id' || cle === 'creeLe' || cle === 'modifieLe') continue;
    if (typeof v === 'string' && v.trim()) sortie.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && x.trim()) sortie.push(x);
  }
  return sortie;
}

// Un petit morceau de texte autour de la première correspondance.
export function extrait(texte, requeteTermes, longueur = 70) {
  const brut = String(texte ?? '').replace(/\s+/g, ' ').trim();
  if (!brut) return '';
  const norm = normaliser(brut);
  // normaliser() peut changer la longueur (œ → oe) : on cherche sur le texte sans accents, position approchée.
  let position = -1;
  for (const t of requeteTermes) {
    const i = norm.indexOf(t);
    if (i !== -1 && (position === -1 || i < position)) position = i;
  }
  if (position === -1 || brut.length <= longueur) return brut.length > longueur ? `${brut.slice(0, longueur)}…` : brut;
  const debut = Math.max(0, position - 20);
  return `${debut > 0 ? '…' : ''}${brut.slice(debut, debut + longueur)}${debut + longueur < brut.length ? '…' : ''}`;
}

// ---- Les sources ----
// Chaque source rend des éléments { id, titre, details: [textes], sous?, date?, categorieId? }.

const nomCat = (d, id) => toutesLesCategories(d).find((c) => c.id === id)?.nom || '';

const SOURCES = [
  {
    type: 'tache',
    groupe: 'Tâches',
    icone: '✅',
    elements: (d) =>
      d.taches
        .filter((t) => !t.abandonnee)
        .map((t) => ({ id: t.id, titre: t.titre, details: [nomCat(d, t.categorieId)], sous: [t.recurrence ? 'revient' : t.date ? formatCourt(t.date) : '', nomCat(d, t.categorieId)].filter(Boolean).join(' · '), date: t.date })),
  },
  {
    type: 'rdv',
    groupe: 'Rendez-vous',
    icone: '🗓️',
    elements: (d) => d.rendezvous.map((r) => ({ id: r.id, titre: r.titre, details: [r.lieu, r.note], sous: [formatCourt(r.date), r.heure].filter(Boolean).join(' · ') })),
  },
  {
    type: 'envie',
    groupe: 'Envies et loisirs',
    icone: '🎬',
    elements: (d) =>
      d.loisirs.envies.map((e) => {
        const liste = d.loisirs.listes.find((l) => l.id === e.listeId);
        return { id: e.id, titre: e.titre, details: [e.auteur, e.note, e.avis], sous: [liste ? `${liste.icone} ${liste.nom}` : '', e.auteur ? `de ${e.auteur}` : '', e.statut === 'fini' ? 'terminé' : e.statut === 'en-cours' ? 'en cours' : ''].filter(Boolean).join(' · ') };
      }),
  },
  {
    type: 'recette',
    groupe: 'Recettes',
    icone: '📖',
    elements: (d) => d.nourriture.recettes.map((r) => ({ id: r.id, titre: r.titre, details: [...(r.ingredients || []), r.etapes], sous: (r.ingredients || []).slice(0, 3).join(', ') })),
  },
  {
    type: 'repas',
    groupe: 'Repas prévus',
    icone: '🍽️',
    elements: (d) => d.nourriture.repas.map((r) => ({ id: r.id, titre: r.texte, details: r.ingredients || [], sous: formatCourt(r.date) })),
  },
  {
    type: 'idee',
    groupe: 'Brain dump',
    icone: '🧠',
    elements: (d) => d.carnet.notes.map((n) => ({ id: n.id, titre: n.texte, details: [nomCat(d, n.categorieId)], sous: nomCat(d, n.categorieId) || 'sans catégorie' })),
  },
  {
    type: 'echeance',
    groupe: 'Échéances',
    icone: '📅',
    elements: (d) => d.administratif.echeances.map((e) => ({ id: e.id, titre: e.titre, details: [e.note], sous: e.date ? formatCourt(e.date) : 'date à choisir' })),
  },
  {
    type: 'fiche',
    groupe: 'Fiches',
    icone: '📇',
    elements: (d) =>
      d.administratif.fiches.map((f) => ({
        id: f.id,
        titre: f.titre,
        details: textesDe(f, ['titre', 'type']),
        sous: { contact: 'contact', garantie: 'garantie', reference: 'référence' }[f.type] || '',
      })),
  },
  {
    type: 'note',
    groupe: 'Notes de recherche',
    icone: '🔎',
    elements: (d) => d.etudes.recherches.map((r) => ({ id: r.id, titre: r.titre, details: [r.note, ...(r.sources || [])], sous: '' })),
  },
  {
    type: 'chapitre',
    groupe: 'Chapitres',
    icone: '📚',
    elements: (d) =>
      d.etudes.chapitres.map((c) => {
        const m = d.etudes.modules.find((x) => x.id === c.moduleId);
        return { id: c.id, titre: c.titre, details: [m?.titre], sous: m?.titre || '' };
      }),
  },
  {
    type: 'qcm',
    groupe: 'QCM',
    icone: '📝',
    elements: (d) => d.etudes.qcm.map((q) => ({ id: q.id, titre: q.titre, details: [q.description], sous: `${(q.questions || []).length} questions` })),
  },
  {
    type: 'maison-tache',
    groupe: 'Ménage et entretien',
    icone: '🧹',
    elements: (d) => d.maison.taches.filter((t) => !t.archivee).map((t) => ({ id: t.id, titre: t.titre, details: [d.maison.zones.find((z) => z.id === t.zoneId)?.nom], sous: d.maison.zones.find((z) => z.id === t.zoneId)?.nom || '' })),
  },
  {
    type: 'plante',
    groupe: 'Plantes',
    icone: '🪴',
    elements: (d) => d.maison.plantes.map((p) => ({ id: p.id, titre: p.nom, details: [p.emplacement, p.note], sous: p.emplacement || '' })),
  },
  {
    type: 'projet',
    groupe: 'Projets',
    icone: '🧱',
    elements: (d) => d.maison.projets.map((p) => ({ id: p.id, titre: p.titre, details: [p.note, ...(p.etapes || []).map((e) => e.titre)], sous: `${(p.etapes || []).length} étapes` })),
  },
  {
    type: 'circuit',
    groupe: 'Circuits de sport',
    icone: '🏋️',
    elements: (d) => d.sport.circuits.map((c) => ({ id: c.id, titre: c.nom, details: [c.note, ...(c.exercices || []).map((e) => e.titre)], sous: `${(c.exercices || []).length} exercices` })),
  },
  {
    type: 'habitude',
    groupe: 'Habitudes',
    icone: '🌸',
    elements: (d) => d.bienEtre.habitudes.map((h) => ({ id: h.id, titre: h.titre, details: [], sous: h.archivee ? 'en pause' : '' })),
  },
  {
    type: 'journal',
    groupe: 'Journal',
    icone: '📓',
    elements: (d) => d.bienEtre.journal.map((e) => ({ id: e.id, titre: `Journal du ${formatCourt(e.date)}`, details: [e.amorce, e.texte], sous: '', corps: e.texte })),
  },
  {
    type: 'depense',
    groupe: 'Dépenses',
    icone: '💶',
    elements: (d) =>
      d.budget.depenses.map((x) => {
        const poste = d.budget.postes.find((p) => p.id === x.posteId);
        return { id: x.id, titre: x.note || poste?.nom || 'Dépense', details: [poste?.nom, String(x.montant).replace('.', ',')], sous: `${formaterEuros(x.montant)} · ${formatCourt(x.date)}` };
      }),
  },
  {
    type: 'objectif',
    groupe: 'Économies',
    icone: '💰',
    elements: (d) => d.budget.objectifs.map((o) => ({ id: o.id, titre: o.nom, details: [], sous: '' })),
  },
  {
    type: 'pret',
    groupe: 'Prêts',
    icone: '🏦',
    elements: (d) => d.budget.prets.map((p) => ({ id: p.id, titre: p.nom, details: [], sous: '' })),
  },
];

export const GROUPES = Object.fromEntries(SOURCES.map((s) => [s.type, s.groupe]));

// ---- Les pages et les domaines (« aller à… ») ----

export function destinations(d) {
  return [
    ...PAGES.map((p) => ({ type: 'page', id: p.id, icone: p.icone, titre: p.titre, sous: '', route: p.id })),
    ...d.categories.filter((c) => !c.archivee).map((c) => ({ type: 'page', id: c.id, icone: c.icone, titre: c.nom, sous: 'domaine', route: `domaine/${c.id}` })),
  ];
}

// ---- La recherche ----

// Rend une liste d'éléments { type, groupe, icone, id, titre, sous, extrait?, score, ... }, les meilleurs d'abord.
// `parType` : au plus tant de résultats par sorte ; `total` : au plus tant en tout.
export function rechercher(d, requete, { parType = 5, total = 40 } = {}) {
  const ts = termes(requete);
  if (ts.length === 0 || normaliser(requete).length < 2) return [];
  const trouves = [];

  const evaluer = (base, titre, details) => {
    const nt = normaliser(titre);
    const corps = normaliser([titre, ...details.filter(Boolean)].join(' '));
    if (!ts.every((t) => corps.includes(t))) return null;
    const dansTitre = ts.every((t) => nt.includes(t));
    let score = dansTitre ? 3 : 1;
    if (dansTitre && nt.startsWith(ts[0])) score += 1;
    if (dansTitre && nt === ts.join(' ')) score += 1;
    return { ...base, score, dansTitre };
  };

  // Les pages et domaines d'abord (si le titre correspond).
  for (const dest of destinations(d)) {
    const r = evaluer({ ...dest, groupe: 'Aller à' }, dest.titre, []);
    if (r && r.dansTitre) trouves.push(r);
  }

  for (const source of SOURCES) {
    const dansGroupe = [];
    for (const e of source.elements(d)) {
      if (!e.titre || !String(e.titre).trim()) continue;
      const r = evaluer({ type: source.type, groupe: source.groupe, icone: source.icone, id: e.id, titre: e.titre, sous: e.sous || '', date: e.date }, e.titre, (e.details || []).filter(Boolean));
      if (!r) continue;
      // Une correspondance seulement dans les détails : on montre l'endroit où elle se trouve.
      if (!r.dansTitre) {
        const source_ = [e.corps, ...(e.details || [])].filter(Boolean).find((t) => ts.every((x) => normaliser(t).includes(x))) || (e.details || []).filter(Boolean).find((t) => ts.some((x) => normaliser(t).includes(x)));
        if (source_) r.extrait = extrait(source_, ts);
      } else if (e.corps) {
        r.extrait = extrait(e.corps, ts);
      }
      dansGroupe.push(r);
    }
    dansGroupe.sort((a, b) => b.score - a.score);
    trouves.push(...dansGroupe.slice(0, parType));
  }

  // Les meilleurs d'abord ; à égalité, l'ordre des sources est gardé (tri stable).
  return trouves
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
    .slice(0, total)
    .map((x) => x.r);
}
