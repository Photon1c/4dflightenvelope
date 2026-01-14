export interface TelemetryFrame {
    timestamp: number;
    spot: number;
    iv: number;
    hv: number;
    x: number;
    y: number;
    z: number;
    regime: 'TAXI' | 'CRUISE' | 'MANEUVER' | 'RUPTURE';
    flags: string[];
}

export async function loadJsonl(url: string): Promise<TelemetryFrame[]> {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n');
    const frames: TelemetryFrame[] = [];

    for (const line of lines) {
        if (line.trim()) {
            try {
                frames.push(JSON.parse(line));
            } catch (e) {
                console.warn('Invalid JSON line:', line, e);
            }
        }
    }
    return frames;
}

export async function parseJsonlFile(file: File): Promise<TelemetryFrame[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split('\n');
            const frames: TelemetryFrame[] = [];
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        frames.push(JSON.parse(line));
                    } catch (err) {
                        console.warn('Invalid JSON line:', line, err);
                    }
                }
            }
            resolve(frames);
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
