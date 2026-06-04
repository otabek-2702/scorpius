// lib/sim/observable/NumberProperty.ts
import { Property } from "./Property";

export interface NumberPropertyOpts {
  min?: number;
  max?: number;
  step?: number;
}

export class NumberProperty extends Property<number> {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  constructor(initial: number, opts: NumberPropertyOpts = {}) {
    super(initial);
    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step;
  }
  override set value(n: number) {
    let clamped = n;
    if (this.min !== undefined && clamped < this.min) clamped = this.min;
    if (this.max !== undefined && clamped > this.max) clamped = this.max;
    super.value = clamped;
  }
  override get value(): number { return super.value; }
}
