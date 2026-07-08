import axios from 'axios';
async function search() {
  const { data } = await axios.get("https://html.duckduckgo.com/html/?q=site:developer.uber.com+%22dropoff_requirements%22+%22signature_requirement%22");
  const text = data.replace(/<[^>]*>/g, ' ');
  console.log(text.substring(0, 2000));
}
search();
