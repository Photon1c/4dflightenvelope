# 4D Option Flight Envelope Simulator

A high-fidelity 3D market kinematics visualization built with **Three.js** and **Vite**. This application allows traders and developers to visualize option structural envelopes and "fly" through market telemetry in a 4D state space.

## Features

- **4D State Space**: Maps market data to (X, Y, Z) coordinates:
  - **X**: Structural Airspeed (`|spot - flip| / ATR`)
  - **Y**: Load Factor (`IV / HV`)
  - **Z**: Wall Proximity (Normalized distance to Put/Call walls)
- **Interactive Replay**: Load `.jsonl` telemetry files and scrub through market history with a cinematic follow-cam.
- **Pilot Mode**: Take manual control of the "Market Jet" using WASD/QE to test "what-if" scenarios against the recorded market path.
- **Dynamic Envelopes**: Visualize structural boundaries, threshold planes (X=1, X=3), and interactive 3D axis labels.
- **Scenario Generator**: Built-in synthetic path generator to simulate Mean Reversion, Breakouts, and False Breakouts.

## Getting Started

### Installation

```bash
# Navigate to the app directory
cd fineagle/4dflight/4dflightapp

# Install dependencies
npm install
```

### Development

```bash
# Start the Vite dev server
npm run dev
```

### Build

```bash
# Build for production
npm run build
```

## Controls

- **WASD**: Move Forward/Backward/Left/Right (Pilot Mode)
- **Q / E**: Raise/Lower Elevation (Pilot Mode)
- **Arrow Keys**: Look around (Rotate Camera)
- **Space**: Reset Pilot Position / Reset Camera
- **[i]**: Toggle Flight Manual

## Data Format

The app consumes `.jsonl` files where each line is a JSON object with the following structure:

```json
{
  "timestamp": 0,
  "spot": 694.0,
  "iv": 0.15,
  "hv": 0.12,
  "x": 0.536,
  "y": 1.25,
  "z": 0.8,
  "regime": "CRUISE",
  "flags": []
}
```
