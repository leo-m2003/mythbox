/** Nombre maximal de villages dans un monde */
export const MAX_VILLAGES = 256;

/**
 * Les villages, rangés en colonnes comme les habitants.
 *
 * Différence importante : chaque habitant retient le numéro de son village (People.village).
 * Ces numéros ne doivent donc jamais changer. Pas de « dernier qui prend la place » ici :
 * un village abandonné libère simplement sa case, qu'un futur village réutilisera.
 */
export class Villages {
  /** Tuile du centre du village */
  readonly x = new Int16Array(MAX_VILLAGES);
  readonly y = new Int16Array(MAX_VILLAGES);
  /** Nombre d'habitants rattachés au village */
  readonly population = new Uint16Array(MAX_VILLAGES);
  /** 1 si la case est occupée par un village, 0 si elle est libre */
  readonly active = new Uint8Array(MAX_VILLAGES);

  /** Nombre de villages actifs */
  count = 0;

  /** Fonde un village (vide) sur la tuile (x, y). Renvoie son numéro, ou -1 s'il n'y a plus de place */
  found(x: number, y: number): number {
    for (let v = 0; v < MAX_VILLAGES; v++) {
      if (this.active[v]) continue;
      this.active[v] = 1;
      this.x[v] = x;
      this.y[v] = y;
      this.population[v] = 0;
      this.count++;
      return v;
    }
    return -1;
  }

  join(v: number): void {
    this.population[v]++;
  }

  /** Un habitant quitte le village v (départ ou mort). Le dernier à partir l'abandonne */
  leave(v: number): void {
    this.population[v]--;
    if (this.population[v] === 0) {
      this.active[v] = 0;
      this.count--;
    }
  }

  /** Le village actif le plus proche de la tuile (x, y), à `radius` tuiles au plus, ou -1 */
  nearest(x: number, y: number, radius: number): number {
    let best = -1;
    let bestDistance = radius * radius;
    for (let v = 0; v < MAX_VILLAGES; v++) {
      if (!this.active[v]) continue;
      const distance = (this.x[v] - x) ** 2 + (this.y[v] - y) ** 2;
      if (distance <= bestDistance) {
        best = v;
        bestDistance = distance;
      }
    }
    return best;
  }
}