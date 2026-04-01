import { describe, it, expect } from 'vitest';
import { calculateRotation } from './math.js';

describe('Math Utils', () => {
    it('should calculate correct rotation based on elapsed time', () => {
        const time = 10;
        const speed = 0.5;
        expect(calculateRotation(time, speed)).toBe(5);
    });

    it('should use default speed of 1 if not provided', () => {
        const time = 10;
        expect(calculateRotation(time)).toBe(10);
    });
});
