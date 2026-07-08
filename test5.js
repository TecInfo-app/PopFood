import axios from 'axios';
async function search() {
  const { data } = await axios.get("https://html.duckduckgo.com/html/", {
    params: { q: 'site:github.com "pin_requirement" "enabled"' },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  console.log(data.match(/.{0,100}pin_requirement.{0,100}/g));
}
search();
