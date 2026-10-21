/** Nombre maximal d'habitants dans un monde */
export const MAX_PEOPLE = 4096;

/**
 * Les habitants, rangés « en colonnes » : un tableau typé par caractéristique.
 * L'habitant n° i est à la position (x[i], y[i]) et marche vers (targetX[i], targetY[i]).
 *
 * Ce format est rapide à parcourir, ne crée aucun objet pendant la partie,
 * et sera simple à sauvegarder ou à envoyer à un Web Worker.
 * Les habitants vivants occupent toujours les cases 0 à count - 1.
 */
export class People {
  /** Position, en tuiles (le centre de la tuile (3, 5) est en (3.5, 5.5)) */
  readonly x = new Float32Array(MAX_PEOPLE);
  readonly y = new Float32Array(MAX_PEOPLE);
  /** Destination de la promenade en cours */
  readonly targetX = new Float32Array(MAX_PEOPLE);
  readonly targetY = new Float32Array(MAX_PEOPLE);
  /** Nombre de pas de simulation à attendre avant de repartir */
  readonly wait = new Uint8Array(MAX_PEOPLE);
  /** Faim, en pas de simulation depuis le dernier repas complet (0 = rassasié) */
  readonly hunger = new Uint16Array(MAX_PEOPLE);
  /**
   * Âge, en pas de simulation (3 600 pas = 1 an).
   * Uint32 : un Uint16 s'arrête à 65 535 pas, soit à peine 18 ans.
   */
  readonly age = new Uint32Array(MAX_PEOPLE);
  /** Âge auquel il mourra de vieillesse, en pas */
  readonly lifespan = new Uint32Array(MAX_PEOPLE);
  /** Pas à attendre avant de pouvoir avoir un nouvel enfant */
  readonly birthCooldown = new Uint16Array(MAX_PEOPLE);
  /** Numéro de son village, ou -1 s'il n'en a pas */
  readonly village = new Int16Array(MAX_PEOPLE);

  /** Nombre d'habitants vivants */
  count = 0;

  /** Toutes les colonnes, pour les déplacer d'un coup dans remove() */
  private readonly columns = [
    this.x,
    this.y,
    this.targetX,
    this.targetY,
    this.wait,
    this.hunger,
    this.age,
    this.lifespan,
    this.birthCooldown,
    this.village,
  ];

  /**
   * Ajoute un nouveau-né au centre de la tuile (tileX, tileY). Renvoie son numéro, ou -1 si c'est complet.
   * Sans durée de vie précisée, il vit le maximum possible (plus de 4 milliards de pas, des millions d'années) :
   * pratique pour les tests.
   */
  add(tileX: number, tileY: number, lifespan = 0xffffffff): number {
    if (this.count >= MAX_PEOPLE) return -1;

    const i = this.count++;
    this.x[i] = this.targetX[i] = tileX + 0.5;
    this.y[i] = this.targetY[i] = tileY + 0.5;
    this.wait[i] = 0;
    this.hunger[i] = 0;
    this.age[i] = 0;
    this.lifespan[i] = lifespan;
    this.birthCooldown[i] = 0;
    this.village[i] = -1;
    return i;
  }

  /**
   * Retire l'habitant i. Le dernier habitant prend sa place,
   * pour que les vivants restent groupés au début des tableaux.
   * Attention : les numéros changent, il faut donc parcourir à l'envers si on retire en boucle.
   */
  remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const column of this.columns) {
      column[i] = column[last];
    }
  }
}
