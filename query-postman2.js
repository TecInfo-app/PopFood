import axios from 'axios';
async function run() {
  const { data } = await axios.get("https://raw.githubusercontent.com/uber/direct-api-docs/main/openapi.yaml").catch(e => e.response || e);
  const lines = typeof data === 'string' ? data.split('\n') : [];
  const idx = lines.findIndex(l => l.includes('verification_requirements'));
  if (idx !== -1) {
    console.log(lines.slice(Math.max(0, idx - 10), idx + 30).join('\n'));
  } else {
    console.log("Not found");
  }
}
run();
