// Storm Runner — everything the eye sees: dusk sky, the valley, the plane,
// the rings, and the instruments. One canvas, one camera that follows the
// nose and never fights the pilot.
import { CONFIG, MISSIONS } from './config.js';
import { clamp, smoothstep } from './terrain.js';

const SCALE = 1.0;
const PLANE_SCREEN_X = 430;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Small particle system for exhaust, dust and crash debris.
export class Particles {
  constructor() {
    this.list = [];
  }

  spawn(x, y, vx, vy, life, size, color) {
    if (this.list.length > 220) return;
    this.list.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  exhaust(plane) {
    const backX = plane.x - Math.cos(plane.pitch) * 34;
    const backY = plane.y - Math.sin(plane.pitch) * 34;
    this.spawn(backX, backY, -plane.speed * 0.2 - 8, -2, 0.7, 3, 'rgba(200,190,180,0.35)');
  }

  dust(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      this.spawn(x + (Math.random() - 0.5) * 20, y + 2, (Math.random() - 0.5) * 26, Math.random() * 14 + 4, 0.9, 4, 'rgba(190,170,140,0.5)');
    }
  }

  debris(x, y) {
    const colors = ['#ff9a3c', '#ff5a3c', '#ffd23c', '#8a8f98'];
    for (let i = 0; i < 42; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 120;
      this.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.2, 2 + Math.random() * 3, colors[i % colors.length]);
    }
  }

  step(dt) {
    for (const particle of this.list) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 12 * dt;
      particle.life -= dt;
    }
    this.list = this.list.filter((particle) => particle.life > 0);
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.camX = 0;
    this.camTop = 420;
    this.particles = new Particles();
    this.flashTimer = 0;
    this.shotMode = false;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(320, rect.width);
    this.height = Math.max(240, rect.height);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // World (metres, y up) to screen (pixels, y down).
  toScreen(x, y) {
    return { x: (x - this.camX) * SCALE, y: (this.camTop - y) * SCALE };
  }

  updateCamera(plane, dt) {
    const targetX = plane.x - PLANE_SCREEN_X;
    const targetTop = plane.y + this.height * 0.55;
    const t = 1 - Math.pow(0.001, dt);
    this.camX = lerp(this.camX, targetX, t);
    this.camTop = lerp(this.camTop, targetTop, t);
  }

  // ---------------------------------------------------------------- sky
  drawSky(time) {
    const ctx = this.ctx;
    const horizonY = this.toScreen(0, 0).y;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1b2140');
    gradient.addColorStop(0.45, '#4a3560');
    gradient.addColorStop(0.72, '#b45a3c');
    gradient.addColorStop(0.86, '#e08a4a');
    gradient.addColorStop(1, '#2c1f3a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Stars fade in above the dusk band.
    ctx.save();
    for (const star of this.valley.stars) {
      const x = ((star.x * this.width * 1.4 - this.camX * 0.12) % this.width + this.width) % this.width;
      const y = star.y * this.height * 0.6;
      const twinkle = 0.5 + 0.5 * Math.sin(time * 1.4 + star.twinkle);
      ctx.globalAlpha = 0.25 + 0.6 * twinkle * (1 - y / (this.height * 0.6));
      ctx.fillStyle = '#dfe6ff';
      ctx.fillRect(x, y, star.size, star.size);
    }
    ctx.restore();

    // Low sun sinking behind the far ridge.
    const sun = this.toScreen(10300, 150);
    const sunGlow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 150);
    sunGlow.addColorStop(0, 'rgba(255,196,110,0.95)');
    sunGlow.addColorStop(0.25, 'rgba(255,150,80,0.55)');
    sunGlow.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sun.x - 150, sun.y - 150, 300, 300);
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
    ctx.fill();

    // The storm front: a dark wall closing in from the east.
    const stormX = this.toScreen(9200, 0).x;
    if (stormX < this.width + 400) {
      const storm = ctx.createLinearGradient(stormX, 0, this.width, 0);
      storm.addColorStop(0, 'rgba(38,34,58,0)');
      storm.addColorStop(0.5, 'rgba(38,34,58,0.75)');
      storm.addColorStop(1, 'rgba(24,22,44,0.95)');
      ctx.fillStyle = storm;
      ctx.fillRect(Math.max(0, stormX), 0, this.width, horizonY + 40);
      // Rain streaks under the front.
      ctx.strokeStyle = 'rgba(170,190,230,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 40; i += 1) {
        const rx = stormX + 60 + ((i * 53 + time * 90) % 500);
        const ry = ((i * 97 + time * 320) % (horizonY + 40));
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + 16);
      }
      ctx.stroke();
    }

    // Lightning now and then inside the front.
    this.flashTimer -= 1 / 60;
    if (this.flashTimer <= 0 && Math.random() < 0.004) this.flashTimer = 0.22;
    if (this.flashTimer > 0) {
      ctx.fillStyle = `rgba(210,220,255,${this.flashTimer * 0.5})`;
      ctx.fillRect(stormX + 40, 0, this.width - stormX, horizonY);
    }
  }

  drawFarRidges() {
    const ctx = this.ctx;
    const layers = [
      { parallax: 0.25, color: '#5a4468', amp: 150, base: 130, seed: 11 },
      { parallax: 0.45, color: '#463452', amp: 190, base: 90, seed: 23 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(-4, this.height + 4);
      for (let sx = -4; sx <= this.width + 8; sx += 8) {
        const worldX = (sx + this.camX * layer.parallax) / SCALE;
        const ridge =
          layer.base +
          Math.sin(worldX * 0.0011 + layer.seed) * layer.amp * 0.5 +
          Math.sin(worldX * 0.0027 + layer.seed * 2) * layer.amp * 0.3 +
          Math.sin(worldX * 0.0061 + layer.seed * 3) * layer.amp * 0.2;
        const horizonY = this.toScreen(0, 0).y;
        ctx.lineTo(sx, horizonY - ridge * 0.6);
      }
      ctx.lineTo(this.width + 4, this.height + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------- ground
  drawTerrain(plane, mission) {
    const ctx = this.ctx;
    const valley = this.valley;
    const step = 8;
    const x0 = this.camX - 40;
    const x1 = this.camX + this.width / SCALE + 40;
    ctx.beginPath();
    ctx.moveTo(this.toScreen(x0, -400).x, this.height + 4);
    for (let x = x0; x <= x1; x += step) {
      const ground = valley.heightAt(x);
      const point = this.toScreen(x, ground);
      ctx.lineTo(point.x, point.y);
    }
    ctx.lineTo(this.toScreen(x1, -400).x, this.height + 4);
    ctx.closePath();
    const groundGradient = ctx.createLinearGradient(0, this.toScreen(0, 380).y, 0, this.height);
    groundGradient.addColorStop(0, '#3d3350');
    groundGradient.addColorStop(0.5, '#2c2440');
    groundGradient.addColorStop(1, '#1a1428');
    ctx.fillStyle = groundGradient;
    ctx.fill();

    // Snow on the high ground.
    ctx.fillStyle = 'rgba(232,228,244,0.85)';
    ctx.beginPath();
    let snowOpen = false;
    for (let x = x0; x <= x1; x += step) {
      const ground = valley.heightAt(x);
      if (ground > 250) {
        const point = this.toScreen(x, ground);
        if (!snowOpen) {
          ctx.moveTo(point.x, point.y);
          snowOpen = true;
        }
        ctx.lineTo(point.x, point.y);
      } else if (snowOpen) {
        const point = this.toScreen(x, ground);
        ctx.lineTo(point.x, point.y + 14);
        snowOpen = false;
      }
    }
    if (snowOpen) ctx.lineTo(this.toScreen(x1, valley.heightAt(x1)).x, this.toScreen(x1, valley.heightAt(x1)).y + 14);
    ctx.fill();

    // The river: a bright band where the channel dips below the floor.
    const riverLeft = this.toScreen(CONFIG.RIVER_X - CONFIG.RIVER_WIDTH / 2, 0);
    const riverRight = this.toScreen(CONFIG.RIVER_X + CONFIG.RIVER_WIDTH / 2, 0);
    if (riverRight.x > 0 && riverLeft.x < this.width) {
      const riverGradient = ctx.createLinearGradient(riverLeft.x, 0, riverRight.x, 0);
      riverGradient.addColorStop(0, 'rgba(70,120,190,0.15)');
      riverGradient.addColorStop(0.5, 'rgba(120,180,235,0.75)');
      riverGradient.addColorStop(1, 'rgba(70,120,190,0.15)');
      ctx.fillStyle = riverGradient;
      const topY = this.toScreen(0, -4).y;
      ctx.fillRect(riverLeft.x, topY, riverRight.x - riverLeft.x, this.height - topY);
    }

    this.drawTown();
    this.drawDropZone(mission);
    this.drawRunways();
  }

  drawTown() {
    const ctx = this.ctx;
    const valley = this.valley;
    for (const light of valley.townLights) {
      const point = this.toScreen(light.x, valley.heightAt(light.x) + light.lift);
      if (point.x < -10 || point.x > this.width + 10 || point.y < -10 || point.y > this.height + 10) continue;
      const flicker = 0.75 + 0.25 * Math.sin(performance.now() / 700 + light.phase);
      ctx.globalAlpha = flicker;
      ctx.fillStyle = light.warm ? '#ffc46b' : '#cfe4ff';
      ctx.fillRect(point.x, point.y, 3, 3);
      ctx.globalAlpha = 0.18 * flicker;
      ctx.beginPath();
      ctx.arc(point.x + 1.5, point.y + 1.5, 7, 0, Math.PI * 2);
      ctx.fillStyle = light.warm ? '#ffc46b' : '#cfe4ff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawDropZone(mission) {
    const ctx = this.ctx;
    const valley = this.valley;
    const left = this.toScreen(valley.dropZone.x0, 0);
    const right = this.toScreen(valley.dropZone.x1, 0);
    if (right.x < 0 || left.x > this.width) return;
    const topY = left.y;
    ctx.fillStyle = 'rgba(80,220,140,0.14)';
    ctx.fillRect(left.x, topY - 26, right.x - left.x, 26);
    ctx.strokeStyle = 'rgba(120,255,170,0.85)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(left.x, topY - 26, right.x - left.x, 26);
    ctx.setLineDash([]);
    ctx.fillStyle = '#8dffb0';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DROP ZONE', (left.x + right.x) / 2, topY - 32);
  }

  drawRunways() {
    const ctx = this.ctx;
    const valley = this.valley;
    for (const strip of [valley.homeStrip, valley.farStrip]) {
      const left = this.toScreen(strip.x0, 0);
      const right = this.toScreen(strip.x1, 0);
      if (right.x < -20 || left.x > this.width + 20) continue;
      const topY = left.y;
      ctx.fillStyle = '#20242e';
      ctx.fillRect(left.x, topY - 5, right.x - left.x, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(left.x + 14, topY - 3, 26, 2);
      ctx.fillRect(right.x - 40, topY - 3, 26, 2);
      // Edge lights, warm at dusk.
      for (let x = strip.x0; x <= strip.x1; x += 60) {
        const light = this.toScreen(x, 0);
        ctx.fillStyle = '#ffd28a';
        ctx.beginPath();
        ctx.arc(light.x, light.y - 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(light.x, light.y - 7, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#e8e4da';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      const label = strip === valley.farStrip ? 'FAR STRIP' : 'HOME';
      ctx.fillText(label, (left.x + right.x) / 2, topY - 14);
    }
  }

  // ---------------------------------------------------------------- rings & crate
  drawRings(mission, time) {
    const ctx = this.ctx;
    for (const ring of mission.rings) {
      const point = this.toScreen(ring.x, ring.y);
      if (point.x < -80 || point.x > this.width + 80) continue;
      const radius = ring.radius * SCALE;
      const pulse = 1 + 0.06 * Math.sin(time * 3 + ring.id);
      ctx.save();
      ctx.shadowBlur = 18;
      if (ring.passed) {
        ctx.shadowColor = '#39d98a';
        ctx.strokeStyle = '#39d98a';
      } else {
        ctx.shadowColor = '#ffb347';
        ctx.strokeStyle = '#ffb347';
      }
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = ring.passed ? 'rgba(57,217,138,0.5)' : 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * pulse * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      if (!ring.passed) {
        ctx.fillStyle = '#ffd9a0';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`R${ring.id + 1}`, point.x, point.y - radius - 10);
      } else {
        ctx.fillStyle = '#39d98a';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('✓', point.x, point.y + 6);
      }
      ctx.restore();
    }
  }

  drawCrate(crate) {
    if (!crate) return;
    const ctx = this.ctx;
    const point = this.toScreen(crate.x, crate.y);
    if (point.x < -40 || point.x > this.width + 40) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    if (!crate.landed) {
      // A small drogue steadies the fall.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(-14, -24);
      ctx.moveTo(8, -8);
      ctx.lineTo(14, -24);
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -26);
      ctx.stroke();
      ctx.fillStyle = '#e8e0d0';
      ctx.beginPath();
      ctx.moveTo(-16, -24);
      ctx.quadraticCurveTo(0, -38, 16, -24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#b07a3c';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#6b4a22';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(9, 0);
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- the plane
  drawPlane(plane, time) {
    const ctx = this.ctx;
    const point = this.toScreen(plane.x, plane.y);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(-plane.pitch);
    // Landing light beam at dusk.
    if (!plane.onGround) {
      const beam = ctx.createLinearGradient(34, 0, 150, 0);
      beam.addColorStop(0, 'rgba(255,240,200,0.28)');
      beam.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(34, -3);
      ctx.lineTo(150, -16);
      ctx.lineTo(150, 16);
      ctx.lineTo(34, 3);
      ctx.closePath();
      ctx.fill();
    }
    // Propeller: a translucent disc and two blades turning with throttle.
    ctx.save();
    ctx.translate(36, -2);
    ctx.fillStyle = 'rgba(220,220,230,0.14)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(plane.propAngle);
    ctx.fillStyle = 'rgba(30,30,36,0.85)';
    ctx.fillRect(-1.5, -15, 3, 30);
    ctx.restore();
    // Fuselage: a bush plane with a high wing, built from one warm shape.
    ctx.fillStyle = '#e8b23c';
    ctx.beginPath();
    ctx.moveTo(-34, 2);
    ctx.quadraticCurveTo(-36, -6, -26, -8);
    ctx.lineTo(6, -10);
    ctx.quadraticCurveTo(28, -9, 36, -3);
    ctx.quadraticCurveTo(37, 0, 30, 3);
    ctx.lineTo(-20, 8);
    ctx.quadraticCurveTo(-32, 7, -34, 2);
    ctx.closePath();
    ctx.fill();
    // Belly stripe.
    ctx.fillStyle = '#c23b2e';
    ctx.fillRect(-30, 1, 58, 3);
    // Lit cabin windows.
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.roundRect(-2, -9, 12, 7, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(12, -8, 8, 6, 2);
    ctx.fill();
    // High wing and tail.
    ctx.fillStyle = '#d99a2b';
    ctx.beginPath();
    ctx.roundRect(-8, -18, 26, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(-34, -6);
    ctx.lineTo(-40, -20);
    ctx.lineTo(-32, -20);
    ctx.lineTo(-26, -7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d99a2b';
    ctx.beginPath();
    ctx.roundRect(-38, -4, 14, 4, 2);
    ctx.fill();
    // Tundra wheels.
    ctx.fillStyle = '#22242a';
    ctx.beginPath();
    ctx.arc(-12, 11, 5, 0, Math.PI * 2);
    ctx.arc(12, 11, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#555a66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(-10, 7);
    ctx.moveTo(12, 6);
    ctx.lineTo(10, 7);
    ctx.stroke();
    // Nav light blinking on the wingtip.
    const blink = Math.sin(time * 6) > 0;
    if (blink) {
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(18, -18, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const particle of this.particles.list) {
      const point = this.toScreen(particle.x, particle.y);
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- HUD
  drawHud(plane, mission, time) {
    const ctx = this.ctx;
    const wind = plane.wind || { x: 0, strength: 0 };
    // Top bar.
    ctx.fillStyle = 'rgba(10,12,24,0.72)';
    ctx.fillRect(0, 0, this.width, 44);
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    const altitude = Math.max(0, Math.round(plane.y - this.valley.heightAt(plane.x)));
    ctx.fillText(`ALT ${String(altitude).padStart(4, ' ')} m`, 14, 19);
    ctx.fillText(`SPD ${String(Math.round(plane.speed * 3.6)).padStart(3, ' ')} km/h`, 150, 19);
    ctx.fillText(`HDG ${String(plane.headingDegrees).padStart(3, '0')}°`, 300, 19);
    const windArrow = wind.x < 0 ? '◀' : '▶';
    ctx.fillText(`WIND ${windArrow} ${Math.round(Math.abs(wind.x) * 3.6)} km/h`, 420, 19);
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE ${mission.score}`, this.width - 14, 19);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#ffd28a';
    ctx.textAlign = 'left';
    ctx.fillText(mission.objectiveText, 14, 37);
    ctx.textAlign = 'right';
    const minutes = Math.floor(mission.elapsed / 60);
    const seconds = Math.floor(mission.elapsed % 60);
    ctx.fillText(`T+${minutes}:${String(seconds).padStart(2, '0')}`, this.width - 14, 37);

    // Fuel and damage bars, right side under the bar.
    this.drawBar(this.width - 214, 52, 200, 10, plane.fuel / 100, '#ffb347', 'FUEL');
    this.drawBar(this.width - 214, 68, 200, 10, 1 - plane.damage / 100, '#39d98a', 'AIRFRAME');
    this.drawCompass(plane);
    this.drawInstruments(plane);
    this.drawNextTargetArrow(plane, mission);
    if (plane.fuel <= 0) this.drawWarning('FUEL EMPTY — GLIDE HER IN', time);
    else if (plane.fuel < 20) this.drawWarning('LOW FUEL', time);
    if (plane.damage > 60) this.drawWarning('AIRFRAME CRITICAL', time);
  }

  drawBar(x, y, width, height, fraction, color, label) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,12,24,0.7)';
    ctx.fillRect(x - 52, y - 2, width + 56, height + 4);
    ctx.fillStyle = '#1a1e2e';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fraction < 0.25 ? '#ff5a3c' : color;
    ctx.fillRect(x, y, width * clamp(fraction, 0, 1), height);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, x - 5, y + height - 1);
  }

  drawCompass(plane) {
    const ctx = this.ctx;
    const y = 56;
    const centreX = this.width / 2;
    ctx.fillStyle = 'rgba(10,12,24,0.6)';
    ctx.fillRect(centreX - 130, y - 12, 260, 22);
    ctx.save();
    ctx.beginPath();
    ctx.rect(centreX - 130, y - 12, 260, 22);
    ctx.clip();
    const heading = plane.headingDegrees;
    for (let offset = -60; offset <= 60; offset += 5) {
      const degrees = ((heading + offset) % 360 + 360) % 360;
      const x = centreX + offset * 2;
      const major = degrees % 30 === 0;
      ctx.strokeStyle = major ? '#e8e4da' : 'rgba(232,228,218,0.45)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y - (major ? 6 : 2));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#e8e4da';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[degrees] ?? String(degrees).padStart(3, '0');
        ctx.fillText(label, x, y - 8);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(centreX, y + 8);
    ctx.lineTo(centreX - 5, y + 1);
    ctx.lineTo(centreX + 5, y + 1);
    ctx.closePath();
    ctx.fill();
  }

  drawInstruments(plane) {
    const ctx = this.ctx;
    const stripY = this.height - 100;
    ctx.fillStyle = 'rgba(12,14,26,0.78)';
    ctx.fillRect(0, stripY, this.width, 100);
    ctx.strokeStyle = 'rgba(255,210,138,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, stripY + 0.5);
    ctx.lineTo(this.width, stripY + 0.5);
    ctx.stroke();

    // Attitude indicator: a lit ball that rolls with the pitch.
    const ax = 70;
    const ay = stripY + 46;
    const radius = 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#2c4a7a';
    ctx.fillRect(ax - radius, ay - radius, radius * 2, radius * 2);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-plane.pitch * 0.9);
    ctx.translate(0, plane.pitch * 60);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-radius, 0, radius * 2, radius * 2);
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(-radius, -1, radius * 2, 2);
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = '#ffd28a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(ax - 12, ay);
    ctx.lineTo(ax - 4, ay - 3);
    ctx.lineTo(ax - 4, ay + 3);
    ctx.closePath();
    ctx.moveTo(ax + 12, ay);
    ctx.lineTo(ax + 4, ay - 3);
    ctx.lineTo(ax + 4, ay + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e4da';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', ax, stripY + 88);

    // Altimeter dial.
    const bx = 170;
    this.drawDial(bx, ay, radius, 'ALT', `${Math.max(0, Math.round(plane.y - this.valley.heightAt(plane.x)))} m`, (plane.y % 1000) / 1000);

    // Airspeed dial.
    const cx = 270;
    this.drawDial(cx, ay, radius, 'AIRSPEED', `${Math.round(plane.speed * 3.6)} km/h`, plane.speed / CONFIG.MAX_SPEED);

    // Throttle lever.
    const tx = 350;
    ctx.fillStyle = '#1a1e2e';
    ctx.fillRect(tx, stripY + 14, 10, 64);
    ctx.fillStyle = '#ffb347';
    const leverY = stripY + 74 - plane.throttle * 56;
    ctx.fillRect(tx - 5, leverY, 20, 8);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('THR', tx + 5, stripY + 88);
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, tx + 5, stripY + 12);

    // Controls reminder, bottom right.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(232,228,218,0.75)';
    ctx.font = '11px monospace';
    ctx.fillText('W/S throttle · A/D or mouse pitch · SPACE drop crate · P pause · R restart', this.width - 14, stripY + 30);
    ctx.fillText('Land gently on a lit strip — hard touchdowns damage the airframe.', this.width - 14, stripY + 48);
  }

  drawDial(x, y, radius, label, value, fraction) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#141824';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
    ctx.strokeStyle = '#ffd28a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,228,218,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * (radius - 4), y + Math.sin(angle) * (radius - 4));
      ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      ctx.stroke();
    }
    const needle = fraction * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#ff5a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(needle) * (radius - 6), y + Math.sin(needle) * (radius - 6));
    ctx.stroke();
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(value, x, y + radius - 8);
    ctx.font = '10px monospace';
    ctx.fillText(label, x, y + radius + 13);
  }

  drawNextTargetArrow(plane, mission) {
    const ctx = this.ctx;
    let target = mission.nextRing;
    if (!target && mission.mission.goal === 'drop' && !mission.crateOnTarget) {
      target = { x: (this.valley.dropZone.x0 + this.valley.dropZone.x1) / 2, y: 90 };
    }
    if (!target) target = { x: CONFIG.FAR_STRIP_X + CONFIG.FAR_STRIP_LENGTH / 2, y: 10 };
    const point = this.toScreen(target.x, target.y);
    if (point.x > -20 && point.x < this.width + 20 && point.y > 60 && point.y < this.height - 110) return;
    const edgeX = clamp(point.x, 30, this.width - 30);
    const edgeY = clamp(point.y, 70, this.height - 120);
    const angle = Math.atan2(point.y - edgeY, point.x - edgeX);
    ctx.save();
    ctx.translate(edgeX, edgeY);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(255,179,71,0.9)';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const distance = Math.round(Math.abs(target.x - plane.x));
    ctx.fillText(`${distance} m`, edgeX, edgeY + 24);
  }

  drawWarning(text, time) {
    const ctx = this.ctx;
    if (Math.sin(time * 8) < 0) return;
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ${text} ⚠`, this.width / 2, 92);
  }

  // ---------------------------------------------------------------- screens
  drawTitle(time) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,12,24,0.45)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd28a';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('STORM RUNNER', this.width / 2, 190);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '20px Georgia, serif';
    ctx.fillText('A bush plane, a dusk alpine valley, and a storm front closing in.', this.width / 2, 232);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#ffd9a0';
    // In a screenshot scene the prompt never blinks off: the frame is the
    // whole first impression.
    const blink = this.shotMode || Math.sin(time * 3) > -0.2;
    if (blink) ctx.fillText('PRESS ENTER — CHOOSE YOUR MISSION', this.width / 2, 300);
    ctx.fillStyle = 'rgba(232,228,218,0.85)';
    ctx.font = '13px monospace';
    ctx.fillText('W / S — throttle      A / D or mouse — pitch      SPACE — drop the crate', this.width / 2, 360);
    ctx.fillText('Thread the glowing rings through the pass. Mind the fuel. Land her soft.', this.width / 2, 384);
    ctx.fillText('P — pause      R — restart      M — missions', this.width / 2, 408);
  }

  drawMissionSelect(selected) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,12,24,0.55)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd28a';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('CHOOSE YOUR SORTIE', this.width / 2, 110);
    const cardWidth = 330;
    const cardHeight = 250;
    const gap = 26;
    const totalWidth = cardWidth * 3 + gap * 2;
    const startX = (this.width - totalWidth) / 2;
    const startY = 170;
    MISSIONS.forEach((mission, index) => {
      const x = startX + index * (cardWidth + gap);
      const active = index === selected;
      ctx.fillStyle = active ? 'rgba(60,44,28,0.92)' : 'rgba(16,18,32,0.88)';
      ctx.strokeStyle = active ? '#ffb347' : 'rgba(232,228,218,0.35)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, startY, cardWidth, cardHeight, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd28a';
      ctx.font = 'bold 22px Georgia, serif';
      ctx.fillText(mission.name, x + cardWidth / 2, startY + 44);
      ctx.fillStyle = '#e8e4da';
      ctx.font = '13px monospace';
      this.wrapText(mission.tagline, x + 24, startY + 84, cardWidth - 48, 20);
      ctx.fillStyle = '#ffd9a0';
      ctx.font = '13px monospace';
      ctx.fillText(`Wind ${mission.windBase}–${mission.windBase + mission.windGust} km/h · Fuel ${mission.fuel}%`, x + cardWidth / 2, startY + 180);
      ctx.fillText(`Goal: ${mission.goal === 'rings' ? `${mission.rings} rings` : mission.goal === 'drop' ? 'crate on target' : 'land in the storm'}`, x + cardWidth / 2, startY + 206);
      if (active) {
        ctx.fillStyle = '#39d98a';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('▶ ENTER TO FLY', x + cardWidth / 2, startY + 232);
      }
    });
    ctx.fillStyle = 'rgba(232,228,218,0.8)';
    ctx.font = '13px monospace';
    ctx.fillText('← → to choose · ENTER to fly · ESC back to title', this.width / 2, startY + cardHeight + 46);
  }

  wrapText(text, x, y, maxWidth, lineHeight) {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let cursorY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x + maxWidth / 2, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x + maxWidth / 2, cursorY);
  }

  drawOverlay(title, lines, accent, showFooter = true) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,12,24,0.62)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(title, this.width / 2, this.height / 2 - 70);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '16px monospace';
    lines.forEach((line, index) => {
      ctx.fillText(line, this.width / 2, this.height / 2 - 24 + index * 28);
    });
    if (!showFooter) return;
    ctx.fillStyle = '#ffd9a0';
    ctx.font = '14px monospace';
    if (this.shotMode || Math.sin(performance.now() / 400) > -0.2) {
      ctx.fillText('ENTER — fly again      M — change mission', this.width / 2, this.height / 2 + 90);
    }
  }

  // One frame: world first, then the HUD, then the screen on top.
  render(state, time) {
    const ctx = this.ctx;
    this.valley = state.valley;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawSky(time);
    this.drawFarRidges();
    this.drawTerrain(state.plane, state.mission);
    this.drawRings(state.mission, time);
    this.drawCrate(state.mission.crate);
    this.drawParticles();
    if (state.screen !== 'select') {
      this.drawPlane(state.plane, time);
    }
    if (state.screen === 'play' || state.screen === 'pause') {
      this.drawHud(state.plane, state.mission, time);
    }
    if (state.screen === 'title') this.drawTitle(time);
    if (state.screen === 'select') this.drawMissionSelect(state.selectedMission);
    if (state.screen === 'pause') {
      this.drawOverlay('PAUSED', ['The valley waits. The storm does not.', 'P — resume'], '#ffd28a', false);
    }
    if (state.screen === 'over') {
      this.drawOverlay('SORTIE LOST', [state.endDetail, `Score ${state.mission.score} · Rings ${state.mission.ringsPassed}/${state.mission.rings.length}`], '#ff5a3c');
    }
    if (state.screen === 'complete') {
      this.drawOverlay('MISSION COMPLETE', [state.endDetail, `Score ${state.mission.score} · Rings ${state.mission.ringsPassed}/${state.mission.rings.length} · Time ${Math.round(state.mission.elapsed)}s`], '#39d98a');
    }
  }
}
