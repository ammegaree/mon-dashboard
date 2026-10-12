// Les fenêtres du Sport : noter une séance faite, planifier une séance, gérer un type.
// Ton : on félicite ce qui est fait, on ne compte jamais ce qui manque.

import { h, ouvrirModale, confirmer, notifier } from '../ui.js';
import * as store from '../store.js';
import { enregistrerActionCoche, enregistrerEditeur } from '../registry.js';
import { aujourdhui, JOURS } from '../dates.js';
import * as S from './sport-donnees.js';
import { echelle } from './bien-etre-checkin.js';
import { choixCircuits } from './ui-circuits.js';

// ---- Noter une séance faite ----

// `prevue` : une séance prévue (du planning) qu'on vient de faire — pour la relier au journal.
// `typeId` / `circuitId` : un type et un circuit de départ (par exemple après avoir fait un circuit pas à pas).
export function ouvrirSeance({ id = null, prevue = null, date = aujourdhui(), typeId: typeDepart = null, circuitId: circuitDepart = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.sport.seances.find((s) => s.id === id) : null;
  if (id && !existante) return;

  const typeInitial = existante?.typeId ?? prevue?.typeId ?? typeDepart ?? donnees.sport.types[0]?.id ?? null;
  const circuitsInitiaux = existante ? S.idsCircuits(existante) : prevue ? S.idsCircuits(prevue) : circuitDepart ? [circuitDepart] : [];
  const dureeInitiale = existante?.dureeMin ?? prevue?.dureeMin ?? donnees.sport.types.find((t) => t.id === typeInitial)?.dureeMin ?? '';

  ouvrirModale({
    titre: existante ? 'Modifier la séance' : prevue ? 'Séance faite ✓' : "J'ai fait une séance",
    couleur: 'corail',
    corps: (fermer) => {
      const etat = { ressenti: existante?.ressenti ?? null };
      const type = h(
        'select',
        { class: 'champ', id: 'seance-type' },
        h('option', { value: '' }, 'Séance libre'),
        donnees.sport.types.map((t) => h('option', { value: t.id, selected: t.id === typeInitial }, `${t.icone} ${t.nom}`))
      );
      type.value = typeInitial || '';
      const circuit = choixCircuits({ typeId: typeInitial, valeurs: circuitsInitiaux });
      const champDate = h('input', { type: 'date', class: 'champ', value: existante?.date || prevue?.date || date, required: true, id: 'seance-date' });
      const duree = h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 600, value: dureeInitiale || '', placeholder: 'min', id: 'seance-duree' });
      const note = h('textarea', { class: 'champ champ-note', rows: 3, placeholder: 'Comment ça s\'est passé ? Une remarque, une sensation…', id: 'seance-note' }, existante?.note || '');

      // Changer de type propose sa durée habituelle (sans écraser une durée déjà saisie).
      type.addEventListener('change', () => {
        circuit.majType(type.value || null);
        const t = donnees.sport.types.find((x) => x.id === type.value);
        if (t?.dureeMin && !duree.dataset.modifie) duree.value = t.dureeMin;
      });
      duree.addEventListener('input', () => (duree.dataset.modifie = '1'));

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!champDate.value) {
              champDate.focus();
              return;
            }
            const valeurs = { typeId: type.value || null, date: champDate.value, dureeMin: duree.value, ressenti: etat.ressenti, note: note.value, circuitIds: circuit.valeurs() };
            if (existante) store.modifier((d) => S.modifierSeance(d, existante.id, valeurs));
            else store.modifier((d) => S.enregistrerSeance(d, { ...valeurs, prevueCle: prevue?.cle || null }));
            fermer();
            if (!existante) notifier(S.felicitation(Date.now() / 1000));
          },
        },
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'seance-type' }, 'Type de séance'), type),
        h('div', { class: 'rangee-champ champ-large' }, h('span', { class: 'etiquette' }, 'Circuits (facultatif, tu peux en choisir plusieurs)'), circuit.element),
        h(
          'div',
          { class: 'rangee-options' },
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'seance-date' }, 'Le'), champDate),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'seance-duree' }, 'Durée'), duree, h('span', { class: 'meta' }, 'min'))
        ),
        h('div', { class: 'pile pile-serre' }, h('strong', null, 'Mon ressenti'), echelle({ valeurs: S.RESSENTIS, valeur: etat.ressenti, libelle: 'Ressenti', surChangement: (v) => (etat.ressenti = v) })),
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
                  store.modifier((d) => (retire = S.supprimerSeance(d, existante.id)));
                  fermer();
                  if (retire) notifier('Séance supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => S.restaurerSeance(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer ✦')
        )
      );
      return formulaire;
    },
  });
}

// ---- Planifier une séance (chaque semaine, ou une seule fois) ----

// `note` / `surEnregistrement` : une note de départ (idée du brain dump) et ce qui se passe une fois la séance planifiée.
export function ouvrirPlanification({ planId = null, ponctuelleId = null, date = aujourdhui(), typeId = null, note: noteInitiale = '', surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const plan = planId ? donnees.sport.plan.find((p) => p.id === planId) : null;
  const ponctuelle = ponctuelleId ? donnees.sport.ponctuelles.find((p) => p.id === ponctuelleId) : null;
  if ((planId && !plan) || (ponctuelleId && !ponctuelle)) return;
  const existant = plan || ponctuelle;
  const types = donnees.sport.types;

  ouvrirModale({
    titre: existant ? 'Modifier la séance prévue' : 'Planifier une séance',
    couleur: 'corail',
    corps: (fermer) => {
      if (types.length === 0) {
        return h(
          'div',
          { class: 'pile' },
          h('p', null, "Pour planifier une séance, il faut d'abord créer au moins un type de séance (yoga, marche, natation…). C'est rapide, dans l'onglet « Circuits » (bouton « ＋ Catégorie »)."),
          h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Compris'))
        );
      }

      let mode = plan ? 'semaine' : ponctuelle ? 'une-fois' : noteInitiale ? 'une-fois' : 'semaine';
      const jours = new Set(plan?.jours || []);
      const typeInitial = existant?.typeId ?? typeId ?? types[0].id;

      const choixType = h('select', { class: 'champ', id: 'plan-type' }, types.map((t) => h('option', { value: t.id, selected: t.id === typeInitial }, `${t.icone} ${t.nom}`)));
      choixType.value = typeInitial;
      const circuit = choixCircuits({ typeId: typeInitial, valeurs: existant ? S.idsCircuits(existant) : [] });
      choixType.addEventListener('change', () => circuit.majType(choixType.value));
      const choixMode = h(
        'select',
        { class: 'champ', id: 'plan-mode', disabled: Boolean(existant) },
        h('option', { value: 'semaine', selected: mode === 'semaine' }, 'Chaque semaine'),
        h('option', { value: 'une-fois', selected: mode === 'une-fois' }, 'Une seule fois')
      );
      choixMode.value = mode;
      const champDate = h('input', { type: 'date', class: 'champ', value: ponctuelle?.date || date, id: 'plan-date' });
      const heure = h('input', { type: 'time', class: 'champ', value: existant?.heure || '', id: 'plan-heure' });
      const duree = h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 600, value: existant?.dureeMin || '', placeholder: 'habituelle', id: 'plan-duree' });
      const note = h('input', { type: 'text', class: 'champ', value: ponctuelle?.note || noteInitiale, placeholder: 'Une note (facultatif)', maxLength: 200, id: 'plan-note' });

      const zoneJours = h(
        'div',
        { class: 'puces puces-jours', role: 'group', 'aria-label': 'Jours de la semaine' },
        JOURS.map((j) =>
          h(
            'label',
            { class: 'puce puce-jour', title: j.long },
            h('input', {
              type: 'checkbox',
              checked: jours.has(j.dow),
              'aria-label': j.long,
              onchange: (e) => (e.target.checked ? jours.add(j.dow) : jours.delete(j.dow)),
            }),
            h('span', null, j.court)
          )
        )
      );
      const ligneJours = h('div', { class: 'pile pile-serre' }, h('span', { class: 'etiquette' }, 'Quels jours ?'), zoneJours);
      const ligneDate = h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'plan-date' }, 'Le'), champDate);
      const ligneNote = h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'plan-note' }, 'Note'), note);
      const rafraichir = () => {
        mode = choixMode.value;
        ligneJours.hidden = mode !== 'semaine';
        ligneDate.hidden = mode !== 'une-fois';
        ligneNote.hidden = mode !== 'une-fois';
      };
      choixMode.addEventListener('change', rafraichir);
      rafraichir();

      return h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            const base = { typeId: choixType.value, heure: heure.value, dureeMin: duree.value, circuitIds: circuit.valeurs() };
            if (mode === 'semaine') {
              if (jours.size === 0) {
                notifier('Choisis au moins un jour.');
                return;
              }
              if (plan) store.modifier((d) => S.modifierPlan(d, plan.id, { ...base, jours: [...jours] }));
              else store.modifier((d) => S.ajouterPlan(d, { ...base, jours: [...jours], debut: aujourdhui() }));
            } else {
              if (!champDate.value) {
                champDate.focus();
                return;
              }
              const valeurs = { ...base, date: champDate.value, note: note.value };
              if (ponctuelle) store.modifier((d) => S.modifierPonctuelle(d, ponctuelle.id, valeurs));
              else store.modifier((d) => S.ajouterPonctuelle(d, valeurs));
            }
            surEnregistrement?.();
            fermer();
            if (!existant) notifier("Séance planifiée ✦ Elle apparaît dans Aujourd'hui et Semaine.");
          },
        },
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'plan-type' }, 'Type de séance'), choixType),
        h('div', { class: 'rangee-champ champ-large' }, h('span', { class: 'etiquette' }, 'Circuits (facultatif, tu peux en choisir plusieurs)'), circuit.element),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'plan-mode' }, 'Quand'), choixMode),
        ligneJours,
        ligneDate,
        h(
          'div',
          { class: 'rangee-options' },
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'plan-heure' }, 'À (facultatif)'), heure),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'plan-duree' }, 'Durée'), duree, h('span', { class: 'meta' }, 'min'))
        ),
        ligneNote,
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
                    titre: 'Retirer cette séance du planning ?',
                    message: plan
                      ? 'Elle ne reviendra plus chaque semaine. Les séances déjà faites restent dans ton récap.'
                      : 'Elle sera retirée du planning. Les séances déjà faites restent dans ton récap.',
                    oui: 'Retirer',
                    non: 'Garder',
                    couleur: 'jaune',
                  });
                  if (!ok) return;
                  if (plan) store.modifier((d) => S.supprimerPlan(d, plan.id));
                  else store.modifier((d) => S.supprimerPonctuelle(d, ponctuelle.id));
                  fermer();
                },
              },
              'Retirer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
    },
  });
}

// ---- Créer / modifier un type de séance ----

export function ouvrirType({ id = null } = {}) {
  const donnees = store.lire();
  const existant = id ? S.typeParId(donnees, id) : null;
  if (id && !existant) return;

  ouvrirModale({
    titre: existant ? 'Modifier la catégorie de sport' : 'Nouvelle catégorie de sport',
    couleur: 'corail',
    corps: (fermer) => {
      const nom = h('input', { type: 'text', class: 'champ champ-titre', value: existant?.nom || '', placeholder: 'Ex. Yoga, Marche rapide, Natation…', maxLength: 60, 'aria-label': 'Nom' });
      const icone = h('input', { type: 'text', class: 'champ champ-icone', value: existant?.icone || '🏃‍♀️', maxLength: 8, 'aria-label': 'Icône' });
      const duree = h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 600, value: existant?.dureeMin || '', placeholder: 'min', 'aria-label': 'Durée habituelle' });

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
            const valeurs = { nom: nom.value, icone: icone.value, dureeMin: duree.value };
            if (existant) store.modifier((d) => S.modifierType(d, existant.id, valeurs));
            else store.modifier((d) => S.ajouterType(d, valeurs));
            fermer();
          },
        },
        nom,
        h('div', { class: 'rangee rangee-souple' }, h('div', { class: 'rangee-champ' }, h('span', { class: 'etiquette' }, 'Icône'), icone), h('div', { class: 'rangee-champ' }, h('span', { class: 'etiquette' }, 'Durée habituelle'), duree, h('span', { class: 'meta' }, 'min'))),
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
                    titre: 'Supprimer cette catégorie ?',
                    message: `« ${existant.nom} » sera retirée, ainsi que ses séances prévues. Tes circuits sont gardés (rangés « sans catégorie ») et les séances déjà faites restent dans ton récap.`,
                    oui: 'Supprimer',
                    non: 'Garder',
                  });
                  if (ok) {
                    store.modifier((d) => S.supprimerType(d, existant.id));
                    fermer();
                  }
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

// ---- Dans Aujourd'hui et Semaine ----

// Cocher une séance prévue ne la « coche » pas à vide : on note la séance (durée, ressenti, note).
enregistrerActionCoche('seance-prevue', (item) => {
  const prevue = S.seancesPrevues(store.lire(), item.date).find((x) => x.id === item.id);
  if (!prevue) return;
  if (prevue.seance) ouvrirSeance({ id: prevue.seance.id });
  else ouvrirSeance({ prevue });
});

// Le crayon ouvre la planification (la séance hebdomadaire, ou la séance ponctuelle).
enregistrerEditeur('seance-prevue', (item) => {
  if (item.id.startsWith('p:')) ouvrirPlanification({ planId: item.id.slice(2) });
  else ouvrirPlanification({ ponctuelleId: item.id.slice(2) });
});

