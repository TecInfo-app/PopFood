import axios from 'axios';
const { data } = await axios.get("https://html.duckduckgo.com/html/?q=site:developer.uber.com+%22verification_requirements%22+%22pin%22");
console.log(data.match(/.{0,50}verification_requirements.{0,50}/g));
