// Stockage dans le téléphone (ou le navigateur) : une petite boîte « clé → valeur » (IndexedDB).
// Sert au mode autonome (le dashboard publié sur un site, sans serveur) : tes données y sont gardées sur l'appareil.
// Si IndexedDB n'est pas disponible, on se rabat sur localStorage.

const NOM_BASE = 'mon-dashboard';
const NOM_BOITE = 'kv';

let ouverture = null;

function ouvrir() {
  if (!ouverture) {
    ouverture = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
      const r = indexedDB.open(NOM_BASE, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(NOM_BOITE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return ouverture;
}

function transaction(mode, fn) {
  return ouvrir().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(NOM_BOITE, mode);
        const boite = t.objectStore(NOM_BOITE);
        let resultat;
        const requete = fn(boite);
        if (requete) requete.onsuccess = () => (resultat = requete.result);
        t.oncomplete = () => resolve(resultat);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export async function lireLocal(cle) {
  try {
    return await transaction('readonly', (b) => b.get(cle));
  } catch {
    try {
      const brut = localStorage.getItem(`${NOM_BASE}:${cle}`);
      return brut === null ? undefined : JSON.parse(brut);
    } catch {
      return undefined;
    }
  }
}

export async function ecrireLocal(cle, valeur) {
  try {
    await transaction('readwrite', (b) => b.put(valeur, cle));
  } catch {
    localStorage.setItem(`${NOM_BASE}:${cle}`, JSON.stringify(valeur));
  }
}

export async function supprimerLocal(cle) {
  try {
    await transaction('readwrite', (b) => b.delete(cle));
  } catch {
    try {
      localStorage.removeItem(`${NOM_BASE}:${cle}`);
    } catch {
      // rien à supprimer
    }
  }
}

export async function clesLocales() {
  try {
    return (await transaction('readonly', (b) => b.getAllKeys())) || [];
  } catch {
    try {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith(`${NOM_BASE}:`))
        .map((k) => k.slice(NOM_BASE.length + 1));
    } catch {
      return [];
    }
  }
}

// Demande au navigateur de ne pas effacer ces données quand le téléphone manque de place.
export async function demanderStockagePersistant() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // facultatif
  }
  return false;
}
