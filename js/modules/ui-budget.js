// Les fenêtres du budget : une dépense, une ligne de revenu / charge fixe, une enveloppe, des idées.

import { h, ouvrirModale, notifier } from '../ui.js';
import * as store from '../store.js';
import { aujourdhui } from '../dates.js';
import * as G from './budget-donnees.js';

let dernierPoste = '';

function montantTexte(n) {
  return n === null || n === undefined || n === '' ? '' : String(n).replace('.', ',');
}

function annulerSuppression(retire, message) {
  notifier(message, { action: { label: 'Annuler', fn: () => store.modifier((d) => G.restaurer(d, retire)) } });
}

// ---- Une dépense ----

// `montant` / `note` / `posteId` / `date` : des valeurs de départ ; `surEnregistrement` : appelé une fois la dépense enregistrée.
export function ouvrirDepense({ id = null, montant: montantInitial = '', note: noteInitiale = '', posteId: posteInitial = null, date: dateInitiale = aujourdhui(), surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existante = id ? G.depenseParId(donnees, id) : null;
  if (id && !existante) return;
  const postes = donnees.budget.postes;
  const voulu = existante ? existante.posteId : posteInitial ?? dernierPoste;
  const etat = { posteId: postes.some((p) => p.id === voulu) ? voulu : '' };

  ouvrirModale({
    titre: existante ? 'Modifier la dépense' : 'Nouvelle dépense',
    couleur: 'ciel',
    corps: (fermer) => {
      const montant = h('input', {
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        class: 'champ champ-titre champ-montant',
        placeholder: '0,00',
        value: existante ? montantTexte(existante.montant) : montantInitial,
        'aria-label': 'Montant en euros',
      });
      const date = h('input', { type: 'date', class: 'champ', id: 'dep-date', value: existante?.date || dateInitiale });
      const note = h('input', { type: 'text', class: 'champ', maxLength: 200, placeholder: 'Ex. Marché, ciné, pharmacie… (facultatif)', 'aria-label': 'Note', value: existante?.note || noteInitiale });

      const nom = 'dep-poste';
      const choix = [{ id: '', nom: 'Sans enveloppe', icone: '' }, ...postes].map((p) =>
        h(
          'label',
          { class: 'puce', style: '--cat: var(--ciel)' },
          h('input', { type: 'radio', name: nom, value: p.id, checked: p.id === etat.posteId, onchange: () => (etat.posteId = p.id) }),
          h('span', null, p.icone ? `${p.icone} ${p.nom}` : p.nom)
        )
      );

      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const m = G.lireMontant(montant.value);
            if (m === null || m === 0) {
              montant.classList.add('champ-erreur');
              montant.focus();
              notifier('Écris un montant, par exemple 12,50.');
              return;
            }
            const valeurs = { montant: m, date: date.value, posteId: etat.posteId || null, note: note.value };
            dernierPoste = etat.posteId;
            if (existante) store.modifier((d) => G.modifierDepense(d, existante.id, valeurs));
            else store.modifier((d) => G.ajouterDepense(d, valeurs));
            surEnregistrement?.();
            fermer();
            notifier(existante ? 'Dépense modifiée ✦' : `${G.formaterEuros(m)} noté ✦`);
          },
        },
        h('div', { class: 'rangee-champ champ-montant-ligne' }, montant, h('span', { class: 'champ-montant-unite', 'aria-hidden': 'true' }, '€')),
        postes.length > 0
          ? h('div', { class: 'pile pile-serre' }, h('span', { class: 'etiquette' }, 'Enveloppe'), h('div', { class: 'puces', role: 'radiogroup', 'aria-label': 'Enveloppe' }, choix))
          : h('p', { class: 'doux' }, 'Pas encore d’enveloppe (courses, sorties…) : tu peux en créer dans « Mon budget ».'),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'dep-date' }, 'Date'), date),
        note,
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = G.supprimer(d, 'depenses', existante.id)));
                  fermer();
                  if (retire) annulerSuppression(retire, 'Dépense supprimée');
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
  setTimeout(() => document.querySelector('dialog[open] .champ-montant')?.focus(), 0);
}

// ---- Un revenu ou une charge fixe ----

const TEXTES_LIGNE = {
  revenus: { nouveau: 'Nouveau revenu', modifier: 'Modifier le revenu', exemple: 'Ex. Bourse, salaire, aide…', idees: G.IDEES_REVENUS, ajoute: 'Revenu ajouté ✦', retire: 'Revenu supprimé' },
  fixes: { nouveau: 'Nouvelle charge fixe', modifier: 'Modifier la charge fixe', exemple: 'Ex. Loyer, internet, abonnement…', idees: G.IDEES_FIXES, ajoute: 'Charge ajoutée ✦', retire: 'Charge supprimée' },
};

export function ouvrirLigne({ liste, id = null }) {
  const t = TEXTES_LIGNE[liste];
  if (!t) return;
  const donnees = store.lire();
  const existante = id ? G.ligneParId(donnees, liste, id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? t.modifier : t.nouveau,
    couleur: liste === 'revenus' ? 'vert' : 'orange',
    corps: (fermer) => {
      const idListe = `bl-idees-${liste}`;
      const nom = h('input', { type: 'text', class: 'champ champ-titre', maxLength: 80, placeholder: t.exemple, 'aria-label': 'Nom', value: existante?.nom || '' });
      nom.setAttribute('list', idListe);
      const montant = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-montant', placeholder: '0,00', 'aria-label': 'Montant par mois en euros', value: existante ? montantTexte(existante.montant) : '' });
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!nom.value.trim()) {
              nom.classList.add('champ-erreur');
              nom.focus();
              return;
            }
            const m = G.lireMontant(montant.value);
            if (m === null) {
              montant.classList.add('champ-erreur');
              montant.focus();
              notifier('Écris un montant, par exemple 650.');
              return;
            }
            if (existante) store.modifier((d) => G.modifierLigne(d, liste, existante.id, { nom: nom.value, montant: m }));
            else store.modifier((d) => G.ajouterLigne(d, liste, { nom: nom.value, montant: m }));
            fermer();
            if (!existante) notifier(t.ajoute);
          },
        },
        nom,
        h('datalist', { id: idListe }, t.idees.map((x) => h('option', { value: x }))),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, montant, h('span', { class: 'champ-montant-unite' }, '€ par mois')),
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = G.supprimer(d, liste, existante.id)));
                  fermer();
                  if (retire) annulerSuppression(retire, t.retire);
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
  setTimeout(() => document.querySelector('dialog[open] input.champ-titre')?.focus(), 0);
}

// ---- Une enveloppe ----

export function ouvrirEnveloppe({ id = null } = {}) {
  const donnees = store.lire();
  const existante = id ? G.posteParId(donnees, id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? "Modifier l'enveloppe" : 'Nouvelle enveloppe',
    couleur: 'ciel',
    corps: (fermer) => {
      const icone = h('input', { type: 'text', class: 'champ champ-icone', maxLength: 8, value: existante?.icone || '🧾', 'aria-label': 'Emoji' });
      const nom = h('input', { type: 'text', class: 'champ champ-titre', maxLength: 60, placeholder: 'Ex. Courses, sorties…', 'aria-label': 'Nom', value: existante?.nom || '' });
      const plafond = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'champ champ-montant', placeholder: 'Facultatif', 'aria-label': 'Combien par mois, en euros', value: existante ? montantTexte(existante.plafond) : '' });
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!nom.value.trim()) {
              nom.classList.add('champ-erreur');
              nom.focus();
              return;
            }
            if (plafond.value.trim() && G.lireMontant(plafond.value) === null) {
              plafond.classList.add('champ-erreur');
              plafond.focus();
              notifier('Écris un montant, par exemple 150, ou laisse vide.');
              return;
            }
            const valeurs = { nom: nom.value, icone: icone.value, plafond: plafond.value };
            if (existante) store.modifier((d) => G.modifierPoste(d, existante.id, valeurs));
            else store.modifier((d) => G.ajouterPoste(d, valeurs));
            fermer();
            if (!existante) notifier('Enveloppe ajoutée ✦');
          },
        },
        h('div', { class: 'rangee-champ' }, icone, nom),
        h('div', { class: 'rangee-champ champ-montant-ligne' }, plafond, h('span', { class: 'champ-montant-unite' }, '€ par mois')),
        h('p', { class: 'doux' }, 'Le montant est facultatif : sans lui, l’enveloppe te montre simplement ce que tu y as dépensé.'),
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = G.supprimer(d, 'postes', existante.id)));
                  fermer();
                  if (retire) annulerSuppression(retire, 'Enveloppe supprimée (tes dépenses sont gardées).');
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
  setTimeout(() => document.querySelector('dialog[open] input.champ-titre')?.focus(), 0);
}

// ---- Des idées d'enveloppes ----

export function ouvrirIdeesEnveloppes() {
  const donnees = store.lire();
  const dejaLa = (nom) => donnees.budget.postes.some((p) => p.nom.toLowerCase() === nom.toLowerCase());
  ouvrirModale({
    titre: 'Des idées d’enveloppes',
    couleur: 'jaune',
    corps: (fermer) => {
      const coches = new Map();
      const lignes = G.IDEES_ENVELOPPES.map((idee) => {
        const present = dejaLa(idee.nom);
        const c = h('input', { type: 'checkbox', checked: false, disabled: present });
        coches.set(idee.nom, c);
        return h('label', { class: 'idee' }, c, h('span', { class: 'ligne-bloc' }, `${idee.icone} ${idee.nom}`), present && h('span', { class: 'meta mono' }, 'déjà là'));
      });
      return h(
        'div',
        { class: 'pile' },
        h('p', { class: 'doux' }, 'Coche ce qui te parle. Le montant par mois, tu le choisis ensuite (ou jamais).'),
        h('div', { class: 'groupe-idees' }, lignes),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h(
            'button',
            {
              class: 'bouton bouton-jaune',
              type: 'button',
              onclick: () => {
                const noms = [...coches.entries()].filter(([, c]) => c.checked && !c.disabled).map(([n]) => n);
                let n = 0;
                store.modifier((d) => (n = G.ajouterIdeesEnveloppes(d, noms)));
                fermer();
                notifier(n ? `${n} enveloppe${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} ✦` : 'Rien de nouveau à ajouter.');
              },
            },
            'Ajouter la sélection'
          )
        )
      );
    },
  });
}
