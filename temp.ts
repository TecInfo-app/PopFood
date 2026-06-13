import { AbacatePay } from '@abacatepay/sdk';
type checkouts = Parameters<ReturnType<typeof AbacatePay>['checkouts']['create']>;
type pix = Parameters<ReturnType<typeof AbacatePay>['pix']['create']>;
let x: checkouts = null as any;
x.invalidField123;
let y: pix = null as any;
y.invalidField123;

