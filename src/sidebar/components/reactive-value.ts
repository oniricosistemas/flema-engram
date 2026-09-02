import type { Accessor } from "solid-js";

export type ReactiveValue<T> = T | Accessor<T>;

export function readReactive<T>(value: ReactiveValue<T>): T {
  return typeof value === "function" ? (value as Accessor<T>)() : value;
}
