// lib/sim/observable/Property.ts
/**
 * Port of PhET Axon's Property<T> — the foundational observable for our sim
 * model layer. Replaces ad-hoc React useState for sim model state. Pure TS,
 * zero React dependency — model is React-agnostic.
 *
 * Reference: github.com/phetsims/axon/blob/main/js/Property.ts
 * License: MIT (axon repo)
 */
export type Listener<T> = (newValue: T, oldValue: T) => void;
export type Unsubscribe = () => void;

export class Property<T> {
  private _value: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get value(): T { return this._value; }

  set value(next: T) {
    if (Object.is(this._value, next)) return;
    const prev = this._value;
    this._value = next;
    this.listeners.forEach((l) => l(next, prev));
  }

  /** Equivalent to setting `.value` — exists for API parity with PhET. */
  set(next: T): void { this.value = next; }
  get(): T { return this._value; }

  /** Subscribe to changes. Returns unsubscribe function. */
  link(listener: Listener<T>): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Subscribe AND fire once immediately with current value. */
  linkAndCallNow(listener: Listener<T>): Unsubscribe {
    listener(this._value, this._value);
    return this.link(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }
}
