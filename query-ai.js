import axios from 'axios';
// just do a quick google via axios html parsing
const { data } = await axios.get("https://html.duckduckgo.com/html/?q=site:developer.uber.com+%22pin_requirement%22");
console.log(data.match(/.{0,50}pin_requirement.{0,50}/g));
