// Le cœur de la synchronisation automatique : un « tour » de synchronisation entre cet appareil et le dépôt privé.
//
//  1. lire la copie chiffrée du dépôt (si elle existe) et la déchiffrer ;
//  2. la fusionner avec ma copie, en s'appuyant sur le « point commun » (ce que le dépôt contenait la dernière fois) :
//     les ajouts, modifications et suppressions des deux côtés sont gardés, et ma version l'emporte en cas de conflit ;
//  3. écrire le résultat chiffré dans le dépôt (s'il y a du nouveau de mon côté) ;
//  4. appliquer le résultat chez moi (s'il y a du nouveau de l'autre côté).
// Si quelqu'un d'autre a écrit entre-temps, ou si j'ai modifié pendant ce temps, on recommence (jusqu'à 4 fois).
// Aucune dépendance au navigateur : tout passe par des fonctions fournies (testable avec un faux dépôt).

import { fusionner, egal } from './fusion.js';
import { chiffrer, dechiffrer } from './chiffrement.js';

const sansMeta = (d) => {
  const { meta, ...reste } = d || {};
  return reste;
};
const copie = (x) => JSON.parse(JSON.stringify(x));

// distant : { lire() → null | { sha, enveloppe }, ecrire({ enveloppe, sha }) → { sha } (lève {code:'conflit'}) }
// local   : { lire() → { donnees, numero }, appliquer(donnees, numero) → boolean (faux si ça a changé entre-temps) }
// point   : { lire() → données | null, ecrire(données) }
// cle     : { cle (base 64), sel, iterations, appareil }
export async function tourDeSynchro({ distant, local, point, cle, essais = 4 }) {
  for (let essai = 0; essai < essais; essai++) {
    const instantane = local.lire();
    const maCopie = copie(instantane.donnees);
    const recu = await distant.lire();

    let donneesDistantes = null;
    if (recu) {
      // Le sel du dépôt doit être celui avec lequel notre clé a été dérivée.
      if (recu.enveloppe.sel !== cle.sel) {
        const e = new Error('Le mot de passe de chiffrement a été changé sur un autre appareil : réactive la synchronisation ici.');
        e.code = 'mot-de-passe';
        throw e;
      }
      donneesDistantes = await dechiffrer(cle.cle, recu.enveloppe);
    }

    const base = await point.lire();
    let fusionnee;
    if (donneesDistantes) {
      // « Ma copie » joue le rôle de l'autre appareil : c'est elle qui gagne en cas de vrai conflit.
      fusionnee = fusionner(base || {}, donneesDistantes, maCopie);
      fusionnee.meta = maCopie.meta;
    } else {
      fusionnee = maCopie;
    }

    const rienAPousser = Boolean(donneesDistantes) && egal(sansMeta(fusionnee), sansMeta(donneesDistantes));
    if (!rienAPousser) {
      const enveloppe = await chiffrer(cle.cle, sansMeta(fusionnee), { sel: cle.sel, iterations: cle.iterations, appareil: cle.appareil });
      try {
        await distant.ecrire({ enveloppe, sha: recu ? recu.sha : null });
      } catch (e) {
        if (e && e.code === 'conflit') continue; // quelqu'un a écrit entre-temps : on recommence
        throw e;
      }
    }

    const nouveautesRecues = !egal(sansMeta(fusionnee), sansMeta(instantane.donnees));
    if (nouveautesRecues) {
      const applique = local.appliquer(fusionnee, instantane.numero);
      if (!applique) continue; // j'ai modifié pendant la synchronisation : on recommence avec ma dernière version
    }
    await point.ecrire(sansMeta(fusionnee));
    return { pousse: !rienAPousser, recu: nouveautesRecues };
  }
  const e = new Error('La synchronisation n’a pas pu se terminer (trop de modifications en même temps). Nouvel essai bientôt.');
  e.code = 'occupe';
  throw e;
}
