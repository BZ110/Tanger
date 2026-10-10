import type { GameSnapshot } from '../../game/simulation';
import type { GameSettings } from '../../content/settings';

export type Screen =
  | 'title'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'settings'
  | 'controls'
  | 'error';
export interface InterfaceActions {
  play(): void;
  cancelLoading(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  title(): void;
  settings(): void;
  controls(): void;
  back(): void;
  changeSettings(settings: GameSettings): void;
}

function element<T extends Element>(root: HTMLElement, selector: string): T {
  const result = root.querySelector<T>(selector);
  if (!result) throw new Error(`Missing interface element ${selector}`);
  return result;
}
export class GameInterface {
  readonly canvas: HTMLCanvasElement;
  readonly touchControls: HTMLElement;
  private readonly events = new AbortController();
  private screen: Screen = 'title';
  private readonly sections: NodeListOf<HTMLElement>;
  private readonly instruction: HTMLElement;
  private readonly stepTitle: HTMLElement;
  private readonly stepNumber: HTMLElement;
  private readonly stepProgress: HTMLElement;
  private readonly health: HTMLElement;
  private readonly healthBar: HTMLElement;
  private readonly dashBar: HTMLElement;
  private readonly hitCount: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly stepLabel: HTMLElement;
  private lastStep = -1;

  constructor(
    private readonly root: HTMLElement,
    settings: GameSettings,
    actions: InterfaceActions,
  ) {
    root.innerHTML = `
      <canvas class="viewport" tabindex="0" aria-label="TANGER tutorial game"></canvas>
      <section class="title-screen screen" data-screen="title" aria-label="TANGER start screen">
        <div class="title-grid" aria-hidden="true"></div>
        <header class="title-header"><span><i></i> TANGER / TRAINING CLIENT</span><span>EARLY BUILD <b>002</b></span></header>
        <main class="title-main"><span class="overline">LOCAL SESSION / 01</span><h1>TANGER</h1><div class="title-line"></div><p class="title-description">A place to start.</p>
          <nav class="title-menu" aria-label="Main menu"><button class="play-button" data-action="play"><span>PLAY</span><span aria-hidden="true">↗</span></button><button data-action="settings"><span>SETTINGS</span><span class="menu-index">02</span></button><button data-action="controls"><span>CONTROLS</span><span class="menu-index">03</span></button></nav>
          <p class="enter-hint"><kbd>ENTER</kbd> START TRAINING</p>
        </main>
        <aside class="training-preview"><span class="overline">AVAILABLE AREA</span><h2>TRAINING FLOOR</h2><p>Movement. Contact. Evasion.</p><div><span class="online-dot"></span> LOCAL TUTORIAL <span>01 / 01</span></div></aside>
        <footer class="title-footer"><span>INDEPENDENT WORLDS. SHARED POSSIBILITIES.</span><span>V 0.2.0 <i></i> TANGER</span></footer>
      </section>
      <section class="loading-screen screen" data-screen="loading" hidden aria-label="Loading tutorial"><div class="loading-content"><span class="overline">TANGER / INITIALIZATION</span><h2>PREPARING TRAINING</h2><div class="loading-track"><span data-loading-bar></span></div><div class="loading-meta"><span data-loading-label role="status">Reading area…</span><span data-loading-percent>0%</span></div><button class="text-button" data-action="cancelLoading">Cancel</button></div></section>
      <section class="game-hud screen" data-screen="playing" hidden aria-label="Training interface">
        <header class="game-header"><span class="game-brand">TANGER <small>TRAINING / 01</small></span><button data-action="pause" class="pause-button"><kbd>ESC</kbd> MENU</button></header>
        <aside class="objective"><div class="objective-meta"><span>TRAINING PROTOCOL</span><span data-step-number>01 / 05</span></div><h2 data-step-title>Movement</h2><p data-instruction></p><div class="objective-progress"><span data-progress></span></div></aside>
        <div class="impact-feedback" data-feedback aria-live="polite"></div>
        <footer class="combat-hud"><div class="health-panel"><div><span>OPERATOR</span><span data-health>100</span></div><div class="health-track"><span data-health-bar></span></div><small>TRAINING MODE / RECOVER ON DEFEAT</small></div><div class="combat-readout"><span data-step-label>WASD / MOVE</span><small data-hit-count>0 CONTACTS</small></div><div class="ability-panel"><div class="ability"><kbd>J</kbd><span>STRIKE</span></div><div class="ability"><kbd>SPACE</kbd><span>DASH</span><div class="dash-track"><span data-dash-bar></span></div></div></div></footer>
        <div class="touch-controls" aria-label="Touch controls"><div class="touch-move"><button data-input="KeyW" aria-label="Move forward">↑</button><div><button data-input="KeyA" aria-label="Move left">←</button><button data-input="KeyS" aria-label="Move backward">↓</button><button data-input="KeyD" aria-label="Move right">→</button></div></div><div><button data-input="attack" aria-label="Attack">J</button><button data-input="dash" aria-label="Dash">↗</button></div></div>
      </section>
      <section class="modal-screen screen" data-screen="paused" hidden aria-label="Pause menu"><div class="menu-panel"><span class="overline">TANGER / PAUSED</span><h2>TAKE A MOMENT.</h2><div class="modal-actions"><button class="primary-button" data-action="resume">Resume training <span>↗</span></button><button data-action="settings">Settings</button><button data-action="restart">Restart tutorial</button><button data-action="title">Return to title</button></div></div></section>
      <section class="modal-screen screen" data-screen="settings" hidden aria-label="Settings"><div class="settings-panel"><div class="panel-header"><div><span class="overline">TANGER / PREFERENCES</span><h2>SETTINGS</h2></div><button data-action="back" class="close-button" aria-label="Close settings">✕</button></div>
        <label class="setting-row"><span><strong>Graphics quality</strong><small>Resolution, shadows, and bloom</small></span><select name="quality" aria-label="Graphics quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label class="setting-row"><span><strong>Camera sensitivity</strong><small>Right-drag to look around</small></span><input name="sensitivity" aria-label="Camera sensitivity" type="range" min="0.3" max="2" step="0.1"></label>
        <label class="setting-row"><span><strong>Camera shake</strong><small>Impact movement</small></span><input name="cameraShake" type="checkbox" aria-label="Camera shake"></label>
        <label class="setting-row"><span><strong>Combat slowdown</strong><small>Brief impact freeze and slow motion</small></span><input name="impactSlowdown" type="checkbox" aria-label="Combat slowdown"></label>
        <label class="setting-row"><span><strong>Effects volume</strong><small>Combat and training cues</small></span><input name="volume" aria-label="Effects volume" type="range" min="0" max="1" step="0.05"></label>
        <p class="settings-note">Changes apply immediately for this session.</p><button data-action="back" class="primary-button">Done <span>↗</span></button>
      </div></section>
      <section class="modal-screen screen" data-screen="controls" hidden aria-label="Controls"><div class="settings-panel"><div class="panel-header"><div><span class="overline">TANGER / INPUT</span><h2>CONTROLS</h2></div><button data-action="back" class="close-button" aria-label="Close controls">✕</button></div><div class="control-row"><span>Move</span><kbd>WASD / ARROWS</kbd></div><div class="control-row"><span>Sprint</span><kbd>SHIFT</kbd></div><div class="control-row"><span>Basic attack</span><kbd>LEFT CLICK / J</kbd></div><div class="control-row"><span>Dash / evade</span><kbd>SPACE / K</kbd></div><div class="control-row"><span>Orbit camera</span><kbd>RIGHT DRAG</kbd></div><div class="control-row"><span>Pause</span><kbd>ESC</kbd></div><p class="settings-note">Touch: directional buttons to move; drag the scene to orbit.</p><button data-action="back" class="primary-button">Back <span>↗</span></button></div></section>
      <section class="modal-screen screen" data-screen="error" hidden aria-label="Loading error"><div class="menu-panel"><span class="overline">TANGER / CONNECTION</span><h2>COULD NOT START.</h2><p data-error role="alert"></p><button data-action="play" class="primary-button">Try again <span>↗</span></button><button data-action="title" class="text-button">Return to title</button></div></section>
    `;
    this.canvas = element(root, 'canvas');
    this.touchControls = element(root, '.touch-controls');
    this.sections = root.querySelectorAll('[data-screen]');
    this.instruction = element(root, '[data-instruction]');
    this.stepTitle = element(root, '[data-step-title]');
    this.stepNumber = element(root, '[data-step-number]');
    this.stepProgress = element(root, '[data-progress]');
    this.health = element(root, '[data-health]');
    this.healthBar = element(root, '[data-health-bar]');
    this.dashBar = element(root, '[data-dash-bar]');
    this.hitCount = element(root, '[data-hit-count]');
    this.feedback = element(root, '[data-feedback]');
    this.stepLabel = element(root, '[data-step-label]');
    const options = { signal: this.events.signal };
    root.addEventListener(
      'click',
      (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          '[data-action]',
        );
        const action = button?.dataset.action as
          keyof Omit<InterfaceActions, 'changeSettings'> | undefined;
        if (action) actions[action]();
      },
      options,
    );
    root
      .querySelector('[data-screen="settings"]')!
      .addEventListener(
        'input',
        () => actions.changeSettings(this.readSettings()),
        options,
      );
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.repeat) return;
        if (
          event.code === 'Enter' &&
          this.screen === 'title' &&
          event.target === document.body
        ) {
          event.preventDefault();
          actions.play();
        }
        if (event.code === 'Escape') {
          event.preventDefault();
          if (this.screen === 'playing') actions.pause();
          else if (this.screen === 'paused') actions.resume();
          else if (this.screen === 'settings' || this.screen === 'controls')
            actions.back();
          else if (this.screen === 'loading') actions.cancelLoading();
        }
      },
      options,
    );
    this.writeSettings(settings);
  }

  show(screen: Screen): void {
    this.screen = screen;
    this.root.dataset.screen = screen;
    for (const section of this.sections)
      section.hidden = section.dataset.screen !== screen;
    if (screen === 'playing') this.canvas.focus();
    else if (screen !== 'loading') {
      const focus = this.root.querySelector<HTMLElement>(
        `[data-screen="${screen}"] button`,
      );
      focus?.focus();
    }
  }
  loading(progress: number, label: string): void {
    element<HTMLElement>(this.root, '[data-loading-bar]').style.width =
      `${Math.round(progress * 100)}%`;
    element(this.root, '[data-loading-percent]').textContent =
      `${Math.round(progress * 100)}%`;
    element(this.root, '[data-loading-label]').textContent = label;
  }
  error(message: string): void {
    element(this.root, '[data-error]').textContent = message;
    this.show('error');
  }
  update(snapshot: GameSnapshot): void {
    const { tutorial } = snapshot;
    if (this.lastStep !== tutorial.step) {
      this.stepTitle.textContent = tutorial.title;
      this.instruction.textContent = tutorial.instruction;
      this.stepNumber.textContent =
        tutorial.step === 5
          ? 'COMPLETE'
          : `${String(tutorial.step + 1).padStart(2, '0')} / 05`;
      this.stepLabel.textContent =
        tutorial.step === 0
          ? 'WASD / MOVE'
          : tutorial.step === 1 || tutorial.step === 4
            ? 'J / STRIKE'
            : tutorial.step === 2 || tutorial.step === 3
              ? 'SPACE / DASH'
              : 'FREE PRACTICE';
      this.lastStep = tutorial.step;
    }
    this.stepProgress.style.width = `${tutorial.step === 5 ? 100 : (tutorial.progress / tutorial.goal) * 100}%`;
    this.health.textContent = String(snapshot.player.health);
    this.healthBar.style.width = `${snapshot.player.health}%`;
    this.dashBar.style.width = `${snapshot.dashReady * 100}%`;
    this.hitCount.textContent = `${snapshot.target.hits} CONTACTS`;
    this.feedback.textContent =
      snapshot.timeScale < 1
        ? 'CONTACT'
        : snapshot.target.windup > 0
          ? 'INCOMING'
          : '';
    this.root.dataset.tutorialStep = String(tutorial.step);
    this.root.dataset.playerX = String(snapshot.player.position.x);
    this.root.dataset.playerZ = String(snapshot.player.position.z);
    this.root.dataset.timeScale = String(snapshot.timeScale);
    this.root.dataset.hits = String(snapshot.target.hits);
  }
  private writeSettings(settings: GameSettings): void {
    element<HTMLSelectElement>(this.root, '[name="quality"]').value =
      settings.quality;
    for (const key of ['sensitivity', 'volume'] as const)
      element<HTMLInputElement>(this.root, `[name="${key}"]`).value = String(
        settings[key],
      );
    for (const key of ['cameraShake', 'impactSlowdown'] as const)
      element<HTMLInputElement>(this.root, `[name="${key}"]`).checked =
        settings[key];
  }
  private readSettings(): GameSettings {
    return {
      quality: element<HTMLSelectElement>(this.root, '[name="quality"]')
        .value as GameSettings['quality'],
      sensitivity: Number(
        element<HTMLInputElement>(this.root, '[name="sensitivity"]').value,
      ),
      volume: Number(
        element<HTMLInputElement>(this.root, '[name="volume"]').value,
      ),
      cameraShake: element<HTMLInputElement>(this.root, '[name="cameraShake"]')
        .checked,
      impactSlowdown: element<HTMLInputElement>(
        this.root,
        '[name="impactSlowdown"]',
      ).checked,
    };
  }
  dispose(): void {
    this.events.abort();
    this.root.replaceChildren();
  }
}
