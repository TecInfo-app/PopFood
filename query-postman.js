import axios from 'axios';
async function run() {
  const { data } = await axios.get("https://raw.githubusercontent.com/uber/direct-api-docs/main/openapi.yaml").catch(e => e.response || e);
  console.log(data ? "success" : "fail");
}
run();
