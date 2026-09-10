const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return '192.168.100.86';
}

const keyPath = path.join(__dirname, 'certificates', 'localhost-key.pem');
const certPath = path.join(__dirname, 'certificates', 'localhost.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.log('⚠️ SSL certificates missing, generating now...');
  require('./scripts/generate-certificates');
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    const localIp = getLocalIp();
    console.log('\n==================================================');
    console.log('🛍️  TUKAAN MANAGEMENT SYSTEM — SECURE HTTPS SERVER');
    console.log('==================================================');
    console.log(`\n💻 Desktop Access:`);
    console.log(`   👉 https://localhost:${port}`);
    console.log(`\n📱 Mobile Phone Access (Real Phone Camera Active):`);
    console.log(`   👉 https://${localIp}:${port}`);
    console.log('\n🔒 Secure Context: ENABLED (navigator.mediaDevices.getUserMedia() allowed)');
    console.log('==================================================\n');
  });
});
