import axios from 'axios';
async function search() {
  const { data } = await axios.get("https://raw.githubusercontent.com/search?q=dropoff_requirements+uber+direct+language%3Ajson&type=code");
  // wait github API requires auth
}
