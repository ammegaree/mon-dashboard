// Petites briques d'interface réutilisables.

// h('div', { class: 'carte' }, 'texte', h('span', ...))
export function h(tag, props, ...enfants) {
  const el = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(props || {})) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === 'class') el.className = valeur;
    else if (cle.startsWith('on') && typeof valeur === 'function') {
      el.addEventListener(cle.slice(2).toLowerCase(), valeur);
    } else if (cle.startsWith('aria-') || cle.startsWith('data-') || cle === 'role' || cle === 'for' || cle === 'style') {
      el.setAttribute(cle, valeur === true ? '' : valeur);
    } else if (cle in el) el[cle] = valeur;
    else el.setAttribute(cle, valeur === true ? '' : valeur);
  }
  ajouterEnfants(el, enfants);
  return el;
}

function ajouterEnfants(parent, enfants) {
  for (const enfant of enfants) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    if (Array.isArray(enfant)) ajouterEnfants(parent, enfant);
    else if (enfant instanceof Node) parent.appendChild(enfant);
    else parent.appendChild(document.createTextNode(String(enfant)));
  }
}

export function vider(el) {
  el.replaceChildren();
}

const reduireMouvement = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Fenêtres (style rétro) ----

export function pastilles() {
  return h('span', { class: 'pastilles', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
}

// Ouvre une fenêtre par-dessus la page. `corps` : un élément, ou une fonction (fermer) => élément.
export function ouvrirModale({ titre, couleur = 'jaune', corps, large = false }) {
  const dialogue = h('dialog', { class: 'modale' + (large ? ' modale-large' : ''), style: `--cat: var(--${couleur})` });
  const ecouteurs = new Set();
  let termine = false;

  // Appelée une seule fois, que la fenêtre se ferme par un bouton, la touche Échap ou un clic à côté.
  const finaliser = () => {
    if (termine) return;
    termine = true;
    dialogue.remove();
    ecouteurs.forEach((f) => f());
  };
  const fermer = () => {
    if (dialogue.open) dialogue.close();
    finaliser();
  };

  const contenu = typeof corps === 'function' ? corps(fermer) : corps;
  dialogue.append(
    h(
      'div',
      { class: 'fenetre-barre' },
      pastilles(),
      h('strong', { class: 'fenetre-titre' }, titre),
      h('button', { class: 'bouton-fermer', type: 'button', 'aria-label': 'Fermer', onclick: fermer }, '✕')
    ),
    h('div', { class: 'modale-corps' }, contenu)
  );
  dialogue.addEventListener('close', finaliser);
  dialogue.addEventListener('click', (e) => {
    if (e.target === dialogue) fermer();
  });
  document.body.appendChild(dialogue);
  dialogue.showModal();
  // surFermeture(fn) : fn est appelée quand la fenêtre se ferme, quelle que soit la façon.
  return { fermer, element: dialogue, surFermeture: (f) => ecouteurs.add(f) };
}

export function confirmer({ titre, message, oui = 'Oui', non = 'Annuler', couleur = 'corail' }) {
  return new Promise((resolve) => {
    let reponse = false;
    const { surFermeture } = ouvrirModale({
      titre,
      couleur,
      corps: (fermer) =>
        h(
          'div',
          { class: 'pile' },
          h('p', null, message),
          h(
            'div',
            { class: 'rangee droite' },
            h('button', { class: 'bouton', type: 'button', onclick: fermer }, non),
            h(
              'button',
              {
                class: 'bouton bouton-corail',
                type: 'button',
                onclick: () => {
                  reponse = true;
                  fermer();
                },
              },
              oui
            )
          )
        ),
    });
    surFermeture(() => resolve(reponse));
  });
}

// ---- Petits messages ----

let zoneMessages = null;

export function notifier(message, { action = null, duree = 6000 } = {}) {
  if (!zoneMessages) {
    zoneMessages = h('div', { class: 'messages', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(zoneMessages);
  }
  const carte = h('div', { class: 'message' }, h('span', null, message));
  const retirer = () => carte.remove();
  if (action) {
    carte.append(
      h(
        'button',
        {
          class: 'bouton bouton-petit',
          type: 'button',
          onclick: () => {
            action.fn();
            retirer();
          },
        },
        action.label
      )
    );
  }
  zoneMessages.appendChild(carte);
  setTimeout(retirer, duree);
}

// ---- Petites touches gratifiantes ----

const COULEURS_FETE = ['#FF6B5B', '#FFD84D', '#36CDB8', '#A184F0', '#FF9FCB', '#6DB9F5', '#FF9B4A'];

// Petites étoiles qui jaillissent d'une case qu'on vient de cocher.
export function etincelles(el) {
  if (reduireMouvement() || !el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < 7; i++) {
    const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
    const distance = 28 + Math.random() * 22;
    const etoile = h('span', { class: 'etincelle', 'aria-hidden': 'true' }, '✦');
    etoile.style.left = `${cx}px`;
    etoile.style.top = `${cy}px`;
    etoile.style.color = COULEURS_FETE[i % COULEURS_FETE.length];
    etoile.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    etoile.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    document.body.appendChild(etoile);
    setTimeout(() => etoile.remove(), 800);
  }
}

// Pluie de confettis pour la journée terminée.
export function confettis() {
  if (reduireMouvement()) return;
  const largeur = window.innerWidth;
  for (let i = 0; i < 46; i++) {
    const piece = h('span', { class: 'confetti', 'aria-hidden': 'true' });
    piece.style.left = `${Math.random() * largeur}px`;
    piece.style.background = COULEURS_FETE[i % COULEURS_FETE.length];
    piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.animationDuration = `${1.4 + Math.random() * 0.9}s`;
    if (i % 3 === 0) piece.style.borderRadius = '50%';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2800);
  }
}
