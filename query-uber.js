import axios from 'axios';
async function search() {
  const { data } = await axios.get("https://lite.duckduckgo.com/lite/", {
    params: { q: '"signature_requirement" "id_requirement" "barcode_requirement"' },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  console.log(data.match(/.{0,100}barcode_requirement.{0,100}/gi));
}
search();
