/** Session-only dirty generations; never serialized or part of the state contract. */
const revisions = new WeakMap<object, number>();
export function markRecordingRoot(root: object): void {
  revisions.set(root, (revisions.get(root) ?? 0) + 1);
}
export function recordingRootRevision(root: object | null | undefined): number {
  return root ? (revisions.get(root) ?? 0) : 0;
}
