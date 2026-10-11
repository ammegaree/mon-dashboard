// Fusion de deux copies du dashboard (téléphone et ordinateur).
//
// On part de trois versions : la BASE (la dernière version que les deux appareils avaient en commun),
// « MA » copie, et celle de L'AUTRE appareil. On garde les changements des deux côtés :
//   - ce qui n'a été touché que d'un côté est repris tel quel (ajout, modification, suppression) ;
//   - ce qui a été modifié des deux côtés différemment : la version de l'autre appareil (le fichier qu'on apporte) gagne ;
//   - si l'un a supprimé ce que l'autre a modifié : on GARDE la modification (on ne perd jamais une saisie).
// Les listes d'objets sont fusionnées élément par élément grâce à leur identifiant (`id`).
// Règles seulement (pas d'affichage, pas de stockage).

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function egal(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => egal(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => egal(a[k], b[k]));
}

// Une liste dont tous les éléments sont des objets avec un identifiant texte (une liste vide convient aussi).
function avecIds(v) {
  return Array.isArray(v) && v.every((x) => estObjet(x) && typeof x.id === 'string');
}

function fusion3(b, o, t) {
  if (egal(o, t)) return o;
  if (egal(b, t)) return o; // l'autre n'y a pas touché
  if (egal(b, o)) return t; // je n'y ai pas touché
  // Modifié des deux côtés, différemment.
  if (o === undefined) return t; // j'ai supprimé, l'autre a modifié : on garde sa modification
  if (t === undefined) return o; // l'autre a supprimé, j'ai modifié : on garde la mienne

  if (estObjet(o) && estObjet(t)) {
    const base = estObjet(b) ? b : {};
    const cles = [...Object.keys(o), ...Object.keys(t).filter((k) => !(k in o))];
    const sortie = {};
    for (const k of cles) {
      const r = fusion3(base[k], o[k], t[k]);
      if (r !== undefined) sortie[k] = r;
    }
    return sortie;
  }

  if (avecIds(o) && avecIds(t)) {
    const baseListe = avecIds(b) ? b : [];
    const parId = (liste) => new Map(liste.map((x) => [x.id, x]));
    const mb = parId(baseListe);
    const mo = parId(o);
    const mt = parId(t);
    const ids = [...o.map((x) => x.id), ...t.map((x) => x.id).filter((id) => !mo.has(id))];
    const sortie = [];
    for (const id of ids) {
      const r = fusion3(mb.get(id), mo.get(id), mt.get(id));
      if (r !== undefined) sortie.push(r);
    }
    return sortie;
  }

  return t; // deux valeurs simples différentes (ou deux listes sans identifiants) : celle de l'autre appareil
}

function sansMeta(donnees) {
  if (!estObjet(donnees)) return {};
  const { meta, ...reste } = donnees;
  return reste;
}

// Rend la copie fusionnée. Les informations propres à l'appareil (`meta`) restent celles de MA copie.
// `base` peut être vide ou absente : on ne peut alors détecter aucune suppression, on réunit simplement les deux.
export function fusionner(base, ma, autre) {
  const resultat = fusion3(sansMeta(base), sansMeta(ma), sansMeta(autre));
  return { ...(estObjet(resultat) ? resultat : {}), meta: ma?.meta };
}

// Combien d'éléments (dans les listes à identifiant, à n'importe quel niveau) ont été ajoutés, modifiés, supprimés.
export function compterChangements(avant, apres) {
  const total = { ajouts: 0, modifications: 0, suppressions: 0 };
  const parcourir = (a, b) => {
    if (avecIds(a) && avecIds(b)) {
      const ma = new Map(a.map((x) => [x.id, x]));
      const mb = new Map(b.map((x) => [x.id, x]));
      for (const [id, y] of mb) {
        if (!ma.has(id)) total.ajouts++;
        else if (!egal(ma.get(id), y)) {
          // une modification : on regarde aussi ce qui a changé à l'intérieur (sous-listes)
          total.modifications++;
        }
      }
      for (const id of ma.keys()) if (!mb.has(id)) total.suppressions++;
      return;
    }
    if (estObjet(a) && estObjet(b)) {
      for (const k of Object.keys(b)) if (k in a) parcourir(a[k], b[k]);
    }
  };
  parcourir(sansMeta(avant), sansMeta(apres));
  return total;
}
