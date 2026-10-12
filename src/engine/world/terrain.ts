/** Types de terrain, rangés du plus bas au plus haut */
export enum Terrain {
  DeepWater,
  ShallowWater,
  Sand,
  Grass,
  Forest,
  Hills,
  Mountain,
  Snow,
}

export interface TerrainInfo {
  name: string;
  /** Couleur RGB utilisée pour le rendu */
  color: readonly [number, number, number];
  /** Les mortels peuvent-ils y marcher ? (servira en v0.3) */
  walkable: boolean;
}

export const TERRAIN_INFO: Record<Terrain, TerrainInfo> = {
  [Terrain.DeepWater]:    { name: 'Océan profond',  color: [24, 52, 98],    walkable: false },
  [Terrain.ShallowWater]: { name: 'Eaux côtières',  color: [44, 96, 150],   walkable: false },
  [Terrain.Sand]:         { name: 'Plage',          color: [222, 204, 150], walkable: true },
  [Terrain.Grass]:        { name: 'Prairie',        color: [104, 160, 72],  walkable: true },
  [Terrain.Forest]:       { name: 'Forêt',          color: [52, 112, 56],   walkable: true },
  [Terrain.Hills]:        { name: 'Collines',       color: [128, 120, 84],  walkable: true },
  [Terrain.Mountain]:     { name: 'Montagne',       color: [112, 104, 100], walkable: false },
  [Terrain.Snow]:         { name: 'Sommet enneigé', color: [236, 240, 244], walkable: false },
};