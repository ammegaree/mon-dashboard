// Les circuits personnalisés du Sport : en créer un, le faire pas à pas, le choisir pour une séance.

import { h, ouvrirModale, confirmer, notifier, etincelles } from '../ui.js';
import * as store from '../store.js';
import * as S from './sport-donnees.js';
import { normaliserLien } from './liens.js';

// ---- Un petit champ numérique avec son étiquette (séries, répétitions, durée, repos) ----

function nombre(e, cle, libelle, max, placeholder = '') {
  return h(
    'label',
    { class: 'mini-champ' },
    h('span', { class: 'etiquette' }, libelle),
    h('input', {
      type: 'number',
      class: 'champ champ-court',
      min: 0,
      max,
      placeholder,
      value: e[cle] ?? '',
      oninput: (ev) => (e[cle] = ev.target.value === '' ? null : Number(ev.target.value)),
    })
  );
}

// ---- Choisir un ou plusieurs circuits (séance faite, séance prévue) ----

// Des pastilles à cocher : les circuits du type choisi. On peut en cocher plusieurs.
// `majType(typeId)` change de type (les coches qui n'existent plus dans ce type sont retirées) ; `valeurs()` rend les identifiants cochés.
export function choixCircuits({ typeId, valeurs = [] }) {
  const element = h('div', { class: 'pile pile-serre', role: 'group', 'aria-label': 'Circuits' });
  let choisis = new Set(valeurs);
  let affiches = []; // les circuits proposés, dans l'ordre d'affichage
  const remplir = (type) => {
    affiches = S.circuitsDuType(store.lire(), type || null);
    choisis = new Set([...choisis].filter((id) => affiches.some((c) => c.id === id)));
    element.replaceChildren(
      ...(affiches.length === 0
        ? [h('p', { class: 'doux' }, 'Aucun circuit pour ce type pour l’instant.')]
        : [
            h(
              'div',
              { class: 'puces' },
              affiches.map((c) =>
                h(
                  'label',
                  { class: 'puce', style: '--cat: var(--corail)' },
                  h('input', {
                    type: 'checkbox',
                    checked: choisis.has(c.id),
                    onchange: (e) => (e.target.checked ? choisis.add(c.id) : choisis.delete(c.id)),
                  }),
                  h('span', null, `🔁 ${c.nom}`)
                )
              )
            ),
          ])
    );
  };
  remplir(typeId);
  return {
    element,
    majType: (type) => remplir(type),
    valeurs: () => affiches.map((c) => c.id).filter((id) => choisis.has(id)),
  };
}

// ---- Créer / modifier un circuit ----

// `exercicesInitiaux` : pour un nouveau circuit, des exercices déjà là (par exemple une idée du brain dump).
export function ouvrirCircuit({ id = null, typeId = null, surCreation = null, exercicesInitiaux = [] } = {}) {
  const donnees = store.lire();
  const existant = id ? S.circuitParId(donnees, id) : null;
  if (id && !existant) return;

  ouvrirModale({
    titre: existant ? 'Modifier le circuit' : 'Nouveau circuit',
    couleur: 'corail',
    large: true,
    corps: (fermer) => {
      const nom = h('input', { type: 'text', class: 'champ champ-titre', value: existant?.nom || '', placeholder: 'Ex. Circuit jambes, Salutation au soleil…', maxLength: 80, 'aria-label': 'Nom du circuit' });
      const type = h(
        'select',
        { class: 'champ', id: 'circ-type' },
        h('option', { value: '' }, 'Sans catégorie'),
        donnees.sport.types.map((t) => h('option', { value: t.id }, `${t.icone} ${t.nom}`))
      );
      type.value = existant ? existant.typeId || '' : typeId || '';
      const note = h('input', { type: 'text', class: 'champ', value: existant?.note || '', placeholder: 'Une note : matériel, repos entre les tours… (facultatif)', maxLength: 200, 'aria-label': 'Note' });
      const lienCircuit = h('input', { type: 'text', class: 'champ', value: existant?.lien || '', placeholder: 'Lien d’une vidéo du circuit (facultatif)', maxLength: 300, inputmode: 'url', 'aria-label': 'Lien vidéo du circuit' });

      // Les exercices, dans l'ordre : un titre, puis séries, répétitions, durée, repos et une remarque.
      const brouillon = (existant?.exercices || exercicesInitiaux).map((e) => ({
        id: null,
        series: null,
        repetitions: null,
        dureeSec: null,
        reposSec: null,
        detail: '',
        lien: '',
        ...e,
      }));
      const liste = h('ul', { class: 'liste-simple editeur-exercices' });
      const champTitre = h('input', { type: 'text', class: 'champ', placeholder: 'Nouvel exercice…', maxLength: 100, 'aria-label': 'Nouvel exercice' });

      const dessiner = (focusIndex = null) => {
        liste.replaceChildren(
          ...brouillon.map((e, i) => {
            const premier = nombre(e, 'series', 'Séries', 99);
            if (focusIndex === i) setTimeout(() => premier.querySelector('input').focus(), 0);
            return h(
              'li',
              { class: 'exercice-edition' },
              h(
                'div',
                { class: 'rangee' },
                h('input', { type: 'text', class: 'champ', value: e.titre, maxLength: 100, 'aria-label': `Exercice ${i + 1}`, oninput: (ev) => (e.titre = ev.target.value) }),
                h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Monter', disabled: i === 0, onclick: () => { [brouillon[i - 1], brouillon[i]] = [brouillon[i], brouillon[i - 1]]; dessiner(); } }, '↑'),
                h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Descendre', disabled: i === brouillon.length - 1, onclick: () => { [brouillon[i + 1], brouillon[i]] = [brouillon[i], brouillon[i + 1]]; dessiner(); } }, '↓'),
                h('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Retirer cet exercice', onclick: () => { brouillon.splice(i, 1); dessiner(); } }, '✕')
              ),
              h(
                'div',
                { class: 'rangee rangee-souple champs-exercice' },
                premier,
                nombre(e, 'repetitions', 'Répétitions', 999),
                nombre(e, 'dureeSec', 'Durée (s)', 3600),
                nombre(e, 'reposSec', 'Repos (s)', 3600)
              ),
              h('input', { type: 'text', class: 'champ', value: e.detail || '', maxLength: 80, placeholder: 'Une remarque (facultatif)', 'aria-label': `Remarque de l'exercice ${i + 1}`, oninput: (ev) => (e.detail = ev.target.value) }),
              h('input', { type: 'text', class: 'champ', value: e.lien || '', maxLength: 300, placeholder: 'Lien d’une vidéo (facultatif)', inputmode: 'url', 'aria-label': `Lien vidéo de l'exercice ${i + 1}`, oninput: (ev) => (e.lien = ev.target.value) })
            );
          })
        );
      };
      const ajouter = () => {
        const titre = champTitre.value.trim();
        if (!titre) return;
        brouillon.push({ id: null, titre, series: null, repetitions: null, dureeSec: null, reposSec: null, detail: '', lien: '' });
        champTitre.value = '';
        dessiner(brouillon.length - 1);
      };
      champTitre.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ajouter();
        }
      });
      dessiner();

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
            ajouter(); // un exercice tapé mais pas encore « ajouté » ne se perd pas
            // Un lien qui n'est pas une adresse web : on le dit, on n'enregistre pas en silence autre chose.
            if (lienCircuit.value.trim() && !normaliserLien(lienCircuit.value)) {
              lienCircuit.classList.add('champ-erreur');
              lienCircuit.focus();
              notifier('Le lien du circuit doit être une adresse web (https://…).');
              return;
            }
            const mauvais = brouillon.find((x) => String(x.lien || '').trim() && !normaliserLien(x.lien));
            if (mauvais) {
              notifier(`Le lien de « ${mauvais.titre} » doit être une adresse web (https://…).`);
              return;
            }
            const valeurs = { nom: nom.value, typeId: type.value || null, note: note.value, lien: lienCircuit.value };
            let cree = null;
            store.modifier((d) => {
              if (existant) {
                S.modifierCircuit(d, existant.id, valeurs);
                S.enregistrerExercices(d, existant.id, brouillon);
              } else {
                cree = S.ajouterCircuit(d, valeurs);
                S.enregistrerExercices(d, cree.id, brouillon);
              }
            });
            fermer();
            if (!existant) {
              notifier('Circuit créé ✦');
              surCreation?.(cree);
            }
          },
        },
        nom,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'circ-type' }, 'Catégorie de sport'), type),
        note,
        lienCircuit,
        h('h3', null, 'Les exercices, dans l’ordre'),
        liste,
        h('div', { class: 'rangee' }, champTitre, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: ajouter }, '＋ Exercice')),
        h('p', { class: 'doux' }, 'Tout est facultatif : mets seulement ce qui compte pour toi (par exemple juste la durée pour un gainage).'),
        h(
          'div',
          { class: 'rangee droite' },
          existant &&
            h(
              'button',
              {
                class: 'bouton',
                type: 'button',
                onclick: async () => {
                  const ok = await confirmer({
                    titre: 'Supprimer ce circuit ?',
                    message: `« ${existant.nom} » sera retiré. Les séances déjà faites restent dans ton récap.`,
                    oui: 'Supprimer',
                    non: 'Garder',
                  });
                  if (!ok) return;
                  let retire = null;
                  store.modifier((d) => (retire = S.supprimerCircuit(d, existant.id)));
                  fermer();
                  if (retire) notifier('Circuit supprimé', { action: { label: 'Annuler', fn: () => store.modifier((d) => S.restaurerCircuit(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => (existant ? champTitre : nom).focus(), 0);
      return formulaire;
    },
  });
}

// ---- Ajouter un exercice à un circuit qui existe déjà (par exemple depuis une idée du brain dump) ----

// `titre` : le nom de l'exercice (modifiable) ; `surEnregistrement(circuit)` : appelé une fois l'exercice ajouté.
export function ouvrirAjoutExercice({ titre = '', circuitId = null, surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const groupes = S.circuitsParType(donnees);

  ouvrirModale({
    titre: 'Ajouter à un circuit',
    couleur: 'corail',
    corps: (fermer) => {
      if (groupes.length === 0) {
        return h(
          'div',
          { class: 'pile' },
          h('p', { class: 'doux' }, 'Tu n’as pas encore de circuit. Crée le premier : « ' + titre + ' » en sera le premier exercice.'),
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
                  fermer();
                  ouvrirCircuit({ exercicesInitiaux: [{ titre }], surCreation: surEnregistrement });
                },
              },
              '＋ Créer un circuit'
            )
          )
        );
      }

      const exercice = { titre, series: null, repetitions: null, dureeSec: null, reposSec: null, detail: '', lien: '' };
      const choix = h(
        'select',
        { class: 'champ', id: 'ajout-circuit', 'aria-label': 'Circuit' },
        groupes.map((g) =>
          h(
            'optgroup',
            { label: g.type ? `${g.type.icone} ${g.type.nom}` : 'Sans catégorie' },
            g.circuits.map((c) => h('option', { value: c.id }, `🔁 ${c.nom} (${c.exercices.length} exercice${c.exercices.length > 1 ? 's' : ''})`))
          )
        )
      );
      const tousLesIds = groupes.flatMap((g) => g.circuits.map((c) => c.id));
      choix.value = tousLesIds.includes(circuitId) ? circuitId : tousLesIds[0];

      const champTitre = h('input', { type: 'text', class: 'champ champ-titre', value: titre, maxLength: 100, 'aria-label': 'Nom de l’exercice' });
      champTitre.addEventListener('input', () => {
        exercice.titre = champTitre.value;
        champTitre.classList.remove('champ-erreur');
      });
      const champLien = h('input', {
        type: 'text',
        class: 'champ',
        maxLength: 300,
        inputmode: 'url',
        placeholder: 'Lien d’une vidéo (facultatif)',
        'aria-label': 'Lien vidéo',
        oninput: (ev) => {
          exercice.lien = ev.target.value;
          ev.target.classList.remove('champ-erreur');
        },
      });
      const remarque = h('input', {
        type: 'text',
        class: 'champ',
        maxLength: 80,
        placeholder: 'Une remarque (facultatif)',
        'aria-label': 'Remarque',
        oninput: (ev) => (exercice.detail = ev.target.value),
      });

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!exercice.titre.trim()) {
              champTitre.classList.add('champ-erreur');
              champTitre.focus();
              return;
            }
            if (exercice.lien.trim() && !normaliserLien(exercice.lien)) {
              champLien.classList.add('champ-erreur');
              champLien.focus();
              notifier('Le lien doit être une adresse web (https://…).');
              return;
            }
            let ajoute = null;
            store.modifier((d) => (ajoute = S.ajouterExercice(d, choix.value, exercice)));
            if (!ajoute) return;
            const circuit = S.circuitParId(store.lire(), choix.value);
            fermer();
            notifier(`Ajouté à « ${circuit.nom} » ✦`);
            surEnregistrement?.(circuit);
          },
        },
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'ajout-circuit' }, 'Dans quel circuit ?'), choix),
        h('div', { class: 'rangee-champ champ-large' }, h('span', { class: 'etiquette' }, 'L’exercice'), champTitre),
        h(
          'div',
          { class: 'rangee rangee-souple champs-exercice' },
          nombre(exercice, 'series', 'Séries', 99),
          nombre(exercice, 'repetitions', 'Répétitions', 999),
          nombre(exercice, 'dureeSec', 'Durée (s)', 3600),
          nombre(exercice, 'reposSec', 'Repos (s)', 3600)
        ),
        remarque,
        champLien,
        h('p', { class: 'doux' }, 'Il est ajouté à la fin du circuit. Tout est facultatif sauf le nom : tu pourras le modifier ensuite en ouvrant le circuit.'),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Ajouter')
        )
      );
      setTimeout(() => choix.focus(), 0);
      return formulaire;
    },
  });
}

// ---- Faire un circuit, un exercice à la fois ----

// `surTermine(circuit)` : appelé quand elle a fini (en général : noter la séance).
export function faireCircuit({ id, surTermine = null }) {
  const circuit = S.circuitParId(store.lire(), id);
  if (!circuit) return;
  const faits = new Set();

  const zone = h('div', { class: 'pile' });
  const dessiner = () => {
    const suivant = circuit.exercices.find((e) => !faits.has(e.id));
    zone.replaceChildren(
      circuit.note && h('p', { class: 'doux' }, circuit.note),
      circuit.lien && h('p', null, h('a', { class: 'lien-video', href: circuit.lien, target: '_blank', rel: 'noopener noreferrer' }, '▶ Voir la vidéo du circuit')),
      circuit.exercices.length === 0
        ? h('p', { class: 'vide' }, 'Ce circuit n’a pas encore d’exercice : ajoute-en en le modifiant.')
        : h(
            'ul',
            { class: 'liste-simple' },
            circuit.exercices.map((e) =>
              h(
                'li',
                { class: 'ligne ligne-exercice' + (faits.has(e.id) ? ' fait' : '') + (suivant?.id === e.id ? ' ligne-tache-maison a-faire' : '') },
                h(
                  'label',
                  { class: 'case' },
                  h('input', {
                    type: 'checkbox',
                    class: 'case-boite',
                    checked: faits.has(e.id),
                    onchange: (ev) => {
                      if (ev.target.checked) {
                        faits.add(e.id);
                        etincelles(ev.target);
                      } else faits.delete(e.id);
                      dessiner();
                    },
                  }),
                  h('span', { class: 'ligne-titre' }, e.titre)
                ),
                S.resumeExercice(e) && h('span', { class: 'meta mono' }, S.resumeExercice(e)),
                e.lien && h('a', { class: 'lien-video', href: e.lien, target: '_blank', rel: 'noopener noreferrer' }, '▶ Voir la vidéo')
              )
            )
          ),
      h(
        'div',
        { class: 'rangee droite' },
        h('span', { class: 'meta mono ligne-bloc' }, `${faits.size} / ${circuit.exercices.length}`),
        h(
          'button',
          {
            class: 'bouton bouton-turquoise',
            type: 'button',
            onclick: () => {
              ferme();
              surTermine?.(circuit);
            },
          },
          faits.size === circuit.exercices.length && circuit.exercices.length > 0 ? 'Circuit terminé ✓' : "J'ai fini"
        )
      )
    );
  };
  dessiner();
  const { fermer: ferme } = ouvrirModale({ titre: `🔁 ${circuit.nom}`, couleur: 'corail', corps: zone });
}
