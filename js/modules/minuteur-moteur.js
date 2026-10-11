// Moteur du minuteur de concentration (sessions de travail + pauses).
// Il ne connaît ni la page ni le stockage : on lui donne l'heure, et il prévient
// quand une session de travail est terminée (ou arrêtée) pour qu'on l'enregistre.
// Il compte avec des horodatages, donc il reste juste même si l'onglet est en veille.

const SEUIL_ENREGISTREMENT_MS = 60 * 1000; // en dessous d'une minute, on n'enregistre rien
const TOLERANCE_REPRISE_MS = 5 * 60 * 1000; // au rechargement : fin ratée de moins de 5 min

export class MoteurMinuteur {
  constructor({ maintenant = () => Date.now(), surFinTravail = () => {}, surChangement = () => {} } = {}) {
    this.maintenant = maintenant;
    this.surFinTravail = surFinTravail;
    this.surChangement = surChangement;
    this.etat = this._vide();
  }

  _vide() {
    return {
      phase: 'inactif', // 'inactif' | 'travail' | 'pause'
      enPause: false, // en pause (le compte à rebours est gelé)
      finA: null, // horodatage de fin de la phase (quand ça tourne)
      restantMs: 0, // temps restant (quand c'est gelé)
      dureePhaseMs: 0,
      chapitreId: null,
      debutISO: null,
      travailMin: 25,
      pauseMin: 5,
    };
  }

  // ---- Lecture ----

  restant() {
    const e = this.etat;
    if (e.phase === 'inactif') return 0;
    if (e.enPause) return e.restantMs;
    return Math.max(0, e.finA - this.maintenant());
  }

  ecoule() {
    return this.etat.dureePhaseMs - this.restant();
  }

  actif() {
    return this.etat.phase !== 'inactif';
  }

  // ---- Actions ----

  demarrer({ chapitreId = null, travailMin = 25, pauseMin = 5 } = {}) {
    const t = Math.max(1, Math.round(travailMin));
    const now = this.maintenant();
    this.etat = {
      phase: 'travail',
      enPause: false,
      finA: now + t * 60000,
      restantMs: 0,
      dureePhaseMs: t * 60000,
      chapitreId,
      debutISO: new Date(now).toISOString(),
      travailMin: t,
      pauseMin: Math.max(0, Math.round(pauseMin)),
    };
    this.surChangement('demarrage');
  }

  basculerPause() {
    const e = this.etat;
    if (e.phase === 'inactif') return;
    if (e.enPause) {
      e.finA = this.maintenant() + e.restantMs;
      e.enPause = false;
    } else {
      e.restantMs = this.restant();
      e.enPause = true;
    }
    this.surChangement(e.enPause ? 'gel' : 'reprise');
  }

  // Arrête la session en cours. Le temps déjà travaillé est enregistré (si ≥ 1 min).
  arreter() {
    const e = this.etat;
    let secondes = 0;
    if (e.phase === 'travail') {
      const ecoule = this.ecoule();
      if (ecoule >= SEUIL_ENREGISTREMENT_MS) {
        secondes = Math.round(ecoule / 1000);
        this.surFinTravail({ chapitreId: e.chapitreId, debutISO: e.debutISO, secondes });
      }
    }
    this.etat = { ...this._vide(), travailMin: e.travailMin, pauseMin: e.pauseMin, chapitreId: e.chapitreId };
    this.surChangement('arret');
    return secondes;
  }

  passerPause() {
    if (this.etat.phase !== 'pause') return;
    const e = this.etat;
    this.etat = { ...this._vide(), travailMin: e.travailMin, pauseMin: e.pauseMin, chapitreId: e.chapitreId };
    this.surChangement('fin-pause');
  }

  // À appeler régulièrement : fait avancer les phases quand le temps est écoulé.
  tick() {
    const e = this.etat;
    if (e.phase === 'inactif' || e.enPause) return;
    if (this.restant() > 0) {
      this.surChangement('tick');
      return;
    }
    this._terminerPhase();
  }

  _terminerPhase() {
    const e = this.etat;
    if (e.phase === 'travail') {
      this.surFinTravail({ chapitreId: e.chapitreId, debutISO: e.debutISO, secondes: Math.round(e.dureePhaseMs / 1000) });
      if (e.pauseMin > 0) {
        const now = this.maintenant();
        this.etat = {
          ...e,
          phase: 'pause',
          enPause: false,
          finA: now + e.pauseMin * 60000,
          dureePhaseMs: e.pauseMin * 60000,
          restantMs: 0,
          debutISO: null,
        };
      } else {
        this.etat = { ...this._vide(), travailMin: e.travailMin, pauseMin: e.pauseMin, chapitreId: e.chapitreId };
      }
      this.surChangement('fin-travail');
    } else {
      this.etat = { ...this._vide(), travailMin: e.travailMin, pauseMin: e.pauseMin, chapitreId: e.chapitreId };
      this.surChangement('fin-pause');
    }
  }

  // ---- Sauvegarde / reprise (le minuteur survit à un rechargement de la page) ----

  exporter() {
    return { ...this.etat };
  }

  restaurer(sauvegarde) {
    if (!sauvegarde || typeof sauvegarde !== 'object' || !sauvegarde.phase) return;
    this.etat = { ...this._vide(), ...sauvegarde };
    const e = this.etat;
    if (e.phase === 'inactif') return;
    if (e.enPause) {
      this.surChangement('reprise-page');
      return;
    }
    const retard = this.maintenant() - e.finA;
    if (retard <= 0) {
      this.surChangement('reprise-page');
      return;
    }
    // La phase s'est terminée pendant que la page était fermée.
    if (e.phase === 'travail' && retard <= TOLERANCE_REPRISE_MS) {
      this._terminerPhase();
    } else {
      this.etat = { ...this._vide(), travailMin: e.travailMin, pauseMin: e.pauseMin, chapitreId: e.chapitreId };
      this.surChangement('abandon-reprise');
    }
  }
}

export function formaterCompteARebours(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
