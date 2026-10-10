import { computeCheckpoint, checkpointIdentity, type CheckpointJob } from './RecordingCheckpoint';
/** No Game, UI, services or RNG imports: only frozen bytes and pure calculation. */
const worker = globalThis as unknown as {
  onmessage: (event: MessageEvent<CheckpointJob & { requestId: number }>) => void;
  postMessage(value: unknown): void;
};
worker.onmessage = ({ data }) => {
  try { worker.postMessage({ requestId: data.requestId, result: computeCheckpoint(data) }); }
  catch (error) { worker.postMessage({ requestId: data.requestId, identity: checkpointIdentity(data), calculationError: String(error) }); }
};
