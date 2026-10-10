import './styles.css';
import { GameInterface } from './adapters/browser/interface';
import { BrowserInput } from './adapters/browser/input';
import { BrowserAudio } from './adapters/browser/audio';
import { HttpAreaSource } from './adapters/browser/area-source';
import { ThreeRenderer } from './adapters/three/three-renderer';
import { loadArea } from './application/load-area';
import { GameSession } from './application/game-session';
import { GameSimulation } from './game/simulation';
import { defaultSettings } from './content/settings';
import type { Screen } from './adapters/browser/interface';
import type { GameSettings } from './content/settings';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
const base = new URL(import.meta.env.BASE_URL, location.href);
const source = new HttpAreaSource(base);
const audio = new BrowserAudio();
const events = new AbortController();
let settings: GameSettings = {
  ...defaultSettings,
  cameraShake: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};
let screen: Screen = 'title';
let backScreen: 'title' | 'paused' = 'title';
let viewport: ThreeRenderer | undefined;
let session: GameSession | undefined;
let loading: AbortController | undefined;
let frame = 0;
let disposed = false;

function show(next: Screen): void {
  screen = next;
  ui.show(next);
  input.setEnabled(next === 'playing');
  if (session) session.setPaused(next !== 'playing');
}
function applySettings(next: GameSettings): void {
  settings = next;
  input.setSensitivity(next.sensitivity);
  audio.setVolume(next.volume);
  if (session) session.applySettings(next);
  else viewport?.applySettings(next);
}
function returnToTitle(): void {
  loading?.abort();
  loading = undefined;
  session?.restart();
  show('title');
}
async function play(): Promise<void> {
  if (screen === 'loading' || disposed) return;
  audio.unlock();
  loading?.abort();
  const controller = new AbortController();
  loading = controller;
  show('loading');
  ui.loading(0.02, 'Reading training area…');
  try {
    const result = await loadArea(
      source,
      'areas/tutorial.area.json',
      controller.signal,
    );
    if (controller.signal.aborted || disposed) return;
    if (!result.ok)
      throw new Error(
        result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('\n'),
      );
    const simulation = new GameSimulation(result.area);
    viewport ??= new ThreeRenderer(ui.canvas, base, () => {
      if (screen === 'playing') show('paused');
    });
    viewport.applySettings(settings);
    await viewport.load(result.area, controller.signal, (progress, label) => {
      if (!controller.signal.aborted) ui.loading(0.1 + progress * 0.85, label);
    });
    if (controller.signal.aborted || disposed) return;
    session = new GameSession(simulation, input, viewport, audio);
    input.resetCamera();
    session.applySettings(settings);
    ui.loading(1, 'Ready');
    show('playing');
  } catch (error) {
    if (controller.signal.aborted || disposed) return;
    console.error('Unable to start training:', error);
    screen = 'error';
    input.setEnabled(false);
    ui.error(
      error instanceof Error
        ? error.message
        : 'The training area could not be loaded. Try again.',
    );
  } finally {
    if (loading === controller) loading = undefined;
  }
}
const ui = new GameInterface(root, settings, {
  play: () => {
    void play();
  },
  cancelLoading: returnToTitle,
  pause: () => show('paused'),
  resume: () => show('playing'),
  restart: () => {
    session?.restart();
    input.resetCamera();
    viewport?.resetCamera();
    show('playing');
  },
  title: returnToTitle,
  settings: () => {
    backScreen = screen === 'title' ? 'title' : 'paused';
    show('settings');
  },
  controls: () => {
    backScreen = 'title';
    show('controls');
  },
  back: () => show(backScreen),
  changeSettings: applySettings,
});
const input = new BrowserInput(ui.canvas, ui.touchControls);
show('title');
function tick(time: number): void {
  if (disposed) return;
  if (
    session &&
    (screen === 'playing' ||
      screen === 'paused' ||
      (screen === 'settings' && backScreen === 'paused'))
  )
    ui.update(session.frame(time));
  frame = requestAnimationFrame(tick);
}
frame = requestAnimationFrame(tick);
document.addEventListener(
  'visibilitychange',
  () => {
    if (document.hidden && screen === 'playing') show('paused');
  },
  { signal: events.signal },
);
window.addEventListener(
  'blur',
  () => {
    if (screen === 'playing') show('paused');
  },
  { signal: events.signal },
);
function dispose(): void {
  disposed = true;
  loading?.abort();
  cancelAnimationFrame(frame);
  events.abort();
  input.dispose();
  viewport?.dispose();
  audio.dispose();
  ui.dispose();
}
if (import.meta.hot) import.meta.hot.dispose(dispose);
