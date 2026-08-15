import { OpitState } from "./EditorObserver";

/**
 * DirectionManager tracks which way the companion sprite faces.
 * Direction: 1 = Facing Right, -1 = Facing Left
 */
export class DirectionManager {
  private direction: 1 | -1 = 1;

  /**
   * Updates facing direction based on the current OpitState.
   * Delete/attack actions face left (towards deleted text).
   * Typing and right-arrow face right (towards new text).
   */
  public update(state: OpitState): void {
    switch (state) {
      // Face LEFT — attacking / deleting backwards
      case "delete":
      case "bulk_delete":
      case "slow_attack":
      case "fast_attack":
      case "arrow_left":
      case "stuck_left":
        this.direction = -1;
        break;

      // Face RIGHT — typing / moving forward
      case "typing":
      case "arrow_right":
        this.direction = 1;
        break;

      // All other states preserve current direction
      default:
        break;
    }
  }

  public get(): 1 | -1 {
    return this.direction;
  }
}
