import type { TelemetryFrame } from '../io/loadJsonl';

export class HUD {
    container: HTMLElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'hud';
        this.container.style.position = 'absolute';
        this.container.style.top = '20px';
        this.container.style.left = '20px';
        this.container.style.padding = '15px';
        this.container.style.background = 'rgba(0, 20, 0, 0.8)';
        this.container.style.border = '1px solid #00ff88';
        this.container.style.color = '#00ff88';
        this.container.style.fontFamily = 'monospace';
        this.container.style.pointerEvents = 'none';
        this.container.innerHTML = `
            <div style="font-size: 1.2em; border-bottom: 1px solid #00ff88; margin-bottom: 5px;">MARKET KINEMATICS HUD</div>
            <div style="color: #ffff00; animation: blink 1s infinite;">WAITING FOR TELEMETRY...</div>
            <div style="font-size: 0.8em; margin-top: 10px; color: #888;">Drop a .jsonl file or use the fetch button</div>
            <style>
                @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
            </style>
        `;
        document.body.appendChild(this.container);

        this.createControls();
    }

    private createControls() {
        const ctrl = document.createElement('div');
        ctrl.id = 'hud-controls';
        ctrl.style.position = 'absolute';
        ctrl.style.bottom = '20px';
        ctrl.style.left = '50%';
        ctrl.style.transform = 'translateX(-50%)';
        ctrl.style.background = 'rgba(0, 20, 0, 0.9)';
        ctrl.style.padding = '10px';
        ctrl.style.border = '1px solid #00ff88';
        ctrl.style.display = 'flex';
        ctrl.style.gap = '15px';
        ctrl.style.alignItems = 'center';
        ctrl.style.pointerEvents = 'auto';
        ctrl.style.borderRadius = '5px';
        ctrl.style.zIndex = '10';

        ctrl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #004422; padding-bottom: 5px;">
                    <button id="play-pause" style="background: #004422; color: #00ff88; border: 1px solid #00ff88; padding: 5px 10px; cursor: pointer;">PAUSE</button>
                    <input type="range" id="timeline" style="width: 300px; accent-color: #00ff88;">
                    <span id="time-display" style="min-width: 80px; text-align: right; font-size: 0.8em;">0/0</span>
                    <select id="speed-select" style="background: #002211; color: #00ff88; border: 1px solid #00ff88; padding: 2px 5px;">
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="2">2x</option>
                        <option value="5">5x</option>
                    </select>
                </div>
                <div style="display: flex; gap: 15px; align-items: center; font-size: 0.85em;">
                    <div style="display: flex; gap: 5px; align-items: center;">
                        STRATEGY:
                        <select id="strategy-select" style="background: #002211; color: #00ff88; border: 1px solid #00ff88; padding: 2px 5px;">
                            <option value="telemetry.jsonl">Default (Breakout)</option>
                            <option value="mean_revert_test.jsonl">Mean Reversion</option>
                            <option value="false_breakout_test.jsonl">False Breakout</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button id="prev-flag" style="background: #002211; color: #00ff88; border: 1px solid #00ff88; padding: 2px 8px; cursor: pointer;">&lt;&lt; FLAG</button>
                        <button id="next-flag" style="background: #002211; color: #00ff88; border: 1px solid #00ff88; padding: 2px 8px; cursor: pointer;">FLAG &gt;&gt;</button>
                    </div>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px; color: #ffff00;">
                        <input type="checkbox" id="pilot-mode"> PILOT MODE
                    </label>
                </div>
                <div id="sim-params" style="display: flex; gap: 10px; align-items: center; font-size: 0.75em; color: #88ff88; background: rgba(0,40,0,0.5); padding: 5px; border-radius: 3px;">
                    FRAMES: <input type="number" id="param-frames" value="200" style="width: 45px; background: #000; color: #0f8; border: 1px solid #042;">
                    SPOT: <input type="number" id="param-spot" value="694" style="width: 50px; background: #000; color: #0f8; border: 1px solid #042;">
                    IV: <input type="number" id="param-iv" value="0.15" step="0.01" style="width: 45px; background: #000; color: #0f8; border: 1px solid #042;">
                    <button id="btn-generate" style="background: #00ff88; color: #000; border: none; padding: 2px 10px; cursor: pointer; font-weight: bold; border-radius: 2px;">GENERATE</button>
                </div>
            </div>
        `;
        document.body.appendChild(ctrl);

        // Instructions cue
        const cue = document.createElement('div');
        cue.id = 'instructions-cue';
        cue.style.position = 'absolute';
        cue.style.top = '20px';
        cue.style.right = '20px';
        cue.style.color = 'white';
        cue.style.fontFamily = 'monospace';
        cue.innerText = 'Press [i] for Instructions';
        document.body.appendChild(cue);

        // Instructions Pane
        const pane = document.createElement('div');
        pane.id = 'instructions-pane';
        pane.style.position = 'absolute';
        pane.style.top = '50%';
        pane.style.left = '50%';
        pane.style.transform = 'translate(-50%, -50%)';
        pane.style.background = 'rgba(0, 30, 10, 0.95)';
        pane.style.border = '2px solid #00ff88';
        pane.style.padding = '30px';
        pane.style.color = '#00ff88';
        pane.style.fontFamily = 'monospace';
        pane.style.zIndex = '1000';
        pane.style.display = 'none';
        pane.style.maxWidth = '500px';
        pane.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.5)';
        
        pane.innerHTML = `
            <h2 style="border-bottom: 1px solid #00ff88; padding-bottom: 10px; margin-top: 0;">FLIGHT MANUAL</h2>
            <p><b>REPLAY MODE:</b></p>
            <ul>
                <li>OrbitControls: Use mouse to rotate/zoom/pan.</li>
                <li>Camera: lerps automatically behind the jet.</li>
                <li>Timeline: Scrub to jump to specific market events.</li>
            </ul>
            <p><b>PILOT MODE (Checkbox):</b></p>
            <ul>
                <li>W/S: Pitch Up/Down (Z-axis)</li>
                <li>A/D: Roll Left/Right (X-axis)</li>
                <li>Q/E: Elevate Up/Down (Y-axis)</li>
                <li>HUD will compare your position to the market path.</li>
            </ul>
            <p><b>SHORTCUTS:</b></p>
            <ul>
                <li>[i]: Toggle this manual</li>
                <li>[Space]: Reset Pilot Position</li>
            </ul>
            <button onclick="document.getElementById('instructions-pane').style.display='none'" 
                    style="width: 100%; background: #00ff88; color: #000; border: none; padding: 10px; cursor: pointer; font-weight: bold; margin-top: 10px;">CLOSE</button>
        `;
        document.body.appendChild(pane);
    }

    update(frame: TelemetryFrame, index: number, total: number, isPilot: boolean, pilotPos?: any) {
        const flagStr = frame.flags.length > 0 ? `<span style="color: #ff5555; font-weight: bold;">FLAGS: ${frame.flags.join(', ')}</span>` : 'FLAGS: NONE';
        
        let pilotInfo = '';
        if (isPilot && pilotPos) {
            const devX = pilotPos.x - frame.x;
            const devY = pilotPos.y - frame.y;
            const devZ = pilotPos.z - frame.z;
            const totalDev = Math.sqrt(devX*devX + devY*devY + devZ*devZ);

            pilotInfo = `
                <div style="margin-top: 10px; border-top: 1px solid #00ff88; padding-top: 10px;">
                    <b style="color: #ffff00">PILOT STATE (NUDGED)</b><br>
                    X: ${pilotPos.x.toFixed(2)} (${devX > 0 ? '+' : ''}${devX.toFixed(2)})<br>
                    Y: ${pilotPos.y.toFixed(2)} (${devY > 0 ? '+' : ''}${devY.toFixed(2)})<br>
                    Z: ${pilotPos.z.toFixed(2)} (${devZ > 0 ? '+' : ''}${devZ.toFixed(2)})<br>
                    <div style="color: ${totalDev > 1.0 ? '#ff5555' : '#00ff88'}; margin-top: 5px;">
                        TOTAL DEVIATION: ${totalDev.toFixed(2)}
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div style="font-size: 1.4em; border-bottom: 2px solid #00ff88; margin-bottom: 10px; font-weight: bold;">MARKET KINEMATICS HUD</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                <div>TIME: <span style="color: white">${frame.timestamp}</span></div>
                <div>FRAME: <span style="color: white">${index}/${total}</span></div>
                <div>SPOT: <span style="color: #00ffff; font-weight: bold;">$${frame.spot.toFixed(2)}</span></div>
                <div>IV/HV: <span style="color: #ffff00">${(frame.iv/frame.hv).toFixed(2)}</span></div>
            </div>
            <div style="margin-top: 10px;">
                REGIME: <span style="font-weight: bold; background: #004422; padding: 2px 5px; border-radius: 3px;">${frame.regime}</span>
            </div>
            <div style="margin-top: 5px; font-size: 0.9em; color: #88ff88;">
                MARKET POS:<br>
                X (Airspeed): ${frame.x.toFixed(2)}<br>
                Y (Load Factor): ${frame.y.toFixed(2)}<br>
                Z (Wall Proximity): ${frame.z.toFixed(2)}
            </div>
            <div style="margin-top: 10px; padding: 5px; background: rgba(255,0,0,0.1); border-radius: 3px;">
                ${flagStr}
            </div>
            ${pilotInfo}
        `;

        const timeline = document.getElementById('timeline') as HTMLInputElement;
        if (timeline) {
            timeline.max = total.toString();
            timeline.value = index.toString();
        }
        const display = document.getElementById('time-display');
        if (display) display.innerText = `${index}/${total}`;
    }
}
