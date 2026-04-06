const http = require('https');

const data = JSON.stringify({
  name: 'Final Boss Check',
  email: 'boss@check.com',
  subject: 'Unified Stabilization',
  message: 'Testing the single-function Express server on Vercel.'
});

const options = {
  hostname: 'portfolio-6cax.vercel.app',
  port: 443,
  path: '/api/contact',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Response:', body);
  });
});

req.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

req.write(data);
req.end();
