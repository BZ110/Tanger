export interface GameSettings {
  quality: 'low' | 'medium' | 'high';
  sensitivity: number;
  cameraShake: boolean;
  impactSlowdown: boolean;
  volume: number;
}
export const defaultSettings: GameSettings = {
  quality: 'medium',
  sensitivity: 1,
  cameraShake: true,
  impactSlowdown: true,
  volume: 0.4,
};
