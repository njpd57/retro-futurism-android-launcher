/** What is selected in the editor; indices point into the arrays of `ShipData`. */
export type Sel =
    | { t: 'room'; i: number }
    | { t: 'portal'; i: number }
    /** an entry of `data.props` (a generator counts as one) */
    | { t: 'prop'; i: number }
    | { t: 'screen'; i: number }
    /** an entry of `data.terminals` */
    | { t: 'terminal'; i: number }
    /** an entry of `data.extraLights` */
    | { t: 'light'; i: number }
    | { t: 'stand'; room: string }
    | { t: 'via'; room: string; i: number }
    | { t: 'signal'; i: number };

export const same = (a: Sel | null, b: Sel | null) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
