// Page « Réglages » : les catégories (domaines de vie), le check-in, la sauvegarde et l'accès depuis le téléphone.

import { h, pastilles, notifier, ouvrirModale, confirmer } from '../ui.js';
import { genererQr, qrEnSvg } from './qr.js';
import * as S from './synchro.js';
import * as store from '../store.js';
import { enregistrerPage } from '../registry.js';
import { PALETTE, validerSauvegarde } from '../schema.js';
import { aujourdhui } from '../dates.js';

function fabriquerId(nom, donnees) {
  const base =
    nom
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'categorie';
  let id = base;
  let n = 2;
  while (donnees.categories.some((c) => c.id === id)) id = `${base}-${n++}`;
  return id;
}

// Dit à la barre latérale de se mettre à jour (nom, icône ou couleur changés).
function signalerCategories() {
  window.dispatchEvent(new Event('categories-modifiees'));
}

function exporter() {
  const contenu = JSON.stringify(store.lire(), null, 2);
  const blob = new Blob([contenu], { type: 'application/json' });
  const lien = h('a', { href: URL.createObjectURL(blob), download: `mon-dashboard-sauvegarde-${aujourdhui()}.json` });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
  notifier('Sauvegarde téléchargée ✦');
}

// ---- Importer une sauvegarde ----

function choisirFichierSauvegarde() {
  const champ = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  champ.addEventListener('change', async () => {
    const fichier = champ.files?.[0];
    champ.remove();
    if (!fichier) return;
    let texte;
    try {
      texte = await fichier.text();
    } catch {
      notifier('Impossible de lire ce fichier.');
      return;
    }
    let brut;
    try {
      brut = JSON.parse(texte);
    } catch {
      proposerImport({ erreurs: ["Ce fichier n'est pas du JSON valide : ce n'est pas une sauvegarde du dashboard."] }, fichier.name);
      return;
    }
    proposerImport(validerSauvegarde(brut), fichier.name);
  });
  document.body.append(champ);
  champ.click();
}

function proposerImport(resultat, nomFichier) {
  ouvrirModale({
    titre: 'Importer une sauvegarde',
    couleur: resultat.erreurs ? 'corail' : 'orange',
    corps: (fermer) => {
      if (resultat.erreurs) {
        return h(
          'div',
          { class: 'pile' },
          h('p', null, `Le fichier « ${nomFichier} » ne peut pas être importé :`),
          h('ul', { class: 'liste-puces' }, resultat.erreurs.map((e) => h('li', null, e))),
          h('p', { class: 'doux' }, 'Rien n\'a été modifié. Utilise un fichier téléchargé avec « Télécharger une sauvegarde ».'),
          h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Fermer'))
        );
      }
      const r = resultat.resume;
      const lignes = [
        [r.taches, 'tâche'],
        [r.rendezvous, 'rendez-vous'],
        [r.chapitres, 'chapitre'],
        [r.checkins, 'check-in'],
        [r.journal, 'entrée de journal', 'entrées de journal'],
        [r.avancees, 'idée du brain dump', 'idées du brain dump'],
        [r.seances, 'séance de sport', 'séances de sport'],
        [r.repas, 'repas', 'repas'],
        [r.bilans, 'bilan'],
      ].filter(([n]) => n > 0);
      return h(
        'div',
        { class: 'pile' },
        h('p', null, `Fichier : « ${nomFichier} »`),
        lignes.length
          ? h('ul', { class: 'liste-puces' }, lignes.map(([n, un, plusieurs]) => h('li', null, `${n} ${n > 1 ? plusieurs || `${un}s` : un}`)))
          : h('p', { class: 'doux' }, 'Cette sauvegarde est vide : seules tes catégories et tes réglages seront repris.'),
        h('p', { class: 'avertissement-import' }, 'Importer remplace toutes tes données actuelles. Une copie de ce que tu as maintenant est gardée dans le dossier « sauvegardes/ » avant le remplacement.'),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h(
            'button',
            {
              class: 'bouton bouton-corail',
              type: 'button',
              onclick: async () => {
                fermer();
                const etat = await store.remplacer(resultat.donnees);
                if (etat === 'ok') {
                  notifier('Sauvegarde importée ✦ Tes anciennes données sont dans « sauvegardes/ ».');
                  location.hash = '#/aujourdhui';
                } else {
                  notifier("L'import n'a pas pu être enregistré. Rien n'est perdu : réessaie, ou recharge la page.");
                }
              },
            },
            'Remplacer mes données'
          )
        )
      );
    },
  });
}

function ligneCategorie(cat) {
  const ligne = h('li', { class: 'ligne ligne-categorie' + (cat.archivee ? ' archivee' : ''), style: `--cat: var(--${cat.couleur})` });

  const echantillons = PALETTE.map((p) =>
    h('button', {
      class: 'echantillon' + (p.id === cat.couleur ? ' actif' : ''),
      type: 'button',
      style: `--cat: var(--${p.id})`,
      title: p.nom,
      'aria-label': p.nom,
      'aria-pressed': p.id === cat.couleur ? 'true' : 'false',
      onclick: (e) => {
        store.modifier(() => (cat.couleur = p.id), { rendre: false });
        signalerCategories();
        ligne.style.setProperty('--cat', `var(--${p.id})`);
        ligne.querySelectorAll('.echantillon').forEach((b) => {
          const actif = b === e.currentTarget;
          b.classList.toggle('actif', actif);
          b.setAttribute('aria-pressed', String(actif));
        });
      },
    })
  );

  const champIcone = h('input', {
    class: 'champ champ-icone',
    type: 'text',
    value: cat.icone,
    maxLength: 8,
    'aria-label': `Icône de ${cat.nom}`,
    onchange: (e) => {
      store.modifier(() => (cat.icone = e.target.value.trim() || '✨'), { rendre: false });
      signalerCategories();
    },
  });

  const champNom = h('input', {
    class: 'champ',
    type: 'text',
    value: cat.nom,
    maxLength: 40,
    'aria-label': `Nom de la catégorie ${cat.nom}`,
    onchange: (e) => {
      const nom = e.target.value.trim();
      if (!nom) {
        e.target.value = cat.nom;
        return;
      }
      store.modifier(() => (cat.nom = nom), { rendre: false });
      signalerCategories();
    },
  });

  ligne.append(
    h('span', { class: 'pastille-cat', 'aria-hidden': 'true' }),
    champIcone,
    champNom,
    h('div', { class: 'echantillons', role: 'group', 'aria-label': 'Couleur' }, echantillons),
    h(
      'button',
      { class: 'bouton bouton-petit', type: 'button', onclick: () => store.modifier(() => (cat.archivee = !cat.archivee)) },
      cat.archivee ? 'Réactiver' : 'Masquer'
    )
  );
  return ligne;
}

function formulaireNouvelleCategorie() {
  let couleur = PALETTE[0].id;
  const champNom = h('input', { class: 'champ', type: 'text', placeholder: 'Nouvelle catégorie (ex. Budget)', maxLength: 40, 'aria-label': 'Nom de la nouvelle catégorie' });
  const champIcone = h('input', { class: 'champ champ-icone', type: 'text', value: '⭐', maxLength: 8, 'aria-label': 'Icône' });
  const echantillons = PALETTE.map((p, i) =>
    h('button', {
      class: 'echantillon' + (i === 0 ? ' actif' : ''),
      type: 'button',
      style: `--cat: var(--${p.id})`,
      title: p.nom,
      'aria-label': p.nom,
      onclick: (e) => {
        couleur = p.id;
        e.currentTarget.parentElement.querySelectorAll('.echantillon').forEach((b) => b.classList.toggle('actif', b === e.currentTarget));
      },
    })
  );
  return h(
    'form',
    {
      class: 'rangee rangee-souple',
      onsubmit: (e) => {
        e.preventDefault();
        const nom = champNom.value.trim();
        if (!nom) {
          champNom.focus();
          return;
        }
        store.modifier((d) =>
          d.categories.push({ id: fabriquerId(nom, d), nom, couleur, icone: champIcone.value.trim() || '⭐' })
        );
      },
    },
    champIcone,
    champNom,
    h('div', { class: 'echantillons', role: 'group', 'aria-label': 'Couleur' }, echantillons),
    h('button', { class: 'bouton bouton-jaune', type: 'submit' }, 'Ajouter')
  );
}

function contenuRappelCheckin(donnees) {
  const r = donnees.reglages.checkin;
  const heure = h('input', {
    type: 'time',
    class: 'champ',
    id: 'rappel-heure',
    value: r.heure,
    disabled: !r.actif,
    onchange: (e) => {
      if (e.target.value) store.modifier((d) => (d.reglages.checkin.heure = e.target.value), { rendre: false });
    },
  });
  return h(
    'div',
    { class: 'pile' },
    h('p', { class: 'doux' }, "À partir de l'heure choisie, une fenêtre te pose trois petites questions tant que ton check-in n'est pas fait. Tu peux la repousser ou l'ignorer."),
    h(
      'div',
      { class: 'rangee rangee-souple' },
      h(
        'label',
        { class: 'puce', style: '--cat: var(--turquoise)' },
        h('input', {
          type: 'checkbox',
          checked: r.actif,
          onchange: (e) => {
            store.modifier((d) => (d.reglages.checkin.actif = e.target.checked), { rendre: false });
            heure.disabled = !e.target.checked;
          },
        }),
        h('span', null, 'Me proposer mon check-in')
      ),
      h('label', { class: 'etiquette', for: 'rappel-heure' }, 'à partir de'),
      heure
    )
  );
}

// ---- Entre le téléphone et l'ordinateur ----

const appareilCourant = () => (store.modeStockage() === 'autonome' ? 'telephone' : 'ordinateur');
const autreAppareil = () => (store.modeStockage() === 'autonome' ? "l'ordinateur" : 'le téléphone');
const versAutreAppareil = () => (store.modeStockage() === 'autonome' ? "à l'ordinateur" : 'au téléphone');

// Envoie sa copie : la feuille de partage du téléphone (AirDrop, Messages…) si elle existe, sinon un téléchargement.
async function envoyerALAutreAppareil() {
  const appareil = appareilCourant();
  const nom = S.nomFichierEnvoi(appareil);
  const contenu = JSON.stringify(await S.creerFichierEnvoi(store.lire(), appareil));
  try {
    const fichier = new File([contenu], nom, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: 'Mon dashboard' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // l'envoi a été annulé
  }
  const blob = new Blob([contenu], { type: 'application/json' });
  const lien = h('a', { href: URL.createObjectURL(blob), download: nom });
  document.body.append(lien);
  lien.click();
  lien.remove();
  notifier(`Fichier « ${nom} » téléchargé : envoie-le ${versAutreAppareil()}.`);
}

function proposerFusion(fichier, nomFichier, redessiner) {
  const ma = store.lire();
  const prep = S.preparerFusion(ma, fichier);
  const c = prep.changements;
  ouvrirModale({
    titre: 'Fusionner avec l’autre appareil',
    couleur: 'turquoise',
    corps: (fermer) =>
      h(
        'div',
        { class: 'pile' },
        h('p', null, `Fichier : « ${nomFichier} »`),
        prep.rienDeNouveau
          ? h('p', null, 'Il n’y a rien de nouveau dans ce fichier : tes données sont déjà à jour.')
          : h(
              'div',
              { class: 'pile pile-serre' },
              h('p', null, 'Ce que cette fusion va changer chez toi :'),
              h(
                'ul',
                { class: 'liste-puces' },
                h('li', null, `${c.ajouts} élément${c.ajouts > 1 ? 's' : ''} ajouté${c.ajouts > 1 ? 's' : ''}`),
                h('li', null, `${c.modifications} élément${c.modifications > 1 ? 's' : ''} modifié${c.modifications > 1 ? 's' : ''}`),
                h('li', null, `${c.suppressions} élément${c.suppressions > 1 ? 's' : ''} supprimé${c.suppressions > 1 ? 's' : ''}`)
              )
            ),
        fichier.simpleSauvegarde && h('p', { class: 'doux' }, 'C’est une simple sauvegarde (sans l’historique d’un échange) : je réunis les deux copies sans rien supprimer.'),
        h('p', { class: 'doux' }, 'Tes ajouts sont tous gardés. Tu pourras annuler juste après.'),
        h(
          'div',
          { class: 'rangee droite' },
          h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Annuler'),
          h(
            'button',
            {
              class: 'bouton bouton-jaune',
              type: 'button',
              onclick: async () => {
                fermer();
                const avant = JSON.parse(JSON.stringify(store.lire()));
                const pointAvant = await S.lirePoint();
                await store.remplacer(prep.fusionnee);
                await S.memoriserPoint(fichier.donnees);
                notifier('Fusion terminée ✦', {
                  duree: 12000,
                  action: {
                    label: 'Annuler',
                    fn: async () => {
                      await store.remplacer(avant);
                      await S.memoriserPoint(pointAvant);
                      notifier('Fusion annulée.');
                    },
                  },
                });
                redessiner?.();
              },
            },
            prep.rienDeNouveau ? 'Mettre à jour' : 'Fusionner'
          )
        )
      ),
  });
}

function choisirFichierFusion(redessiner) {
  const champ = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  champ.addEventListener('change', async () => {
    const f = champ.files?.[0];
    champ.remove();
    if (!f) return;
    let texte;
    try {
      texte = await f.text();
    } catch {
      notifier('Impossible de lire ce fichier.');
      return;
    }
    const lu = S.lireFichier(texte);
    if (lu.erreurs) {
      ouvrirModale({
        titre: 'Fichier non reconnu',
        couleur: 'corail',
        corps: (fermer) =>
          h(
            'div',
            { class: 'pile' },
            h('ul', { class: 'liste-puces' }, lu.erreurs.map((e) => h('li', null, e))),
            h('p', { class: 'doux' }, 'Rien n’a été modifié.'),
            h('div', { class: 'rangee droite' }, h('button', { class: 'bouton', type: 'button', onclick: fermer }, 'Fermer'))
          ),
      });
      return;
    }
    proposerFusion(lu, f.name, redessiner);
  });
  document.body.append(champ);
  champ.click();
}

function blocEntreAppareils(redessiner) {
  return h(
    'div',
    { class: 'pile bloc-synchro' },
    h('h3', null, '🔁 Entre le téléphone et l’ordinateur'),
    h('p', { class: 'doux' }, `Les deux appareils ont chacun leur copie. Pour les réunir : envoie ta copie ${versAutreAppareil()}, puis, là-bas, « Fusionner un fichier ». Tout ce que tu as noté des deux côtés est gardé.`),
    h(
      'div',
      { class: 'rangee rangee-souple' },
      h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: envoyerALAutreAppareil }, `📤 Envoyer ${versAutreAppareil()}`),
      h('button', { class: 'bouton', type: 'button', onclick: () => choisirFichierFusion(redessiner) }, '🔀 Fusionner un fichier')
    ),
    h('p', { class: 'meta' }, 'Sur iPhone, « Envoyer » ouvre la feuille de partage : choisis AirDrop vers ton Mac. Sur le Mac, le fichier arrive dans Téléchargements.')
  );
}

// Les copies de sécurité gardées dans le téléphone (une par jour, 7 jours).
function copiesLocales(redessiner) {
  const zone = h('div', { class: 'pile pile-serre' });
  store.sauvegardesLocales().then((liste) => {
    if (liste.length === 0) {
      zone.replaceChildren(h('p', { class: 'doux' }, 'Pas encore de copie automatique : la première est faite à ta prochaine modification.'));
      return;
    }
    zone.replaceChildren(
      ...[
        h('p', { class: 'doux' }, 'Une copie est faite chaque jour dans cet appareil (les 7 dernières sont gardées).'),
        ...liste.map((c) =>
          h(
            'div',
            { class: 'ligne ligne-simple' },
            h('span', { class: 'rdv-heure mono' }, c.jour),
            h(
              'button',
              {
                class: 'bouton bouton-petit',
                type: 'button',
                onclick: async () => {
                  const oui = await confirmer({
                    titre: 'Restaurer cette copie ?',
                    message: `Tes données actuelles seront remplacées par celles du ${c.jour}. Tu pourras annuler tout de suite après.`,
                    oui: 'Restaurer',
                    couleur: 'orange',
                  });
                  if (!oui) return;
                  const avant = JSON.parse(JSON.stringify(store.lire()));
                  await store.remplacer(c.donnees);
                  notifier('Copie restaurée ✦', { duree: 12000, action: { label: 'Annuler', fn: () => store.remplacer(avant) } });
                  redessiner?.();
                },
              },
              'Restaurer'
            )
          )
        ),
      ]
    );
  });
  return zone;
}

function contenuSauvegarde(redessiner) {
  const autonome = store.modeStockage() === 'autonome';
  return h(
    'div',
    { class: 'pile' },
    autonome
      ? h('p', null, 'Tes données sont gardées dans cet appareil, rien n’est envoyé sur internet.')
      : h('p', null, 'Tes données sont dans un seul fichier sur ton ordinateur : ', h('code', null, 'donnees/dashboard.json'), '.'),
    autonome
      ? copiesLocales(redessiner)
      : h('p', { class: 'doux' }, 'Une copie automatique est faite chaque jour dans ', h('code', null, 'sauvegardes/'), ' (les 14 dernières sont gardées).'),
    h(
      'div',
      { class: 'rangee rangee-souple' },
      h('button', { class: 'bouton bouton-jaune', type: 'button', onclick: exporter }, '⬇ Télécharger une sauvegarde'),
      h('button', { class: 'bouton', type: 'button', onclick: choisirFichierSauvegarde }, '⬆ Importer une sauvegarde')
    ),
    h('p', { class: 'doux' }, 'Ce fichier contient tes données personnelles, y compris de santé : range-le avec soin.'),
    blocEntreAppareils(redessiner)
  );
}

// ---- Sur mon téléphone ----

// Le QR code et l'adresse viennent du petit serveur, qui ne les donne qu'à l'ordinateur lui-même.
function contenuTelephone(redessiner) {
  const zone = h('div', { class: 'pile' }, h('p', { class: 'doux' }, '…'));

  const consignes = () =>
    h(
      'div',
      { class: 'pile' },
      h('p', null, 'Pour ouvrir le dashboard sur ton téléphone, il faut le lancer d’une autre façon, une fois, depuis ton ordinateur :'),
      h(
        'ol',
        { class: 'liste-numerotee' },
        h('li', null, 'Ferme la fenêtre noire du dashboard (ou appuie sur Ctrl + C dedans).'),
        h('li', null, ['Dans le dossier ', h('strong', null, 'mon-dashboard'), ', double-clique sur ', h('strong', null, '« Lancer sur le telephone »'), '.']),
        h('li', null, 'Reviens sur cette page : un QR code apparaît ici (et dans la fenêtre noire).'),
        h('li', null, 'Scanne-le avec l’appareil photo du téléphone, branché sur le même Wi-Fi.')
      ),
      h('p', { class: 'doux' }, 'Le premier lancement fait peut-être apparaître une question de l’ordinateur sur les connexions entrantes : réponds « Autoriser ».')
    );

  const regles = () =>
    h(
      'div',
      { class: 'pile pile-serre' },
      h('p', { class: 'meta' }, '🔒 Seul un appareil qui a le QR code (la clé secrète) peut ouvrir le dashboard. Sans lui, rien n’est visible.'),
      h('p', { class: 'meta' }, '📶 Le téléphone doit être sur le même Wi-Fi que l’ordinateur, et l’ordinateur doit être allumé avec la fenêtre noire ouverte.'),
      h('p', { class: 'meta' }, '☕ N’utilise pas ce mode sur un Wi-Fi public (café, gare, hôtel).')
    );

  const afficher = (infos) => {
    if (!infos.actif) {
      zone.replaceChildren(consignes());
      return;
    }
    if (infos.adresses.length === 0) {
      zone.replaceChildren(h('p', null, 'Je ne trouve pas de connexion au réseau de la maison. Vérifie que l’ordinateur est connecté au Wi-Fi, puis relance.'));
      return;
    }
    const [adresse, ...autres] = infos.adresses;
    let svg = '';
    try {
      svg = qrEnSvg(genererQr(adresse, { niveau: 'M' }), { pixel: 6, marge: 3 });
    } catch {
      // l'adresse écrite en dessous suffit
    }
    const qr = h('div', { class: 'telephone-qr', 'aria-label': 'QR code à scanner avec le téléphone' });
    qr.innerHTML = svg; // un dessin fabriqué par le dashboard lui-même : que des chiffres et des tracés
    zone.replaceChildren(
      ...[
      h('p', { class: 'telephone-etat' }, '✅ Le mode téléphone est actif.'),
      h('p', null, 'Scanne ce QR code avec l’appareil photo du téléphone :'),
      qr,
      h('p', { class: 'meta mono telephone-lien' }, adresse.replace(/\?cle=.*/, '?cle=…')),
      h(
        'div',
        { class: 'rangee rangee-souple' },
        h(
          'button',
          {
            class: 'bouton bouton-petit',
            type: 'button',
            onclick: async () => {
              try {
                await navigator.clipboard.writeText(adresse);
                notifier('Lien copié ✦ Colle-le dans un message pour te l’envoyer.');
              } catch {
                notifier('Je n’ai pas pu copier : scanne plutôt le QR code.');
              }
            },
          },
          '📋 Copier le lien'
        ),
        h(
          'button',
          {
            class: 'bouton bouton-petit',
            type: 'button',
            onclick: async () => {
              const oui = await confirmer({
                titre: 'Changer la clé secrète ?',
                message: 'Les téléphones déjà connectés devront scanner le nouveau QR code. Fais-le si tu as perdu un appareil ou partagé le lien par erreur.',
                oui: 'Changer la clé',
                couleur: 'orange',
              });
              if (!oui) return;
              try {
                const r = await fetch('/api/telephone/renouveler', { method: 'POST' });
                if (!r.ok) throw new Error('refusé');
                notifier('Nouvelle clé créée ✦');
                afficher(await r.json());
              } catch {
                notifier('Je n’ai pas pu changer la clé.');
              }
            },
          },
          '🔑 Changer la clé'
        )
      ),
      autres.length > 0 && h('p', { class: 'meta' }, `Si le premier QR code ne marche pas, l’ordinateur a d’autres adresses (${autres.length}) : ouvre l’une de celles-ci à la place, depuis le terminal noir.`),
      regles(),
      ].filter(Boolean)
    );
  };

  fetch('/api/telephone', { cache: 'no-store' })
    .then((r) => {
      if (r.status === 403) {
        zone.replaceChildren(h('p', null, 'Ce réglage se fait depuis l’ordinateur, pas depuis le téléphone.'));
        return null;
      }
      // Un dashboard lancé avant cette nouveauté ne connaît pas encore le mode téléphone : mêmes consignes.
      if (r.status === 404) return { actif: false, adresses: [] };
      if (!r.ok) throw new Error('indisponible');
      return r.json();
    })
    .then((infos) => infos && afficher(infos))
    .catch(() => zone.replaceChildren(h('p', null, 'Je n’arrive pas à lire cet état pour l’instant.')));

  return zone;
}

function contenuCategories(donnees) {
  return h(
    'div',
    { class: 'pile' },
    h('p', { class: 'doux' }, "Chaque catégorie garde sa couleur partout. « Masquer » la retire du dashboard sans rien effacer."),
    h('ul', { class: 'liste-simple' }, donnees.categories.map(ligneCategorie)),
    h('h3', null, 'Ajouter une catégorie'),
    formulaireNouvelleCategorie()
  );
}

// ---- La page : des cartes, une seule ouverte à la fois ----

let sectionOuverte = null;

function rendre(racine, { redessiner }) {
  const donnees = store.lire();
  const r = donnees.reglages.checkin;
  const SECTIONS = [
    {
      id: 'categories',
      icone: '🎨',
      titre: 'Mes catégories',
      resume: `${donnees.categories.filter((c) => !c.archivee).length} catégories`,
      couleur: 'turquoise',
      contenu: () => contenuCategories(donnees),
    },
    {
      id: 'checkin',
      icone: '🌤️',
      titre: 'Check-in du jour',
      resume: r.actif ? `Proposé à partir de ${r.heure}` : 'Désactivé',
      couleur: 'rose',
      contenu: () => contenuRappelCheckin(donnees),
    },
    store.modeStockage() === 'serveur' && {
      id: 'telephone',
      icone: '📱',
      titre: 'Sur mon téléphone',
      resume: 'Ouvrir le dashboard depuis le téléphone',
      couleur: 'ciel',
      contenu: () => contenuTelephone(redessiner),
    },
    {
      id: 'sauvegarde',
      icone: '💾',
      titre: 'Sauvegarde',
      resume: store.modeStockage() === 'autonome' ? 'Copies, fusion avec l’ordinateur' : 'Copie automatique, fusion avec le téléphone',
      couleur: 'orange',
      contenu: () => contenuSauvegarde(redessiner),
    },
  ].filter(Boolean);
  const ouverte = SECTIONS.find((x) => x.id === sectionOuverte);

  racine.replaceChildren(
    h(
      'div',
      { class: 'page' },
      h('header', { class: 'entete-page' }, h('div', null, h('h1', null, 'Réglages'), h('p', { class: 'sous-titre' }, 'Ton dashboard, à ta façon.'))),
      ouverte
        ? h(
            'div',
            { class: 'pile pile-large' },
            h('div', null, h('button', { class: 'bouton bouton-petit', type: 'button', onclick: () => { sectionOuverte = null; redessiner(); } }, '← Tous les réglages')),
            h(
              'section',
              { class: 'fenetre', style: `--cat: var(--${ouverte.couleur})` },
              h('div', { class: 'fenetre-barre' }, pastilles(), h('h2', { class: 'fenetre-titre' }, `${ouverte.icone} ${ouverte.titre}`)),
              h('div', { class: 'fenetre-corps' }, ouverte.contenu())
            )
          )
        : h(
            'div',
            { class: 'grille-zones' },
            SECTIONS.map((x) =>
              h(
                'button',
                { class: 'carte-zone', type: 'button', onclick: () => { sectionOuverte = x.id; redessiner(); } },
                h('span', { class: 'carte-zone-icone', 'aria-hidden': 'true' }, x.icone),
                h('span', { class: 'carte-zone-texte' }, h('strong', null, x.titre), h('span', { class: 'meta' }, x.resume))
              )
            )
          )
    )
  );
}

enregistrerPage('reglages', rendre);
