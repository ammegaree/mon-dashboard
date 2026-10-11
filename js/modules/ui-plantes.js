// Les fenêtres des plantes : une plante, un soin, les saisons, les idées, et « les soins du jour ».

import { h, vider, ouvrirModale, confirmer, notifier, etincelles } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur, enregistrerActionCoche } from '../registry.js';
import { aujourdhui } from '../dates.js';
import { nomIntervalle } from './maison-donnees.js';
import * as P from './plantes-donnees.js';

// ---- Les soins d'un jour (une ligne d'Aujourd'hui : « Arroser : Basilic, Géranium ») ----

export function ouvrirSoinsDuJour({ type, date = aujourdhui() }) {
  const t = P.typeSoin(type);
  const zone = h('div', { class: 'pile' });
  const dessiner = () => {
    const donnees = store.lire();
    const liste = P.soinsDuJour(donnees, t.id, date);
    vider(zone);
    if (!liste.length) {
      zone.append(h('p', { class: 'vide' }, 'Rien à faire ici pour le moment ✦'));
      return;
    }
    const tout = liste.every((x) => x.fait);
    zone.append(
      h(
        'ul',
        { class: 'liste-simple' },
        liste.map(({ plante, soin, fait }) =>
          h(
            'li',
            { class: 'ligne' + (fait ? ' fait' : '') },
            h(
              'label',
              { class: 'case' },
              h('input', {
                type: 'checkbox',
                class: 'case-boite',
                checked: fait,
                onchange: (e) => {
                  if (e.target.checked) etincelles(e.target);
                  store.modifier((d) => (fait ? P.annulerSoinFait(d, soin.id, date) : P.marquerSoinFait(d, soin.id, date)), { rendre: false });
                  dessiner();
                },
              }),
              h('span', { class: 'ligne-titre' }, `${plante.icone} ${plante.nom}`)
            ),
            plante.emplacement && h('span', { class: 'meta' }, plante.emplacement)
          )
        )
      ),
      h(
        'div',
        { class: 'rangee droite' },
        h(
          'button',
          {
            class: 'bouton bouton-turquoise',
            type: 'button',
            onclick: () => {
              store.modifier((d) => P.cocherGroupe(d, t.id, date), { rendre: false });
              dessiner();
            },
          },
          tout ? 'Tout décocher' : `${t.icone} Tout est fait ✓`
        )
      )
    );
  };
  dessiner();
  const { surFermeture } = ouvrirModale({ titre: `${t.icone} ${t.verbe}`, couleur: 'turquoise', corps: zone });
  // La page se met à jour une seule fois, quand la fenêtre se ferme.
  surFermeture(() => store.modifier(() => {}));
}

// Cocher la ligne « Arroser : … » d'Aujourd'hui = tout cocher d'un coup (ou tout décocher).
enregistrerActionCoche('maison-plantes', (item) => {
  store.modifier((d) => P.cocherGroupe(d, item.id, item.date));
});
enregistrerEditeur('maison-plantes', (item) => ouvrirSoinsDuJour({ type: item.id, date: item.date }));

// ---- Une plante ----

function selectRythme({ id, valeur, avecPareil = false, avecAucun = false }) {
  const select = h(
    'select',
    { class: 'champ', id },
    avecPareil && h('option', { value: 'pareil' }, "Comme l'été"),
    avecAucun && h('option', { value: 'aucun' }, "Pas de soin en hiver"),
    P.RYTHMES_PLANTES.map((j) => h('option', { value: String(j) }, nomIntervalle(j))),
    h('option', { value: 'autre' }, 'Autre rythme…')
  );
  const joursPerso = h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 3650, 'aria-label': 'Nombre de jours', placeholder: 'jours' });
  const ligne = h('div', { class: 'rangee-champ' }, select, joursPerso);
  const connu = [...select.options].some((o) => o.value === String(valeur));
  if (valeur === null || valeur === undefined) select.value = avecPareil ? 'pareil' : '7';
  else if (valeur === 0) select.value = 'aucun';
  else if (connu) select.value = String(valeur);
  else {
    select.value = 'autre';
    joursPerso.value = String(valeur);
  }
  const maj = () => (joursPerso.hidden = select.value !== 'autre');
  select.addEventListener('change', maj);
  maj();
  return {
    element: ligne,
    // Change la valeur affichée (même convention que `lire`).
    definir: (v) => {
      joursPerso.value = '';
      if (v === null) select.value = avecPareil ? 'pareil' : '7';
      else if (v === 0) select.value = 'aucun';
      else if ([...select.options].some((o) => o.value === String(v))) select.value = String(v);
      else {
        select.value = 'autre';
        joursPerso.value = String(v);
      }
      maj();
    },
    // Rend un nombre de jours, 0 (pas de soin) ou null (comme l'été) ; undefined si le rythme perso est vide.
    lire: () => {
      if (select.value === 'pareil') return null;
      if (select.value === 'aucun') return 0;
      if (select.value === 'autre') {
        const n = Math.round(Number(joursPerso.value));
        return n >= 1 ? n : undefined;
      }
      return Number(select.value);
    },
    focusPerso: () => joursPerso.focus(),
  };
}

export function ouvrirPlante({ id = null, surCreation = null } = {}) {
  const donnees = store.lire();
  const existante = id ? P.planteParId(donnees, id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? 'Modifier la plante' : 'Nouvelle plante',
    couleur: 'turquoise',
    corps: (fermer) => {
      const nom = h('input', { type: 'text', class: 'champ champ-titre', value: existante?.nom || '', placeholder: 'Ex. Géranium, basilic, lavande…', maxLength: 60, 'aria-label': 'Nom' });
      const icone = h('input', { type: 'text', class: 'champ champ-icone', value: existante?.icone || '🪴', maxLength: 8, 'aria-label': 'Icône' });
      const emplacement = h('input', { type: 'text', class: 'champ', value: existante?.emplacement || 'Balcon', placeholder: 'Où ? (Balcon, rebord de fenêtre…)', maxLength: 60, 'aria-label': 'Emplacement' });
      const note = h('textarea', { class: 'champ champ-note', rows: 3, placeholder: 'Une note (soleil, exposition, astuces…)', maxLength: 500, 'aria-label': 'Note' }, existante?.note || '');
      // À la création : le rythme d'arrosage d'emblée (le soin le plus courant).
      const arrosEte = existante ? null : selectRythme({ id: 'pl-ete', valeur: 3 });
      const arrosHiver = existante ? null : selectRythme({ id: 'pl-hiver', valeur: 10, avecPareil: true, avecAucun: true });

      const formulaire = h(
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
            const valeurs = { nom: nom.value, emplacement: emplacement.value, note: note.value, icone: icone.value };
            if (existante) {
              store.modifier((d) => P.modifierPlante(d, existante.id, valeurs));
            } else {
              const ete = arrosEte.lire();
              if (ete === undefined || ete === null || ete === 0) {
                arrosEte.focusPerso();
                return;
              }
              const hiver = arrosHiver.lire();
              let creee = null;
              store.modifier((d) => {
                creee = P.ajouterPlante(d, valeurs);
                P.ajouterSoin(d, creee.id, { type: 'arrosage', joursEte: ete, joursHiver: hiver === undefined ? null : hiver });
              });
              notifier('Plante ajoutée ✦');
              surCreation?.(creee);
            }
            fermer();
          },
        },
        h('div', { class: 'rangee' }, icone, nom),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'pl-emplacement' }, 'Où ?'), Object.assign(emplacement, { id: 'pl-emplacement' })),
        note,
        !existante &&
          h(
            'div',
            { class: 'pile' },
            h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'pl-ete' }, "Arrosage en été"), arrosEte.element),
            h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'pl-hiver' }, "Arrosage en hiver"), arrosHiver.element),
            h('p', { class: 'doux' }, 'Tu pourras ajouter de l’engrais, un rempotage… ensuite, depuis la fiche de la plante.')
          ),
        h(
          'div',
          { class: 'rangee droite' },
          existante &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: async () => {
                  const ok = await confirmer({
                    titre: 'Supprimer cette plante ?',
                    message: `« ${existante.nom} » et ses soins seront retirés.`,
                    oui: 'Supprimer',
                    non: 'Garder',
                  });
                  if (!ok) return;
                  let retiree = null;
                  store.modifier((d) => (retiree = P.supprimerPlante(d, existante.id)));
                  fermer();
                  if (retiree) notifier('Plante supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => P.restaurerPlante(d, retiree)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => nom.focus(), 0);
      return formulaire;
    },
  });
}

// ---- Un soin ----

export function ouvrirSoin({ planteId, id = null }) {
  const donnees = store.lire();
  const plante = P.planteParId(donnees, planteId);
  if (!plante) return;
  const existant = id ? plante.soins.find((s) => s.id === id) : null;
  if (id && !existant) return;
  const pris = new Set(plante.soins.map((s) => s.type));
  const typesLibres = P.TYPES_SOIN.filter((t) => !pris.has(t.id) || t.id === existant?.type);
  if (!existant && typesLibres.length === 0) {
    notifier('Tous les soins sont déjà là pour cette plante.');
    return;
  }

  ouvrirModale({
    titre: existant ? 'Modifier le soin' : `Nouveau soin · ${plante.nom}`,
    couleur: 'turquoise',
    corps: (fermer) => {
      const type = h('select', { class: 'champ', id: 'so-type' }, typesLibres.map((t) => h('option', { value: t.id, selected: t.id === (existant?.type || typesLibres[0].id) }, `${t.icone} ${t.nom}`)));
      const premier = P.typeSoin(existant?.type || typesLibres[0].id).defaut;
      const ete = selectRythme({ id: 'so-ete', valeur: existant ? existant.joursEte : premier.ete });
      const hiver = selectRythme({ id: 'so-hiver', valeur: existant ? existant.joursHiver : premier.hiver, avecPareil: true, avecAucun: true });
      // Un nouveau soin propose le rythme habituel de sa sorte (un rempotage n'est pas hebdomadaire).
      if (!existant) {
        type.addEventListener('change', () => {
          const d = P.typeSoin(type.value).defaut;
          ete.definir(d.ete);
          hiver.definir(d.hiver);
        });
      }
      const derniere = h('input', { type: 'date', class: 'champ', value: existant?.dernierInitial || '', max: aujourdhui(), id: 'so-derniere' });

      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const joursEte = ete.lire();
            if (!joursEte) {
              ete.focusPerso();
              return;
            }
            const valeurs = { type: type.value, joursEte, joursHiver: hiver.lire() ?? null, derniereFois: derniere.value || null };
            if (valeurs.joursHiver === undefined) {
              hiver.focusPerso();
              return;
            }
            if (existant) store.modifier((d) => P.modifierSoin(d, existant.id, valeurs));
            else store.modifier((d) => P.ajouterSoin(d, plante.id, valeurs));
            fermer();
          },
        },
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'so-type' }, 'Soin'), type),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'so-ete' }, 'En été'), ete.element),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'so-hiver' }, 'En hiver'), hiver.element),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'so-derniere' }, 'Dernière fois'), derniere),
        h('p', { class: 'doux' }, '« Dernière fois » est facultatif. Le soin revient ensuite à ce rythme, à partir de la dernière fois où tu l’as fait.'),
        h(
          'div',
          { class: 'rangee droite' },
          existant &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: () => {
                  let retire = null;
                  store.modifier((d) => (retire = P.supprimerSoin(d, existant.id)));
                  fermer();
                  if (retire) notifier('Soin supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => P.restaurerSoin(d, retire)) } });
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
}

// ---- Les saisons ----

export function ouvrirSaisons() {
  const { debutEte, debutHiver } = P.reglagesSaison(store.lire());
  ouvrirModale({
    titre: 'Mes saisons',
    couleur: 'jaune',
    corps: (fermer) => {
      const mois = (id, valeur) => h('select', { class: 'champ', id }, P.MOIS.map((m, i) => h('option', { value: String(i + 1), selected: i + 1 === valeur }, m)));
      const ete = mois('sa-ete', debutEte);
      const hiver = mois('sa-hiver', debutHiver);
      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            let ok = true;
            store.modifier((d) => (ok = P.definirSaison(d, { debutEte: ete.value, debutHiver: hiver.value })));
            if (!ok) {
              notifier("L'été et l'hiver ne peuvent pas commencer le même mois.");
              return;
            }
            fermer();
          },
        },
        h('p', { class: 'doux' }, 'Tes plantes ont un rythme pour l’été et un autre pour l’hiver. Dis-moi quand ça change chez toi.'),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'sa-ete' }, "L'été commence en"), ete),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'sa-hiver' }, "L'hiver commence en"), hiver),
        h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'), h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer'))
      );
    },
  });
}

// ---- Des idées de plantes ----

export function ouvrirIdeesPlantes() {
  const donnees = store.lire();
  const dejaLa = (nom) => donnees.maison.plantes.some((p) => p.nom.toLowerCase() === nom.toLowerCase());
  ouvrirModale({
    titre: 'Des idées de plantes',
    couleur: 'jaune',
    corps: (fermer) => {
      const coches = new Map();
      const lignes = P.IDEES_PLANTES.map((idee) => {
        const present = dejaLa(idee.nom);
        const c = h('input', { type: 'checkbox', checked: false, disabled: present });
        coches.set(idee.nom, c);
        const arrosage = idee.soins.find((s) => s.type === 'arrosage');
        return h(
          'label',
          { class: 'idee' },
          c,
          h('span', { class: 'ligne-bloc' }, `${idee.icone} ${idee.nom}`),
          h('span', { class: 'meta mono' }, present ? 'déjà là' : arrosage ? `arrosage : ${nomIntervalle(arrosage.joursEte).toLowerCase()}` : '')
        );
      });
      return h(
        'div',
        { class: 'pile' },
        h('p', { class: 'doux' }, 'Coche celles que tu as. Les rythmes sont indicatifs (été et hiver) : tu pourras les ajuster selon ton balcon.'),
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
                const noms = [...coches.entries()].filter(([, c]) => c.checked && !c.disabled).map(([nom]) => nom);
                let n = 0;
                store.modifier((d) => (n = P.ajouterIdeesPlantes(d, noms)));
                fermer();
                notifier(n ? `${n} plante${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} ✦` : 'Rien de nouveau à ajouter.');
              },
            },
            'Ajouter la sélection'
          )
        )
      );
    },
  });
}

