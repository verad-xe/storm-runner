// Storm Runner — keyboard and mouse. The plane answers to keys first; the
// mouse steers pitch by where the pointer sits above or below the nose, so
// a player can fly with one hand on the mouse and one on the throttle.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseY = null;
    this.mouseActive = false;
    this.pressed = new Set();
    this.canvas = canvas;
    this.onKey = this.onKey.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
  }

  onKey(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) this.pressed.add(event.code);
    this.keys.add(event.code);
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseY = (event.clientY - rect.top) / rect.height;
    this.mouseActive = true;
  }

  onMouseDown() {
    this.pressed.add('MouseClick');
  }

  onMouseLeave() {
    this.mouseActive = false;
    this.mouseY = null;
  }

  // Edge-triggered: true once per press, then consumed.
  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  get throttleUp() {
    return this.keys.has('KeyW') || this.keys.has('ArrowUp');
  }

  get throttleDown() {
    return this.keys.has('KeyS') || this.keys.has('ArrowDown');
  }

  get pitchUp() {
    return this.keys.has('KeyA') || this.keys.has('ArrowLeft');
  }

  get pitchDown() {
    return this.keys.has('KeyD') || this.keys.has('ArrowRight');
  }

  // Mouse pitch target in radians: pointer above the nose pulls up, below
  // pushes down, dead zone around the centre. Null when the mouse is idle.
  get mousePitch() {
    if (!this.mouseActive || this.mouseY === null) return null;
    const offset = 0.5 - this.mouseY;
    if (Math.abs(offset) < 0.06) return null;
    return Math.max(-0.5, Math.min(0.55, offset * 1.6));
  }

  // The shape the flight model reads each step.
  flightInput() {
    return {
      throttleUp: this.throttleUp,
      throttleDown: this.throttleDown,
      pitchUp: this.pitchUp,
      pitchDown: this.pitchDown,
      mousePitch: this.pitchDown || this.pitchUp ? null : this.mousePitch,
    };
  }
}
