import type { TelemetryFrame } from '../io/loadJsonl';

export interface GeneratorParams {
    steps: number;
    startSpot: number;
    startIv: number;
    targetIv: number;
    atr: number;
    flip: number;
    putWall: number;
    callWall: number;
}

export function generateSyntheticPath(params: GeneratorParams): TelemetryFrame[] {
    const frames: TelemetryFrame[] = [];
    let currentSpot = params.startSpot;
    let currentIv = params.startIv;
    const hv = 0.12; // Static HV for simplicity

    for (let i = 0; i < params.steps; i++) {
        // Simple drift toward targetIv
        currentIv += (params.targetIv - currentIv) * 0.05 + (Math.random() - 0.5) * 0.01;
        currentIv = Math.max(0.01, currentIv);

        // Random walk spot
        currentSpot += (Math.random() - 0.5) * params.atr * 0.5;

        // Map to X, Y, Z
        const x = Math.abs(currentSpot - params.flip) / (params.atr || 1e-9);
        const y = currentIv / (hv || 1e-9);
        
        // Z: Normalized wall proximity (0 at wall, 1 at flip)
        let z = 0;
        if (currentSpot >= params.flip) {
            z = Math.abs(params.callWall - currentSpot) / Math.abs(params.callWall - params.flip);
        } else {
            z = Math.abs(params.putWall - currentSpot) / Math.abs(params.putWall - params.flip);
        }

        // Determine regime
        let regime: 'TAXI' | 'CRUISE' | 'MANEUVER' | 'RUPTURE' = 'CRUISE';
        if (y > 2.5 || x > 4.5) regime = 'RUPTURE';
        else if (x < 0.3) regime = 'TAXI';
        else if (y > 1.5 || x > 2.5) regime = 'MANEUVER';

        const flags: string[] = [];
        if (currentSpot > params.callWall || currentSpot < params.putWall) flags.push('BREACH');

        frames.push({
            timestamp: i,
            spot: currentSpot,
            iv: currentIv,
            hv: hv,
            x: x,
            y: y,
            z: z,
            regime: regime,
            flags: flags
        });
    }

    return frames;
}
