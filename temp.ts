import { AbacatePay } from '@abacatepay/sdk';
const client = (AbacatePay as any)({ secret: 'ak_test_invalid_key_123' });
client.pix.create({
  amount: 199,
  description: 'Teste transparent'
}).then((res: any) => {
  console.log('Success:', res);
}).catch((err: any) => {
  console.dir(err, { depth: null });
});







