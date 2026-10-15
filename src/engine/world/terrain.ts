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
  /** Les mortels peuvent-ils y marcher ? */
  walkable: boolean;
  /** Nourriture que la tuile peut porter, en portions (baies, gibier…) */
  food: number;
  /** Chance, à chaque pas, qu'un feu voisin s'y propage (0 = ne brûle pas) */
  flammability: number;
  /** Durée de l'incendie sur la tuile, en pas de simulation */
  burnTicks: number;
}

export const TERRAIN_INFO: Record<Terrain, TerrainInfo> = {
  [Terrain.DeepWater]:    { name: 'Océan profond',  color: [24, 52, 98],    walkable: false, food: 0, flammability: 0, burnTicks: 0 },
  [Terrain.ShallowWater]: { name: 'Eaux côtières',  color: [44, 96, 150],   walkable: false, food: 0, flammability: 0, burnTicks: 0 },
  [Terrain.Sand]:         { name: 'Plage',          color: [222, 204, 150], walkable: true,  food: 0, flammability: 0, burnTicks: 0 },
  [Terrain.Grass]:        { name: 'Prairie',        color: [104, 160, 72],  walkable: true,  food: 2, flammability: 0.015, burnTicks: 25 },
  [Terrain.Forest]:       { name: 'Forêt',          color: [52, 112, 56],   walkable: true,  food: 4, flammability: 0.08, burnTicks: 60 },
  [Terrain.Hills]:        { name: 'Collines',       color: [128, 120, 84],  walkable: true,  food: 1, flammability: 0.005, burnTicks: 30 },
  [Terrain.Mountain]:     { name: 'Montagne',       color: [112, 104, 100], walkable: false, food: 0, flammability: 0, burnTicks: 0 },
  [Terrain.Snow]:         { name: 'Sommet enneigé', color: [236, 240, 244], walkable: false, food: 0, flammability: 0, burnTicks: 0 },
};