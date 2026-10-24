// Shared, interruptible motion. No dependency, click delay or per-frame layout reads.
const running = new WeakMap(), closing = new WeakMap();
const controls = 'button:not(:disabled):not(.photo-open):not([aria-busy="true"])';
const reduce = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const mobile = () => globalThis.matchMedia?.('(max-width: 700px)').matches ?? false;
const styleOf = element => element.ownerDocument.defaultView.getComputedStyle(element);
let installed = false, pressed = null, lastControl = null, pageKey = null;

// Underdamped spring, sampled once; the compositor plays only transform/opacity.
export function springFrames(from, to, transform) {
  return Array.from({length: 41}, (_, i) => {
    const t = i / 40, response = i === 40 ? 1 : 1 - Math.exp(-7.5 * t) * (Math.cos(11 * t) + 7.5 / 11 * Math.sin(11 * t));
    return {offset: t, transform: transform(from + (to - from) * response)};
  });
}
function play(element, frames, duration = 420, easing = 'linear') {
  if (!element?.isConnected || !element.animate || reduce()) return null;
  running.get(element)?.cancel();
  const animation = element.animate(frames, {duration, easing});
  running.set(element, animation);
  animation.finished.then(() => { if (running.get(element) === animation) running.delete(element); }).catch(() => {});
  return animation;
}
function scaleOf(element) {
  const transform = styleOf(element).transform;
  return transform?.startsWith('matrix(') ? parseFloat(transform.slice(7)) || 1 : 1;
}
function rebound(element) {
  if (!element?.isConnected) return;
  const from = scaleOf(element);
  element.classList.remove('motion-pressed');
  play(element, springFrames(from, 1, value => `scale(${value})`), 460);
}
function release() {
  if (!pressed) return;
  const element = pressed.element; pressed = null; rebound(element);
}
function press(element, point) {
  if (!element || reduce()) return;
  release();
  const rect = element.getBoundingClientRect();
  element.style.transformOrigin = point ? `${Math.max(20, Math.min(80, (point.x - rect.left) / rect.width * 100))}% 50%` : '50% 50%';
  const from = scaleOf(element);
  element.classList.add('motion-pressed');
  play(element, [{transform: `scale(${from})`}, {transform: 'scale(.95)'}], 90, 'cubic-bezier(.2,.7,.3,1)');
  pressed = {element, point}; lastControl = element;
}
export function installMotion() {
  if (installed) return; installed = true;
  document.documentElement.classList.add('fluid-ui');
  document.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    press(event.target.closest(controls), {x: event.clientX, y: event.clientY, id: event.pointerId});
  }, {passive: true});
  document.addEventListener('pointermove', event => {
    const point = pressed?.point;
    if (point && point.id === event.pointerId && Math.hypot(event.clientX - point.x, event.clientY - point.y) > 12) release();
  }, {passive: true});
  document.addEventListener('pointerup', release, {passive: true});
  document.addEventListener('pointercancel', release, {passive: true});
  document.addEventListener('keydown', event => {
    if (!event.repeat && ['Enter', ' '].includes(event.key)) press(event.target.closest(controls));
  });
  document.addEventListener('keyup', event => { if (['Enter', ' '].includes(event.key)) release(); });
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  // Stop in-flight animations as soon as the accessibility preference changes.
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', event => {
    if (!event.matches) return;
    release();
    document.getAnimations?.().forEach(animation => animation.cancel());
  });
}

export function beforeRender() {
  const pill = document.querySelector('.nav-glider');
  return {rect: pill?.getBoundingClientRect(), control: lastControl};
}
export function afterRender(key, previous) {
  const changed = pageKey !== null && key !== pageKey; pageKey = key;
  const nav = document.querySelector('.nav'), selected = nav?.querySelector('button.active');
  if (selected && selected.getBoundingClientRect().width) {
    const rect = selected.getBoundingClientRect(), base = nav.getBoundingClientRect();
    const pill = document.createElement('span'); pill.className = 'nav-glider'; pill.setAttribute('aria-hidden', 'true');
    Object.assign(pill.style, {left: `${rect.left - base.left}px`, top: `${rect.top - base.top}px`, width: `${rect.width}px`, height: `${rect.height}px`});
    nav.prepend(pill);
    if (previous.rect && changed) {
      const dx = previous.rect.left - rect.left, dy = previous.rect.top - rect.top;
      play(pill, springFrames(1, 0, value => `translate(${dx * value}px,${dy * value}px)`), 460);
      play(selected.querySelector('svg'), springFrames(.86, 1, value => `scale(${value})`), 460);
    }
  }
  if (changed) {
    const content = document.querySelector('.content');
    play(content, [{opacity: .5, transform: 'translateY(12px)'}, {opacity: 1, transform: 'translateY(0)'}], 280, 'cubic-bezier(.16,1,.3,1)');
  }
  // Selection often re-renders its button. Transfer the release, never the click.
  if (!pressed && previous.control && !previous.control.isConnected && !changed) {
    const data = previous.control.dataset;
    if (data.action) {
      const next = [...document.querySelectorAll(controls)].find(button => Object.keys(data).every(key => button.dataset[key] === data[key]));
      if (next) play(next, springFrames(.95, 1, value => `scale(${value})`), 460);
    }
  }
  lastControl = null;
}

export function presentDialog(dialog) {
  const pending = closing.get(dialog);
  if (pending) { closing.delete(dialog); pending.cancel(); }
  dialog.classList.remove('motion-closing'); dialog.removeAttribute('aria-busy');
  const wasOpen = dialog.open && !pending;
  if (!wasOpen) dialog.showModal();
  if (wasOpen) return; // Editing/marking an open photo does not bounce the image.
  const surface = dialog.querySelector('.choice-surface') || dialog;
  const isSheet = dialog.classList.contains('choice-dialog') && mobile();
  const frames = springFrames(isSheet ? 70 : 22, 0, y => `translateY(${y}px)`);
  frames.forEach(frame => { frame.opacity = Math.max(0, Math.min(1, frame.offset * 5)); });
  play(surface, frames, isSheet ? 480 : 360);
}
export function dismissDialog(dialog, onClosed = () => {}) {
  if (!dialog.open) { onClosed(); return; }
  if (closing.has(dialog)) return;
  dialog.classList.add('motion-closing');
  const surface = dialog.querySelector('.choice-surface') || dialog;
  const animation = play(surface, [{transform: styleOf(surface).transform || 'none', opacity: 1}, {transform: `translateY(${mobile() ? 40 : 14}px)`, opacity: 0}], 160, 'cubic-bezier(.4,0,1,1)');
  const finish = () => {
    if (animation && closing.get(dialog) !== animation) return;
    closing.delete(dialog); dialog.classList.remove('motion-closing');
    dialog.close(); onClosed();
  };
  if (!animation) { finish(); return; }
  closing.set(dialog, animation);
  animation.finished.then(finish, finish);
}

// Drag only the sheet header: the options keep native scrolling and selection.
export function enableSheetDrag(dialog, surface, handle, close) {
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (!mobile() || reduce() || !event.isPrimary || event.button !== 0 || event.target.closest('button,input')) return;
    running.get(surface)?.cancel();
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, dy: 0};
    handle.setPointerCapture(event.pointerId); surface.classList.add('motion-dragging');
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dy = Math.max(0, event.clientY - drag.y);
    surface.style.transform = `translateY(${drag.dy * .78}px)`;
  });
  const end = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dismiss = event.type === 'pointerup' && drag.dy > 92 && drag.dy > Math.abs(event.clientX - drag.x);
    const distance = drag.dy * .78; drag = null; surface.classList.remove('motion-dragging');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (dismiss) close();
    else { surface.style.removeProperty('transform'); play(surface, springFrames(distance, 0, y => `translateY(${y}px)`), 400); }
  };
  handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
}
