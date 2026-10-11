// Les « sources » de QCM : d'où vient un QCM avant d'être validé et enregistré.
//
// Aujourd'hui il n'y en a qu'une : un fichier JSON (ou du JSON collé) produit par
// Claude avec le prompt fourni. Plus tard, une source « générer depuis un PDF »
// s'enregistrera ici de la même façon, sans toucher au reste :
//
//   enregistrerSourceQcm({
//     id: 'pdf', nom: 'Depuis un PDF', description: '…',
//     monter(conteneur, surProduit) { … surProduit(validerQcm(objetProduit)) },
//   });
//
// `surProduit` reçoit le résultat de `validerQcm` / `lireJsonQcm` ({ qcm, erreurs, avertissements }).
// Tout le reste (aperçu, choix du chapitre, enregistrement, passage du QCM) est commun.

import { h } from '../ui.js';
import { lireJsonQcm } from './qcm-format.js';

const sources = [];

export function enregistrerSourceQcm(source) {
  sources.push(source);
}

export function sourcesQcm() {
  return sources;
}

// ---- Source intégrée : fichier JSON ou texte collé ----

enregistrerSourceQcm({
  id: 'fichier',
  nom: 'Fichier ou texte JSON',
  description: 'Un fichier .json (ou son contenu collé) produit par Claude avec le prompt fourni.',
  monter(conteneur, surProduit) {
    const zone = h('textarea', {
      class: 'champ champ-note champ-code',
      rows: 6,
      placeholder: 'Ou colle ici le JSON donné par Claude…',
      'aria-label': 'Contenu JSON du QCM',
    });
    let minuteur = null;
    zone.addEventListener('input', () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => surProduit(zone.value.trim() ? lireJsonQcm(zone.value) : null), 250);
    });

    const fichier = h('input', {
      type: 'file',
      class: 'champ',
      accept: '.json,application/json,text/plain',
      'aria-label': 'Choisir un fichier JSON',
      onchange: async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          const texte = await f.text();
          zone.value = texte;
          surProduit(lireJsonQcm(texte));
        } catch {
          surProduit({ erreurs: ['Impossible de lire ce fichier.'], avertissements: [] });
        }
      },
    });

    conteneur.append(
      h('div', { class: 'rangee-champ champ-large' }, h('span', { class: 'etiquette' }, 'Un fichier .json'), fichier),
      zone
    );
  },
});
