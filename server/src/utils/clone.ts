export function clone<T>(instance: T): T {
  const copy = new (instance!.constructor as { new (): T })();
  Object.assign(copy as object, instance);
  return copy;
}
