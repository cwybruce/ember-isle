// Keyboard + mouse input for Ember Isle.
export function makeInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = new Set(); // edge-triggered keys, consumed each frame

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) e.preventDefault();
    if (!e.repeat) pressed.add(e.key.toLowerCase());
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, mouse,
    isDown(k) { return keys.has(k); },
    wasPressed(k) { return pressed.has(k); },
    consume(k) { return pressed.delete(k); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
