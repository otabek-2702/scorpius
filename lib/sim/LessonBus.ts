// lib/sim/LessonBus.ts
/**
 * LessonBus — shared observable state across cards within one lesson. Adopted
 * from Brilliant's pattern: a sim instance can persist across an explore-sandbox
 * card → pattern-discover card → challenge card, with the learner's accumulated
 * interactions intact (no reset between cards).
 *
 * Each lesson gets its own bus instance, created on lesson mount, disposed on
 * unmount. Sims register themselves under a string key; downstream cards can
 * subscribe to the same key and pull the live sim state.
 */
import { Property } from "./observable/Property";

type AnyValue = unknown;

export class LessonBus {
  private slots = new Map<string, Property<AnyValue>>();

  /** Register or fetch a slot. Subsequent calls with same key return the existing slot. */
  slot<T>(key: string, initial: T): Property<T> {
    if (!this.slots.has(key)) {
      this.slots.set(key, new Property<AnyValue>(initial));
    }
    return this.slots.get(key)! as Property<T>;
  }

  /** Read current value of a slot, or undefined if never set. */
  peek<T>(key: string): T | undefined {
    return this.slots.get(key)?.value as T | undefined;
  }

  dispose(): void {
    this.slots.forEach((p) => p.dispose());
    this.slots.clear();
  }
}
