const axios = require('axios');

async function test() {
  try {
    const sum = await axios.get('http://localhost:5000/api/dashboard/summary');
    console.log('Summary:', sum.data);
  } catch (e) {
    console.error('Summary Error:', e.response?.status, e.response?.data);
  }
  
  try {
    const agt = await axios.get('http://localhost:5000/api/dashboard/agent/');
    console.log('Agent(/):', agt.data);
  } catch (e) {
    console.error('Agent(/) Error:', e.response?.status, e.response?.data);
  }

  try {
    const agt2 = await axios.get('http://localhost:5000/api/dashboard/agent');
    console.log('Agent:', agt2.data);
  } catch (e) {
    console.error('Agent Error:', e.response?.status, e.response?.data);
  }
}

test();
