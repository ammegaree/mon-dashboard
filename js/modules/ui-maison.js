// Les fenêtres de la Maison : une tâche à rythme souple, une zone, des idées pour démarrer.

import { h, ouvrirModale, confirmer, notifier } from '../ui.js';
import * as store from '../store.js';
import { enregistrerEditeur } from '../registry.js';
import { aujourdhui } from '../dates.js';
import * as M from './maison-donnees.js';

// ---- Une tâche ----

// `titre` : un titre de départ (idée du brain dump) ; `surEnregistrement` : appelé une fois la tâche enregistrée.
export function ouvrirTacheMaison({ id = null, zoneId = null, titre: titreInitial = '', surEnregistrement = null } = {}) {
  const donnees = store.lire();
  const existante = id ? donnees.maison.taches.find((t) => t.id === id) : null;
  if (id && !existante) return;

  if (donnees.maison.zones.length === 0) {
    ouvrirModale({
      titre: 'Une zone d\'abord',
      couleur: 'turquoise',
      corps: (fermer) =>
        h(
          'div',
          { class: 'pile' },
          h('p', null, "Une tâche est rangée dans une zone (une pièce, l'entretien, le balcon…). Crée d'abord une zone, ou pars des idées proposées."),
          h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Compris'))
        ),
    });
    return;
  }

  ouvrirModale({
    titre: existante ? 'Modifier la tâche' : 'Nouvelle tâche',
    couleur: 'turquoise',
    corps: (fermer) => {
      const titre = h('input', { type: 'text', class: 'champ champ-titre', value: existante?.titre || titreInitial, placeholder: 'Ex. Passer le sol, nettoyer le four…', maxLength: 120, 'aria-label': 'Titre' });
      const zone = h('select', { class: 'champ', id: 'mt-zone' }, donnees.maison.zones.map((z) => h('option', { value: z.id, selected: z.id === (existante?.zoneId || zoneId) }, `${z.icone} ${z.nom}`)));
      zone.value = existante?.zoneId || zoneId || donnees.maison.zones[0].id;

      const preset = M.INTERVALLES.some((i) => i.jours === existante?.intervalleJours) || !existante;
      const rythme = h(
        'select',
        { class: 'champ', id: 'mt-rythme' },
        M.INTERVALLES.map((i) => h('option', { value: String(i.jours), selected: i.jours === (existante?.intervalleJours ?? 7) }, i.nom)),
        h('option', { value: 'autre' }, 'Autre rythme…')
      );
      const joursPerso = h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 3650, value: preset ? '' : existante.intervalleJours, 'aria-label': 'Nombre de jours', id: 'mt-jours' });
      const ligneJours = h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'mt-jours' }, 'Tous les'), joursPerso, h('span', { class: 'meta' }, 'jours'));
      if (!preset) rythme.value = 'autre';
      else rythme.value = String(existante?.intervalleJours ?? 7);
      const majJours = () => (ligneJours.hidden = rythme.value !== 'autre');
      rythme.addEventListener('change', majJours);
      majJours();

      const duree = h('input', { type: 'number', class: 'champ champ-court', min: 1, max: 600, value: existante?.dureeMin || '', placeholder: 'min', id: 'mt-duree' });
      const derniere = h('input', { type: 'date', class: 'champ', value: existante?.dernierInitial || '', max: aujourdhui(), id: 'mt-derniere' });

      const formulaire = h(
        'form',
        {
          class: 'pile',
          onsubmit: (e) => {
            e.preventDefault();
            if (!titre.value.trim()) {
              titre.classList.add('champ-erreur');
              titre.focus();
              return;
            }
            const intervalleJours = rythme.value === 'autre' ? joursPerso.value : rythme.value;
            if (rythme.value === 'autre' && !(Number(intervalleJours) >= 1)) {
              joursPerso.focus();
              return;
            }
            const valeurs = { zoneId: zone.value, titre: titre.value, intervalleJours, dureeMin: duree.value, derniereFois: derniere.value || null };
            if (existante) store.modifier((d) => M.modifierTacheMaison(d, existante.id, valeurs));
            else store.modifier((d) => M.ajouterTacheMaison(d, valeurs));
            surEnregistrement?.();
            fermer();
            if (!existante) notifier('Tâche ajoutée ✦');
          },
        },
        titre,
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'mt-zone' }, 'Où ?'), zone),
        h('div', { class: 'rangee-champ champ-large' }, h('label', { class: 'etiquette', for: 'mt-rythme' }, 'À quel rythme ?'), rythme),
        ligneJours,
        h(
          'div',
          { class: 'rangee-options' },
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'mt-duree' }, 'Durée'), duree, h('span', { class: 'meta' }, 'min (facultatif)')),
          h('div', { class: 'rangee-champ' }, h('label', { class: 'etiquette', for: 'mt-derniere' }, 'Dernière fois'), derniere)
        ),
        h('p', { class: 'doux' }, "« Dernière fois » est facultatif : si tu ne sais plus, laisse vide, la tâche sera proposée bientôt. Elle reviendra ensuite à ce rythme, à partir de la dernière fois où tu l'as faite."),
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
                  store.modifier((d) => (retire = M.supprimerTacheMaison(d, existante.id)));
                  fermer();
                  if (retire) notifier('Tâche supprimée', { action: { label: 'Annuler', fn: () => store.modifier((d) => M.restaurerTacheMaison(d, retire)) } });
                },
              },
              'Supprimer'
            ),
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Enregistrer')
        )
      );
      setTimeout(() => titre.focus(), 0);
      return formulaire;
    },
  });
}

// Le crayon, dans Aujourd'hui, ouvre la tâche.
enregistrerEditeur('maison-tache', (item) => ouvrirTacheMaison({ id: item.id }));

// ---- Une zone ----

export function ouvrirZone({ id = null } = {}) {
  const donnees = store.lire();
  const existante = id ? M.zoneParId(donnees, id) : null;
  if (id && !existante) return;

  ouvrirModale({
    titre: existante ? 'Modifier la zone' : 'Nouvelle zone',
    couleur: 'turquoise',
    corps: (fermer) => {
      const nom = h('input', { type: 'text', class: 'champ champ-titre', value: existante?.nom || '', placeholder: 'Ex. Cuisine, Entrée, Entretien, Balcon…', maxLength: 40, 'aria-label': 'Nom' });
      const icone = h('input', { type: 'text', class: 'champ champ-icone', value: existante?.icone || '🏡', maxLength: 8, 'aria-label': 'Icône' });
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
            const valeurs = { nom: nom.value, icone: icone.value };
            if (existante) store.modifier((d) => M.modifierZone(d, existante.id, valeurs));
            else store.modifier((d) => M.ajouterZone(d, valeurs));
            fermer();
          },
        },
        nom,
        h('div', { class: 'rangee-champ' }, h('span', { class: 'etiquette' }, 'Icône'), icone),
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
                  const n = donnees.maison.taches.filter((t) => t.zoneId === existante.id).length;
                  const ok = await confirmer({
                    titre: 'Supprimer cette zone ?',
                    message: `« ${existante.nom} »${n ? ` et ses ${n} tâche${n > 1 ? 's' : ''}` : ''} seront retirées.`,
                    oui: 'Supprimer',
                    non: 'Garder',
                  });
                  if (ok) {
                    store.modifier((d) => M.supprimerZone(d, existante.id));
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

// ---- Des idées pour démarrer ----

export function ouvrirModeles() {
  const donnees = store.lire();
  const dejaLa = (zoneNom, titre) => {
    const zone = donnees.maison.zones.find((z) => z.nom.toLowerCase() === zoneNom.toLowerCase());
    return Boolean(zone && donnees.maison.taches.some((t) => t.zoneId === zone.id && t.titre.toLowerCase() === titre.toLowerCase()));
  };

  ouvrirModale({
    titre: 'Des idées pour démarrer',
    couleur: 'jaune',
    large: true,
    corps: (fermer) => {
      const coches = new Map(); // « zone|titre » → case
      const blocs = M.MODELES.map((m, i) => {
        const compteur = h('span', { class: 'meta mono' });
        const cases = [];
        const maj = () => {
          const n = cases.filter((c) => c.checked && !c.disabled).length;
          compteur.textContent = n > 0 ? `${n} sur ${m.taches.length}` : cases.every((c) => c.disabled) ? 'déjà là' : 'aucune';
        };
        const lignes = m.taches.map((t) => {
          const present = dejaLa(m.zone, t.titre);
          const caseACocher = h('input', { type: 'checkbox', checked: !present, disabled: present, onchange: maj });
          cases.push(caseACocher);
          coches.set(`${m.zone}|${t.titre}`, caseACocher);
          return h(
            'label',
            { class: 'idee' },
            caseACocher,
            h('span', { class: 'ligne-bloc' }, t.titre),
            h('span', { class: 'meta mono' }, present ? 'déjà là' : M.nomIntervalle(t.intervalleJours).toLowerCase())
          );
        });
        maj();
        return h('details', { class: 'groupe-idees', open: i === 0 }, h('summary', null, `${m.icone} ${m.zone}`, compteur), lignes);
      });

      return h(
        'div',
        { class: 'pile' },
        h('p', { class: 'doux' }, "Ouvre une zone, décoche ce qui ne te parle pas : tu pourras tout modifier ensuite. Rien n'arrive d'un coup : seulement 2 petites choses par jour."),
        h('div', { class: 'grille-idees' }, blocs),
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
                const choix = [...coches.entries()].filter(([, c]) => c.checked && !c.disabled).map(([cle]) => {
                  const [zone, ...reste] = cle.split('|');
                  return { zone, titre: reste.join('|') };
                });
                let r = { zones: 0, taches: 0 };
                store.modifier((d) => (r = M.ajouterModeles(d, choix)));
                fermer();
                notifier(r.taches ? `${r.taches} tâche${r.taches > 1 ? 's' : ''} ajoutée${r.taches > 1 ? 's' : ''} ✦` : 'Rien de nouveau à ajouter.');
              },
            },
            'Ajouter la sélection'
          )
        )
      );
    },
  });
}
