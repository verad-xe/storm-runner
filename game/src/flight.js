// Storm Runner — the bush plane itself: what it is, how it flies, and what
// happens when it meets the ground. The model is arcade on purpose — one
// speed, one pitch angle, throttle — but every decision costs something:
// climbing bleeds speed, speed below the stall line sinks, fuel burns with
// throttle, and a hard touch costs airframe.
import { CONFIG } from './config.js';
import { clamp } from './terrain.js';

// Wind gusts: a slow swell plus a faster chop, both seeded, so the same
// mission always gusts the same way. Stronger high up and in the pass.
export function windAt(time, altitude, mission, x) {
  const base = mission.windBase;
  const gust = mission.windGust;
  const swell = Math.sin(time * 0.31 + x * 0.0004) * 0.7 + Math.sin(time * 0.13) * 0.3;
  const chop = Math.sin(time * 1.7 + x * 0.0021) * 0.45 + Math.sin(time * 2.9) * 0.25;
  const heightFactor = 0.6 + Math.min(1, altitude / 400) * 0.7;
  const passFactor = x > CONFIG.PASS_START_X && x < CONFIG.PASS_END_X ? 1.25 : 1;
  return {
    x: -(base + gust * swell * 0.6) * heightFactor * passFactor,
    y: gust * chop * 0.55 * heightFactor,
    strength: Math.abs(base + gust * swell * 0.6) * heightFactor,
  };
}

export class Plane {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 60;
    this.y = 2;
    this.speed = 0;
    this.pitch = 0;
    this.throttle = 0;
    this.fuel = CONFIG.FUEL_CAPACITY;
    this.damage = 0;
    this.onGround = true;
    this.landed = false;
    this.crashed = false;
    this.crashReason = '';
    this.verticalSpeed = 0;
    this.propAngle = 0;
    this.time = 0;
  }

  get altitude() {
    return this.y;
  }

  get headingDegrees() {
    // East is 090; pitch up toward north reads as a smaller heading number.
    const heading = 90 - (this.pitch * 180) / Math.PI;
    return Math.round(((heading % 360) + 360) % 360);
  }

  // One physics step. `input` carries pitchUp/pitchDown/throttleUp/
  // throttleDown booleans and a mouse-steer pitch target (or null).
  // Returns an event string ('takeoff', 'landed', 'hard-landing',
  // 'crashed-terrain', 'crashed-water', 'fuel-empty') or ''.
  step(dt, input, valley, mission) {
    this.time += dt;
    if (this.crashed || this.landed) return '';

    const wind = windAt(this.time, this.y, mission, this.x);
    this.wind = wind;

    if (input.throttleUp) this.throttle = clamp(this.throttle + dt * 0.9, 0, 1);
    if (input.throttleDown) this.throttle = clamp(this.throttle - dt * 0.9, 0, 1);
    if (this.fuel <= 0) this.throttle = 0;

    // Pitch is trimmed, not spring-loaded: it stays where the pilot leaves
    // it until they move the stick or the mouse again, so a climb set
    // during the take-off roll is still there when the wing starts flying.
    let pitchTarget = this.pitch;
    if (input.mousePitch !== null && input.mousePitch !== undefined) {
      pitchTarget = input.mousePitch;
    } else if (input.pitchUp) {
      pitchTarget = CONFIG.MAX_PITCH_UP;
    } else if (input.pitchDown) {
      pitchTarget = CONFIG.MAX_PITCH_DOWN;
    }
    const pitchRate = CONFIG.PITCH_RATE * (this.onGround ? 0.35 : 1);
    this.pitch += clamp(pitchTarget - this.pitch, -pitchRate * dt, pitchRate * dt);
    this.pitch = clamp(this.pitch, CONFIG.MAX_PITCH_DOWN, CONFIG.MAX_PITCH_UP);

    // Thrust along the nose, drag against the air, gravity against a climb.
    const thrust = this.throttle * CONFIG.THRUST;
    const drag = CONFIG.DRAG * this.speed;
    const climbBleed = CONFIG.CLIMB_BLEED * Math.sin(this.pitch);
    this.speed += (thrust - drag - climbBleed) * dt;
    this.speed = clamp(this.speed, 0, CONFIG.MAX_SPEED);

    // Below the stall line the wing stops flying and the plane sinks.
    const sink = this.speed < CONFIG.STALL_SPEED ? (CONFIG.STALL_SPEED - this.speed) * CONFIG.SINK_RATE : 0;

    const vx = this.speed * Math.cos(this.pitch) + wind.x * 0.35;
    const vy = this.speed * Math.sin(this.pitch) + wind.y * 0.35 - sink;
    this.verticalSpeed = vy;
    this.x += vx * dt;
    this.y += vy * dt;
    this.propAngle += (2 + this.throttle * 26) * dt;

    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - this.throttle * CONFIG.FUEL_BURN * dt);
      if (this.fuel <= 0) return 'fuel-empty';
    }

    if (this.x < -260) this.x = -260;
    if (this.x > CONFIG.WORLD_LENGTH) this.x = CONFIG.WORLD_LENGTH;

    const ground = valley.heightAt(this.x);
    const clearance = this.y - ground;
    if (clearance <= 0) return this.touchGround(valley, ground);
    if (this.onGround && this.speed > 34 && this.pitch > 0.02) {
      this.onGround = false;
      return 'takeoff';
    }
    return '';
  }

  touchGround(valley, ground) {
    this.y = ground;
    const wasFlying = !this.onGround;
    this.onGround = true;
    if (!wasFlying) return '';
    const vspeed = Math.abs(this.verticalSpeed);
    const overRunway = valley.isRunway(this.x);
    const inRiver =
      Math.abs(this.x - CONFIG.RIVER_X) < CONFIG.RIVER_WIDTH / 2 && ground < 0;
    if (inRiver) {
      this.crashed = true;
      this.crashReason = 'ditched in the river';
      return 'crashed-water';
    }
    if (!overRunway) {
      this.crashed = true;
      this.crashReason = 'flew into the mountainside';
      return 'crashed-terrain';
    }
    if (vspeed > CONFIG.HARD_TOUCHDOWN_VSPEED || this.speed > CONFIG.SAFE_TOUCHDOWN_SPEED + 26) {
      this.crashed = true;
      this.crashReason = 'came down too hard on the strip';
      return 'crashed-terrain';
    }
    if (vspeed > CONFIG.SAFE_TOUCHDOWN_VSPEED || this.speed > CONFIG.SAFE_TOUCHDOWN_SPEED) {
      this.damage += 18 + vspeed * 2;
      this.speed *= 0.55;
      if (this.damage >= CONFIG.CRASH_DAMAGE) {
        this.crashed = true;
        this.crashReason = 'the airframe gave out on a hard landing';
        return 'crashed-terrain';
      }
      return 'hard-landing';
    }
    this.landed = true;
    this.speed = Math.max(0, this.speed - 30);
    return 'landed';
  }

  // Bleed speed on the ground after a landing, so the plane rolls out
  // instead of stopping dead.
  rollOut(dt) {
    this.speed = Math.max(0, this.speed - 26 * dt);
    this.x += this.speed * dt;
    this.propAngle += (2 + this.throttle * 10) * dt;
    this.time += dt;
  }
}
