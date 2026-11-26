// Storm Runner — screenshot scenes. Each scene replays the real rules
// forward from a fresh valley for a fixed number of steps, steered by a
// simple autopilot (point the nose at the next ring, hold a cruise speed,
// flare over the strip), so the frame is what a real sortie looks like and
// the same seed always gives the same frame.
import { CONFIG } from './config.js';
import { clamp } from './terrain.js';

const STEP = 1 / 60;
const TITLE_SECONDS = 6;
const RING_SECONDS = 55;
const DROP_SECONDS = 74;
const LAND_SECONDS = 215;

// Steer toward a point in the world: pitch up when the target is above the
// nose line, down when it is below, and hold the throttle near cruise.
function autopilotTo(plane, targetX, targetY, cruiseSpeed) {
  const dx = Math.max(40, Math.min(targetX - plane.x, 380));
  const dy = targetY - plane.y;
  // Aim at a near point on the line to the target, so a distant goal still
  // commands a real pitch change instead of a shallow drift.
  const desiredPitch = clamp(Math.atan2(dy, dx) * 0.9, -0.45, 0.5);
  const pitchUp = desiredPitch > plane.pitch + 0.03;
  const pitchDown = desiredPitch < plane.pitch - 0.03;
  const throttleUp = plane.speed < cruiseSpeed - 1;
  const throttleDown = plane.speed > cruiseSpeed + 3;
  return { throttleUp, throttleDown, pitchUp, pitchDown, mousePitch: null };
}

// The autopilot is exported so a harness can fly any mission to its end;
// the game itself never calls it.
export function autopilot(plane, mission, valley) {
  // Climb out first: until the plane has 70 m of air under it, aim up and
  // ahead rather than at a distant ring, or the hillside eats the take-off.
  // Only on departure (x < 2500): on final approach a low clearance over
  // the strip is normal and must not trigger a climb.
  const clearance = plane.y - valley.heightAt(plane.x);
  if (plane.x < 2500 && clearance < 70 && !plane.onGround) {
    return autopilotTo(plane, plane.x + 500, plane.y + 160, 62);
  }
  const nextRing = mission.nextRing;
  if (nextRing) return autopilotTo(plane, nextRing.x, nextRing.y, 62);
  if (mission.mission.goal === 'drop' && !mission.crateDropped) {
    return autopilotTo(plane, (valley.dropZone.x0 + valley.dropZone.x1) / 2, 110, 55);
  }
  // Final approach: clear the ridges while still in the pass, then ride a
  // steady glide slope down to the strip threshold and flare low and slow.
  const stripX = CONFIG.FAR_STRIP_X + 120;
  const distanceToStrip = stripX - plane.x;
  if (distanceToStrip <= 0) {
    // Past the threshold but still over the strip: put her down now. Aim
    // a touch under the strip so the wheels find it instead of skimming it.
    const groundHere = valley.heightAt(plane.x + 60);
    return autopilotTo(plane, plane.x + 60, groundHere - 3, 26);
  }
  if (distanceToStrip < 300) {
    // Flare: aim close and low so the wheels find the strip instead of
    // floating its whole length — but never below the ground ahead.
    const groundHere = valley.heightAt(plane.x + 60);
    return autopilotTo(plane, plane.x + 60, groundHere - 3, 28);
  }
  let targetY;
  let finalSpeed;
  if (plane.x < CONFIG.PASS_END_X) {
    targetY = valley.heightAt(Math.min(plane.x + 300, stripX)) + 110;
    finalSpeed = 55;
  } else {
    targetY = Math.max(12, distanceToStrip * 0.16);
    finalSpeed = distanceToStrip < 500 ? 34 : 48;
  }
  return autopilotTo(plane, stripX, targetY, finalSpeed);
}

// Advance the world `seconds` forward under the autopilot. Returns true
// when the mission finished (landed or failed) during the run.
function flyFor(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    game.step(STEP, autopilot(game.plane, game.mission, game.valley), true);
    if (game.mission.finished) return true;
  }
  return false;
}

/**
 * Set the game to the named scene (title, rings, drop or land; anything
 * else is title) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  game.reset(1);
  if (name !== 'rings' && name !== 'drop' && name !== 'land') {
    // Title: the plane sits on the home strip at dusk, engine idling.
    for (let index = 0; index < TITLE_SECONDS / STEP; index += 1) {
      game.step(STEP, { throttleUp: false, throttleDown: false, pitchUp: false, pitchDown: false, mousePitch: null }, true);
    }
    game.plane.throttle = 0.35;
    return { screen: 'title', camFrac: 0.72 };
  }
  if (name === 'rings') {
    game.startMission(0);
    flyFor(game, RING_SECONDS);
    return { screen: 'play' };
  }
  if (name === 'drop') {
    game.startMission(1);
    flyFor(game, DROP_SECONDS);
    // Drop the crate over the field and catch it mid-fall.
    game.dropCrate();
    for (let index = 0; index < 2.2 / STEP; index += 1) {
      game.step(STEP, autopilot(game.plane, game.mission, game.valley), true);
    }
    return { screen: 'play' };
  }
  game.startMission(2);
  const finished = flyFor(game, LAND_SECONDS);
  if (game.mission.finished) game.endDetail = game.mission.resultDetail;
  if (finished && game.mission.result === 'complete') return { screen: 'complete', camFrac: 0.55 };
  // If the autopilot did not make it, hold the last airborne frame anyway.
  return { screen: 'play' };
}
