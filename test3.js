import axios from 'axios';
async function search() {
  const { data } = await axios.get("https://lite.duckduckgo.com/lite/", {
    params: { q: 'site:developer.uber.com "verification_requirements"' },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const text = data.replace(/<[^>]*>/g, ' ');
  console.log(text.substring(0, 1000));
}
search();
