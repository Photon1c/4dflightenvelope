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

export interface CustomScenarioParams {
    spot: number;
    flip: number;
    putWall: number;
    callWall: number;
    iv: number; // percent (e.g., 13.69)
    hv: number; // percent (e.g., 7.79)
    atr: number;
    ivRank?: number;
    ivPercentile?: number;
    durationMinutes?: number;
    frameCount: number;
    scenarioType: 'hold' | 'false_breakdown' | 'breakout' | 'mean_revert';
}

export function generateCustomScenario(params: CustomScenarioParams): TelemetryFrame[] {
    const frames: TelemetryFrame[] = [];
    const ivDecimal = params.iv / 100; // Convert percent to decimal
    const hvDecimal = params.hv / 100; // Convert percent to decimal
    let currentSpot = params.spot;
    
    const frameCount = params.frameCount || 450;
    const duration = params.durationMinutes || 90;
    const dt = duration / frameCount; // Time per frame in minutes
    
    let breached = false;
    
    for (let i = 0; i < frameCount; i++) {
        const t = i * dt;
        const progress = i / frameCount;
        
        // Scenario-specific spot movement
        switch (params.scenarioType) {
            case 'hold':
                // Slight drift around start spot
                currentSpot = params.spot + (Math.random() - 0.5) * params.atr * 0.1;
                break;
                
            case 'false_breakdown':
                // Dip below putWall then recover
                if (progress < 0.25) {
                    // Dip phase
                    const dipProgress = progress / 0.25;
                    currentSpot = params.spot - (params.spot - params.putWall - params.atr * 0.5) * dipProgress * 0.8;
                } else if (progress < 0.3) {
                    // Recover phase
                    const recoverProgress = (progress - 0.25) / 0.05;
                    currentSpot = params.putWall - params.atr * 0.5 + (params.spot - (params.putWall - params.atr * 0.5)) * recoverProgress;
                } else {
                    // Return to near start
                    currentSpot = params.spot + (Math.random() - 0.5) * params.atr * 0.1;
                }
                break;
                
            case 'breakout':
                // Drift up and breach callWall
                if (progress < 0.75) {
                    // Drift phase
                    const driftProgress = progress / 0.75;
                    currentSpot = params.spot + (params.callWall - params.spot + params.atr * 0.5) * driftProgress * 0.8;
                } else {
                    // Breach phase
                    currentSpot = params.callWall + params.atr * (progress - 0.75) * 2;
                }
                break;
                
            case 'mean_revert':
                // Oscillate around flip with decaying amplitude
                const freq = 2 * Math.PI * (i / frameCount) * 2; // 2 full cycles
                const amplitude = params.atr * 0.5 * (1 - progress * 0.5); // Decaying
                currentSpot = params.flip + Math.sin(freq) * amplitude;
                break;
        }
        
        // Compute X, Y, Z coordinates
        const x = Math.abs(currentSpot - params.flip) / (params.atr || 1e-9);
        const y = ivDecimal / (hvDecimal || 1e-9);
        
        // Z: Normalized wall proximity (0 at wall, 1 at flip) - consistent with existing usage
        let z = 0;
        if (currentSpot >= params.flip) {
            z = Math.abs(params.callWall - currentSpot) / (Math.abs(params.callWall - params.flip) || 1e-9);
        } else {
            z = Math.abs(params.putWall - currentSpot) / (Math.abs(params.putWall - params.flip) || 1e-9);
        }
        
        // Determine regime based on X
        let regime: 'TAXI' | 'CRUISE' | 'MANEUVER' | 'RUPTURE' = 'CRUISE';
        if (x >= 3) regime = 'RUPTURE';
        else if (x < 0.5) regime = 'TAXI';
        else if (x >= 1.5) regime = 'MANEUVER';
        // else: CRUISE (0.5 <= x < 1.5)
        
        // Flags
        const flags: string[] = [];
        const distToFlip = Math.abs(currentSpot - params.flip);
        const distToPut = Math.abs(currentSpot - params.putWall);
        const distToCall = Math.abs(currentSpot - params.callWall);
        const minDistToWall = Math.min(distToPut, distToCall);
        
        const isFlipTest = distToFlip < params.atr * 0.1;
        const isWallTest = minDistToWall < params.atr * 0.2;
        const isBreach = currentSpot > params.callWall || currentSpot < params.putWall;
        
        if (isFlipTest) flags.push('FLIP_TEST');
        if (isWallTest) flags.push('WALL_TEST');
        if (isBreach) {
            flags.push('BREACH');
            breached = true;
        }
        if (breached) {
            regime = 'RUPTURE';
        }
        
        frames.push({
            timestamp: t,
            spot: currentSpot,
            iv: ivDecimal,
            hv: hvDecimal,
            x: x,
            y: y,
            z: z,
            regime: regime,
            flags: flags
        });
    }
    
    return frames;
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
