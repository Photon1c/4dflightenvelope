import type { TelemetryFrame } from '../io/loadJsonl';

export function getRegimeColor(regime: string): number {
    switch (regime) {
        case 'TAXI': return 0xaaaaaa;
        case 'CRUISE': return 0x00ff88;
        case 'MANEUVER': return 0xffff00;
        case 'RUPTURE': return 0xff0055;
        default: return 0x00ff88;
    }
}

export function getIVHV(frame: TelemetryFrame): number {
    return frame.iv / (frame.hv || 1e-9);
}

export function findNextFlag(frames: TelemetryFrame[], currentIndex: number): number {
    for (let i = currentIndex + 1; i < frames.length; i++) {
        if (frames[i].flags.length > 0) return i;
    }
    return currentIndex;
}

export function findPrevFlag(frames: TelemetryFrame[], currentIndex: number): number {
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (frames[i].flags.length > 0) return i;
    }
    return currentIndex;
}
