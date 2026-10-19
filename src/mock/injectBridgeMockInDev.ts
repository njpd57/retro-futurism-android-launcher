import { BridgeMock } from '@bridgelauncher/api-mock';
import type { BridgeBattery, BridgeConnectivity } from '@/types/bridge-fork';

/** BridgeMock plus fake data for the fork methods the launcher uses. */
class ForkBridgeMock extends BridgeMock
{
    private battery: BridgeBattery = { level: 74, isCharging: true, pluggedType: 'usb' };
    private connectivity: BridgeConnectivity = { type: 'wifi', wifiLevel: 3, cellularLevel: 2, dataActivity: 'none' };

    constructor()
    {
        super();
        window.setInterval(() => this.tickBattery(), 4000);
        window.setInterval(() => this.tickConnectivity(), 3000);
    }

    // like Bridge, tell the page about a change through onBridgeEvent
    private emit(event: object) { (window.onBridgeEvent as ((e: object) => void) | undefined)?.(event); }

    private tickBattery()
    {
        const b = this.battery;
        const level = Math.min(100, Math.max(5, b.level + (b.isCharging ? 1 : -1)));
        const isCharging = level >= 100 ? false : level <= 5 ? true : b.isCharging;
        this.battery = { level, isCharging, pluggedType: isCharging ? 'usb' : null };
        this.emit({ name: 'batteryChanged', newValue: this.battery });
    }

    private tickConnectivity()
    {
        const activity = (['none', 'in', 'out', 'inout'] as const)[Math.floor(Math.random() * 4)];
        const wifiLevel = Math.min(4, Math.max(1, (this.connectivity.wifiLevel ?? 3) + Math.round(Math.random() * 2 - 1)));
        this.connectivity = { ...this.connectivity, wifiLevel, dataActivity: activity };
        this.emit({ name: 'connectivityChanged', newValue: this.connectivity });
    }

    getWindowInsetsSwapFixed() { return true; }
    getBattery() { return JSON.stringify(this.battery); }
    getConnectivity() { return JSON.stringify(this.connectivity); }
}

export default function injectBridgeMockInDev()
{
    if (import.meta.env.DEV && !window.Bridge)
    {
        window.Bridge = new ForkBridgeMock();
    }
}
