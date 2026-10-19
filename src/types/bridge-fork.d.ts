import '@bridgelauncher/api';

// Methods and events that only exist in our Bridge fork (njpd57/bridge-launcher).
// Names must match the Kotlin ones exactly. Call them behind bridgeHas().

export type BridgePluggedType = 'ac' | 'usb' | 'wireless' | 'other';

export interface BridgeBattery
{
    /** 0-100 */
    level: number;
    isCharging: boolean;
    pluggedType: BridgePluggedType | null;
}

export type BridgeConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'other' | 'none';
export type BridgeDataActivity = 'none' | 'in' | 'out' | 'inout' | 'dormant';

export interface BridgeConnectivity
{
    type: BridgeConnectionType;
    /** 0-4 */
    wifiLevel: number | null;
    /** 0-4 */
    cellularLevel: number | null;
    dataActivity: BridgeDataActivity;
}

export type BridgeForkEvent =
    | { name: 'batteryChanged'; newValue: BridgeBattery }
    | { name: 'connectivityChanged'; newValue: BridgeConnectivity };

declare module '@bridgelauncher/api'
{
    interface JSToBridgeAPI
    {
        /** Always true on the fork; absent on stock Bridge. */
        getWindowInsetsSwapFixed(): boolean;
        /** JSON of BridgeBattery. */
        getBattery(): string;
        /** JSON of BridgeConnectivity. */
        getConnectivity(): string;
    }
}
