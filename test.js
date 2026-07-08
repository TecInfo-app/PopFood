import axios from 'axios';
const html = await axios.get("https://raw.githubusercontent.com/swagger-api/swagger-collections/master/collections/uber.json").catch(() => ({data: "error"}));
console.log(html.data.substring ? html.data.substring(0, 100) : "No data");
