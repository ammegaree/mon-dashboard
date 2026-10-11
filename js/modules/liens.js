// Un texte qui est une adresse web (http ou https) devient un lien cliquable.
// Les autres schémas (javascript:, file:…) ne sont jamais traités comme des liens.

export function estUnLien(texte) {
  return /^https?:\/\/\S+$/i.test((texte || '').trim());
}
