// Storm Runner — missions. One sortie, one goal, and the bookkeeping that
// turns flying into decisions: rings threaded, a crate on the mark, a strip
// reached before the tanks run dry.
import { CONFIG, MISSIONS } from './config.js';

export class Crate {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.landed = false;
    this.onTarget = false;
    this.restY = 0;
  }

  step(dt, valley) {
    if (this.landed) return;
    // A heavy crate with a drogue: it falls fast and sheds forward speed,
    // so the pilot must release it a little before the mark, not over it.
    this.vy -= 9.8 * dt * 1.4;
    this.vx *= 1 - 0.3 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const ground = valley.heightAt(this.x);
    if (this.y <= ground) {
      this.y = ground;
      this.landed = true;
      this.restY = ground;
      this.onTarget = this.x >= valley.dropZone.x0 && this.x <= valley.dropZone.x1;
    }
  }
}

export class MissionRun {
  constructor(mission, valley) {
    this.mission = mission;
    this.valley = valley;
    this.rings = valley.rings.slice(0, mission.id === 'ring-run' ? 8 : mission.id === 'supply-drop' ? 4 : 3);
    this.rings.forEach((ring) => {
      ring.passed = false;
    });
    this.ringsPassed = 0;
    this.crate = null;
    this.crateDropped = false;
    this.crateOnTarget = false;
    this.elapsed = 0;
    this.score = 0;
    this.finished = false;
    this.result = '';
    this.resultDetail = '';
    this.landingSoftness = 0;
  }

  get nextRing() {
    return this.rings.find((ring) => !ring.passed) ?? null;
  }

  get objectiveText() {
    if (this.mission.goal === 'rings') return `Rings ${this.ringsPassed}/${this.rings.length} — then land on the far strip`;
    if (this.mission.goal === 'drop') {
      if (!this.crateDropped) return 'Drop the crate on the marked field (SPACE)';
      if (this.crate && !this.crate.landed) return 'Crate away — watch where it lands';
      return this.crateOnTarget ? 'Crate on target — now land on the far strip' : 'Crate missed the field — land and try again';
    }
    return 'Land on the far strip before the storm eats your fuel';
  }

  // Called every frame with the plane and the flight event of the step.
  update(dt, plane, event) {
    if (this.finished) return;
    this.elapsed += dt;

    for (const ring of this.rings) {
      if (ring.passed) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const distance = Math.hypot(dx, dy);
      if (distance < ring.radius && Math.abs(plane.speed) > 12) {
        ring.passed = true;
        this.ringsPassed += 1;
        this.score += CONFIG.RING_POINTS;
      }
    }

    if (this.crate) {
      this.crate.step(dt, this.valley);
      if (this.crate.landed && !this.crateDropped) this.crateDropped = true;
      if (this.crate.landed && this.crate.onTarget && !this.crateOnTarget) {
        this.crateOnTarget = true;
        this.score += CONFIG.DROP_POINTS;
      }
    }

    if (event === 'landed' && this.valley.isFarStrip(plane.x)) {
      const goalDone =
        this.mission.goal === 'rings'
          ? this.ringsPassed === this.rings.length
          : this.mission.goal === 'drop'
            ? this.crateOnTarget
            : true;
      if (!goalDone) {
        this.result = 'landed-early';
        this.resultDetail =
          this.mission.goal === 'rings'
            ? `You landed with ${this.rings.length - this.ringsPassed} ring(s) still unflown.`
            : 'The crate never made the marked field.';
        this.finished = true;
        return;
      }
      this.landingSoftness = Math.max(0, 100 - Math.abs(plane.verticalSpeed) * 12 - Math.max(0, plane.speed - 30) * 1.2);
      const timeBonus = Math.max(0, Math.round((this.mission.parSeconds - this.elapsed) * CONFIG.TIME_BONUS_PER_SECOND));
      this.score += CONFIG.LANDING_POINTS + Math.round(this.landingSoftness) + timeBonus;
      this.finished = true;
      this.result = 'complete';
      this.resultDetail = `Landed soft (${Math.round(this.landingSoftness)}%) with ${timeBonus} time bonus.`;
      return;
    }

    if (event === 'landed' && !this.valley.isFarStrip(plane.x)) {
      // Put down on the home strip again: a safe abort, not a finish.
      this.result = 'aborted';
      this.resultDetail = 'You put her back down at home. The valley is still out there.';
      this.finished = true;
    }
  }

  dropCrate(plane) {
    if (this.crate || plane.onGround) return false;
    this.crate = new Crate(plane.x, plane.y - 6, plane.speed * Math.cos(plane.pitch), plane.speed * Math.sin(plane.pitch) - 2);
    this.crateDropped = true;
    return true;
  }

  fail(reason, detail) {
    if (this.finished) return;
    this.finished = true;
    this.result = 'failed';
    this.resultDetail = detail || reason;
  }
}

export function missionById(id) {
  return MISSIONS.find((mission) => mission.id === id) ?? MISSIONS[0];
}
