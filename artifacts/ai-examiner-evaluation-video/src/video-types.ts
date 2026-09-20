export type SceneId = 0 | 1 | 2 | 3 | 4;

export interface SceneProps {
  progress: number;
  sceneIndex: SceneId;
}