import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordingJsonAtBoundary, type RecordingExportSource } from '../ui/recordingExport';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('recording export UI boundary', () => {
    it('waits for the final checkpoint without exporting a partial command', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('window', { setTimeout });
        const source = { hasCompleteRecording: true, canExportRecording: false,
            exportRecording: vi.fn(() => ({ events: [{ end: true }] })) };
        const result = recordingJsonAtBoundary(source, () => true);
        await vi.advanceTimersByTimeAsync(50);
        expect(source.exportRecording).not.toHaveBeenCalled();
        source.canExportRecording = true;
        await vi.advanceTimersByTimeAsync(25);
        expect(JSON.parse(await result)).toEqual({ events: [{ end: true }] });
        expect(source.exportRecording).toHaveBeenCalledTimes(1);
    });

    it('does not save a replacement game under a queued request', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('window', { setTimeout });
        let current = true;
        const source = { hasCompleteRecording: true, canExportRecording: false, exportRecording: vi.fn() };
        const result = recordingJsonAtBoundary(source, () => current);
        const rejected = expect(result).rejects.toMatchObject({ code: 'replaced' });
        current = false;
        await vi.advanceTimersByTimeAsync(25);
        await rejected;
        expect(source.exportRecording).not.toHaveBeenCalled();
    });

    it('rejects incomplete sources and stops waiting without cancelling simulation', async () => {
        const missing: RecordingExportSource = { hasCompleteRecording: false, canExportRecording: false, exportRecording: vi.fn() };
        await expect(recordingJsonAtBoundary(missing, () => true)).rejects.toMatchObject({ code: 'unavailable' });
        vi.useFakeTimers();
        vi.stubGlobal('window', { setTimeout });
        const busy = { ...missing, hasCompleteRecording: true };
        const result = recordingJsonAtBoundary(busy, () => true);
        const rejected = expect(result).rejects.toMatchObject({ code: 'busy' });
        await vi.advanceTimersByTimeAsync(30_000);
        await rejected;
        expect(busy.exportRecording).not.toHaveBeenCalled();
    });
});
