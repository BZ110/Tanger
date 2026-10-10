import './styles.css';
import { ThreeRenderer } from './adapters/three/three-renderer';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');

root.innerHTML =
  '<canvas class="viewport" aria-label="Empty Tanger viewport"></canvas><div class="workspace-status"><h1>Tanger</h1><p>No area loaded.</p></div>';
const canvas = root.querySelector<HTMLCanvasElement>('canvas');
if (!canvas) throw new Error('Missing viewport');

let viewport: ThreeRenderer | undefined;
try {
  viewport = new ThreeRenderer(canvas);
} catch (error) {
  console.error('Unable to initialize the viewport:', error);
  root.innerHTML =
    '<p class="startup-error">Unable to open the viewport. Check that WebGL 2 and hardware acceleration are enabled.</p>';
}

// No frame loop, input handlers, storage, or active area until content is supplied.
if (import.meta.hot) import.meta.hot.dispose(() => viewport?.dispose());
