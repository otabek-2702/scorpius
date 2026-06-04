// lib/sim/observable/DerivedProperty.ts
import { Property, type Unsubscribe } from "./Property";

export class DerivedProperty<T> extends Property<T> {
  private unsubs: Unsubscribe[];
  constructor(deps: Property<unknown>[], compute: () => T) {
    super(compute());
    this.unsubs = deps.map((d) => d.link(() => { super.value = compute(); }));
  }
  override dispose(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    super.dispose();
  }
}
