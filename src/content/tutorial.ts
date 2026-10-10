export interface TutorialStep {
  readonly title: string;
  readonly instruction: string;
  readonly goal: number;
}
export const tutorialSteps: readonly TutorialStep[] = [
  {
    title: 'Movement',
    instruction:
      'Walk to the illuminated floor marker. Use WASD or the arrow keys.',
    goal: 1,
  },
  {
    title: 'Basic attacks',
    instruction:
      'Approach the training unit. Land three hits with left click or J.',
    goal: 3,
  },
  {
    title: 'Dash',
    instruction: 'Use Space or K to dash. Complete three dashes.',
    goal: 3,
  },
  {
    title: 'Evade',
    instruction:
      'The unit will pulse red before attacking. Dash through one attack.',
    goal: 1,
  },
  {
    title: 'Practice',
    instruction:
      'Land five more hits. The unit now attacks between your strikes.',
    goal: 5,
  },
  {
    title: 'Complete',
    instruction:
      'Training complete. Continue practicing, restart, or return to the title.',
    goal: 1,
  },
];

export const combatConfig = {
  walkSpeed: 4.7,
  sprintSpeed: 7,
  acceleration: 28,
  playerRadius: 0.36,
  dashSpeed: 16,
  dashDuration: 0.19,
  dashCooldown: 0.65,
  attackDuration: 0.48,
  strikeAt: 0.19,
  attackReach: 2.5,
  attackArc: 1.5,
  impactFreeze: 0.055,
  impactSlowdown: 0.14,
  slowScale: 0.27,
  trainingWindup: 0.7,
  trainingRecovery: 1.4,
  trainingReach: 2.7,
  targetRadius: 0.6,
  targetDamage: 12,
  playerMaxHealth: 100,
} as const;
