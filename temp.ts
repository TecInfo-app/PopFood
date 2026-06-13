import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/create-payment', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://tecinfo-app.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    console.log('Status:', res.status);
    console.log('Headers:');
    res.headers.forEach((v, k) => {
      console.log(`  ${k}: ${v}`);
    });
  } catch (e) {
    console.error('Error fetching:', e);
  }
}

test();
