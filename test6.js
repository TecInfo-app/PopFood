import axios from 'axios';
async function search() {
  const { data } = await axios.get("https://html.duckduckgo.com/html/", {
    params: { q: 'site:github.com "verification" "pin" "dropoff_requirements"' },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  console.log(data.match(/<a class="result__url" href="([^"]+)">/g));
}
search();
