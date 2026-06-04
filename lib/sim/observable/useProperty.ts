"use client";
import { useEffect, useState } from "react";
import type { Property } from "./Property";

/** Subscribe a React component to a Property<T>. Re-renders on value change. */
export function useProperty<T>(property: Property<T>): T {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = property.link(() => setTick((n) => n + 1));
    return unsub;
  }, [property]);
  return property.value;
}
