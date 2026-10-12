// Un texte qui est une adresse web (http ou https) devient un lien cliquable.
// Les autres schémas (javascript:, file:…) ne sont jamais traités comme des liens.

export function estUnLien(texte) {
  return /^https?:\/\/\S+$/i.test((texte || '').trim());
}

// Ce que la personne a tapé → une adresse prête à ouvrir, ou '' si ce n'est pas une adresse web.
// « youtube.com/watch?v=… » ou « www.… » reçoivent « https:// » ; tout le reste (javascript:, texte libre…) est refusé.
export function normaliserLien(texte) {
  const t = String(texte ?? '').trim();
  if (!t) return '';
  if (estUnLien(t)) return t;
  if (/^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)+\/)\S*$/i.test(t) && !/^[a-z][a-z0-9+.-]*:/i.test(t)) return `https://${t}`;
  return '';
}
