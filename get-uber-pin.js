import https from 'https';
https.get('https://raw.githubusercontent.com/uber/direct-api-reference/main/openapi.yaml', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.substring(0,500)));
});
