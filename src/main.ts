import './styles.css';
import { gameConfig } from './content/game-config';
import { GameSimulation } from './game/simulation';
import { GameApp } from './application/game-app';
import { BrowserHud } from './adapters/browser/hud';
import { BrowserInput } from './adapters/browser/input';
import { LocalSave } from './adapters/storage/local-save';
import { ThreeRenderer } from './adapters/three/three-renderer';

/** Only the composition root knows which concrete implementations are used. */
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');

const events = new AbortController();
let app: GameApp | undefined;
let hud: BrowserHud | undefined;
let input: BrowserInput | undefined;
let renderer: ThreeRenderer | undefined;
let frameId = 0;

function dispose(): void {
  cancelAnimationFrame(frameId);
  events.abort();
  if (app) app.dispose();
  else {
    input?.dispose();
    renderer?.dispose();
    hud?.dispose();
  }
}

try {
  // Access can throw in privacy modes; the adapter catches each storage operation.
  const saves = new LocalSave({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  });
  const simulation = new GameSimulation(gameConfig, saves.load());
  hud = new BrowserHud(root, {
    save: () => app?.save(),
    reset: () => app?.reset(),
    pause: () => app?.togglePause(),
  });
  input = new BrowserInput(hud.canvas, hud.touchControls);
  renderer = new ThreeRenderer(hud.canvas, gameConfig);
  app = new GameApp(simulation, input, renderer, saves, hud);
  const frame = (time: number) => {
    app?.frame(time);
    if (hud && input) hud.setCompass(input.sample().cameraYaw);
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  hud.canvas.focus();
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        app?.save(false);
        app?.setPaused(true);
      }
    },
    { signal: events.signal },
  );
  window.addEventListener('pagehide', () => app?.save(false), {
    signal: events.signal,
  });
  hud.canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      app?.setPaused(true);
      hud?.notify(
        'Graphics interrupted. Reload to restore your saved journey.',
      );
      app?.save(false);
    },
    { signal: events.signal },
  );
} catch (error) {
  dispose();
  console.error('Tanger failed to start:', error);
  root.innerHTML =
    '<main class="fatal-error"><h1>TANGER</h1><p>This world needs a browser with WebGL 2 and hardware acceleration enabled. Enable it in your browser settings and reload to try again.</p></main>';
}

if (import.meta.hot) import.meta.hot.dispose(dispose);
