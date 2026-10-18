/** Call-stack observation only; no entity fields, RNG or persistent history. */
const observers = new WeakMap<object, (status: string) => void>();
export function observeStatusIncreases(
  actor: object,
  observe: (status: string) => void
): () => void {
  const previous = observers.get(actor);
  observers.set(actor, observe);
  return () => {
    if (previous) observers.set(actor, previous);
    else observers.delete(actor);
  };
}
export function statusIncreased(actor: object, status: string): void {
  observers.get(actor)?.(status);
}
