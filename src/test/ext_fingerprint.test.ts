import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { extensionDataFingerprint, sha256 } from '../ext/fingerprint';

describe('EXT content fingerprint primitives', () => {
    it.each(['', 'abc', '架势 🐀', 'a'.repeat(1000), 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64)])('matches standard SHA-256 vector for %j', text => {
        expect(sha256(text)).toBe(createHash('sha256').update(text).digest('hex'));
    });
    it('canonicalizes object order, retains array order and rejects non-JSON values', () => {
        expect(extensionDataFingerprint({ a: 1, b: 2 })).toBe(extensionDataFingerprint({ b: 2, a: 1 }));
        expect(extensionDataFingerprint([1, 2])).not.toBe(extensionDataFingerprint([2, 1]));
        expect(() => extensionDataFingerprint({ value: Infinity })).toThrow();
    });
});
