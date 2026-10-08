/** Session-only dirty generations; never serialized or part of the state contract. */
const revisions = new WeakMap<object, number>();
export function markRecordingRoot(root: object): void {
  revisions.set(root, (revisions.get(root) ?? 0) + 1);
}
export function recordingRootRevision(root: object | null | undefined): number {
  return root ? (revisions.get(root) ?? 0) : 0;
}

/** Restore only generations touched by an explicitly captured synchronous write set. */
export function checkpointRecordingRoots(roots:readonly object[]):()=>void {
  const old=roots.map(root=>({root,revision:revisions.get(root)}));
  return()=>{for(const {root,revision} of old){if(revision===undefined)revisions.delete(root);else revisions.set(root,revision);}};
}
