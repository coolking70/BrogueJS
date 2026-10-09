/** Wait for a whole command checkpoint; never advance or cancel the simulation. */
export interface RecordingExportSource {
    readonly hasCompleteRecording: boolean;
    readonly canExportRecording: boolean;
    exportRecording(): unknown;
    exportRecordingAsync?(): Promise<unknown>;
}

export class RecordingExportError extends Error {
    constructor(public readonly code: 'unavailable' | 'replaced' | 'busy') {
        super(code);
    }
}

export async function recordingJsonAtBoundary(
    source: RecordingExportSource,
    isCurrent: () => boolean,
): Promise<string> {
    const deadline = Date.now() + 30_000;
    while (true) {
        if (!isCurrent()) throw new RecordingExportError('replaced');
        if (!source.hasCompleteRecording) throw new RecordingExportError('unavailable');
        if (source.canExportRecording) {
            const recording = source.exportRecordingAsync ? await source.exportRecordingAsync() : source.exportRecording();
            if (!isCurrent()) throw new RecordingExportError('replaced');
            return JSON.stringify(recording);
        }
        if (Date.now() >= deadline) throw new RecordingExportError('busy');
        await new Promise<void>(resolve => window.setTimeout(resolve, 25));
    }
}
