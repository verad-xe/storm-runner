// Storm Runner — the game itself: screens, the loop, and the wiring between
// the plane, the missions, the sound and the renderer. Play it with
// keyboard and mouse; open it with ?shot=title|rings|drop|land&seed=1 for a
// fixed, reproducible frame of the game.
import { CONFIG, MISSIONS } from './config.js';
import { Plane } from './flight.js';
import { MissionRun, missionById } from './missions.js';
import { Valley } from './terrain.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const SEED_DEFAULT = 20261126;

export class Game {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.seed = seed;
    this.valley = new Valley(seed);
    this.plane = new Plane();
    this.plane.fuel = MISSIONS[0].fuel;
    this.mission = new MissionRun(MISSIONS[0], this.valley);
    this.renderer = new Renderer(canvas);
    this.renderer.valley = this.valley;
    this.input = new Input(canvas);
    this.sounds = new SoundBank();
    this.screen = 'title';
    this.selectedMission = 0;
    this.endDetail = '';
    this.time = 0;
    this.accumulator = 0;
    this.lastTimestamp = 0;
    this.shotMode = false;
    this.statusElement = document.getElementById('status');
  }

  reset(seed) {
    this.seed = seed ?? this.seed;
    this.valley = new Valley(this.seed);
    this.plane = new Plane();
    this.plane.fuel = MISSIONS[this.selectedMission].fuel;
    this.mission = new MissionRun(MISSIONS[this.selectedMission], this.valley);
    this.renderer.valley = this.valley;
    this.screen = 'title';
    this.endDetail = '';
    this.time = 0;
  }

  startMission(index) {
    this.selectedMission = index;
    const mission = MISSIONS[index];
    this.plane = new Plane();
    this.plane.fuel = mission.fuel;
    this.mission = new MissionRun(mission, this.valley);
    this.screen = 'play';
    this.endDetail = '';
    this.sounds.unlock();
    this.sounds.click();
    this.announce(`${mission.name} started. ${mission.tagline}`);
  }

  dropCrate() {
    if (this.screen !== 'play') return;
    if (this.mission.dropCrate(this.plane)) {
      this.sounds.thump();
      this.announce('Crate away.');
    }
  }

  // One fixed step of the world. `silent` skips sounds (screenshot scenes).
  step(dt, input, silent = false) {
    this.time += dt;
    const event = this.plane.step(dt, input, this.valley, this.mission.mission);
    if (!silent) this.handleEvent(event);
    else this.handleEventSilent(event);
    this.mission.update(dt, this.plane, event);
    if (this.plane.crashed && !this.mission.finished) {
      this.mission.fail('crashed', `The plane ${this.plane.crashReason}.`);
    }
    if (this.plane.landed && !this.mission.finished) this.plane.rollOut(dt);
    this.renderer.particles.step(dt);
    if (!silent) {
      this.sounds.setFlightSound(this.plane.throttle, this.plane.speed, !this.plane.onGround);
      if (this.plane.throttle > 0.1 && !this.plane.onGround && Math.random() < 0.25) {
        this.renderer.particles.exhaust(this.plane);
      }
    }
    if (this.plane.onGround && this.plane.speed > 20 && Math.random() < 0.3) {
      this.renderer.particles.dust(this.plane.x, this.plane.y, 1);
    }
    return event;
  }

  handleEvent(event) {
    if (!event) return;
    if (event === 'takeoff') this.sounds.blip(660, 0.2, 'sine', 0.1);
    if (event === 'fuel-empty') this.announce('Fuel empty. Glide her in.');
    if (event === 'hard-landing') {
      this.sounds.thump();
      this.announce('Hard landing. The airframe took damage.');
    }
    if (event === 'landed') this.sounds.fanfare();
    if (event.startsWith('crashed')) this.sounds.crashSound();
  }

  handleEventSilent(event) {
    if (event && event.startsWith('crashed')) {
      this.renderer.particles.debris(this.plane.x, this.plane.y);
    }
  }

  // Screen transitions after a mission ends.
  finishCheck() {
    if (!this.mission.finished || this.screen !== 'play') return;
    if (this.mission.result === 'complete') {
      this.screen = 'complete';
      this.endDetail = this.mission.resultDetail;
      this.sounds.fanfare();
      this.announce(`Mission complete. ${this.mission.resultDetail} Score ${this.mission.score}.`);
    } else if (this.mission.result === 'failed' || this.plane.crashed) {
      this.screen = 'over';
      this.endDetail = this.plane.crashReason
        ? `The plane ${this.plane.crashReason}.`
        : this.mission.resultDetail;
      this.sounds.crashSound();
      this.renderer.particles.debris(this.plane.x, this.plane.y);
      this.announce(`Sortie lost. ${this.endDetail}`);
    } else {
      this.screen = 'over';
      this.endDetail = this.mission.resultDetail;
      this.announce(this.mission.resultDetail);
    }
  }

  announce(text) {
    if (this.statusElement) this.statusElement.textContent = text;
  }

  // Keys that change screens, checked once per frame.
  handleScreenKeys() {
    const input = this.input;
    if (this.screen === 'title') {
      if (input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('MouseClick')) {
        this.screen = 'select';
        this.sounds.unlock();
        this.sounds.click();
      }
      return;
    }
    if (this.screen === 'select') {
      if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
        this.selectedMission = (this.selectedMission + MISSIONS.length - 1) % MISSIONS.length;
        this.sounds.click();
      }
      if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
        this.selectedMission = (this.selectedMission + 1) % MISSIONS.length;
        this.sounds.click();
      }
      if (input.wasPressed('Enter') || input.wasPressed('Space')) this.startMission(this.selectedMission);
      if (input.wasPressed('Escape')) this.screen = 'title';
      return;
    }
    if (this.screen === 'play') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        this.screen = 'pause';
        this.sounds.click();
      }
      if (input.wasPressed('Space') || input.wasPressed('MouseClick')) this.dropCrate();
      if (input.wasPressed('KeyR')) this.startMission(this.selectedMission);
      if (input.wasPressed('KeyM')) {
        this.reset(this.seed);
        this.screen = 'select';
      }
      return;
    }
    if (this.screen === 'pause') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasPressed('Enter')) {
        this.screen = 'play';
        this.sounds.click();
      }
      if (input.wasPressed('KeyR')) this.startMission(this.selectedMission);
      return;
    }
    if (this.screen === 'over' || this.screen === 'complete') {
      if (input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('KeyR')) {
        this.startMission(this.selectedMission);
      }
      if (input.wasPressed('KeyM')) {
        this.reset(this.seed);
        this.screen = 'select';
      }
    }
  }

  frame(timestamp) {
    const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000 || STEP);
    this.lastTimestamp = timestamp;
    this.handleScreenKeys();
    if (this.screen === 'play') {
      this.accumulator += dt;
      while (this.accumulator >= STEP) {
        this.step(STEP, this.input.flightInput());
        this.accumulator -= STEP;
      }
      this.finishCheck();
    }
    this.renderer.updateCamera(this.plane, dt);
    this.renderer.render(
      {
        valley: this.valley,
        plane: this.plane,
        mission: this.mission,
        screen: this.screen,
        selectedMission: this.selectedMission,
        endDetail: this.endDetail,
      },
      this.time,
    );
    requestAnimationFrame((next) => this.frame(next));
  }

  // Screenshot mode: stage one fixed scene, draw it once, and keep drawing
  // the same frame so headless capture always sees the same picture.
  stageAndHold(shotName) {
    this.shotMode = true;
    const staged = stageShot(shotName, this);
    this.screen = staged.screen;
    this.renderer.shotMode = true;
    const camFrac = staged.camFrac ?? 0.55;
    this.renderer.updateCamera(this.plane, 1);
    this.renderer.camX = this.plane.x - 430;
    this.renderer.camTop = this.plane.y + this.renderer.height * camFrac;
    const renderOnce = () => {
      this.renderer.render(
        {
          valley: this.valley,
          plane: this.plane,
          mission: this.mission,
          screen: this.screen,
          selectedMission: this.selectedMission,
          endDetail: this.endDetail,
        },
        this.time,
      );
      requestAnimationFrame(renderOnce);
    };
    requestAnimationFrame(renderOnce);
  }
}

function seedFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  return Number.isFinite(seed) ? seed : SEED_DEFAULT;
}

function shotFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

const canvas = document.getElementById('game');
const game = new Game(canvas, seedFromQuery());
window.addEventListener('resize', () => game.renderer.resize());

const shot = shotFromQuery();
if (shot) {
  game.stageAndHold(shot);
} else {
  requestAnimationFrame((timestamp) => {
    game.lastTimestamp = timestamp;
    game.frame(timestamp);
  });
}
