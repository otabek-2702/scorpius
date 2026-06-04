// lib/sim/observable/BooleanProperty.ts
import { Property } from "./Property";
export class BooleanProperty extends Property<boolean> {
  toggle(): void { this.value = !this.value; }
}
