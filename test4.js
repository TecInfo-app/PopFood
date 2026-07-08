import axios from 'axios';
async function search() {
  const { data } = await axios.get("https://lite.duckduckgo.com/lite/", {
    params: { q: 'site:developer.uber.com "signature_requirement"' },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  console.log(data.match(/.{0,80}signature_requirement.{0,80}/g));
}
search();
