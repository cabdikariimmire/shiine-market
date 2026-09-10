const fs = require('fs');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

async function generate() {
  const certsDir = path.join(process.cwd(), 'certificates');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const localIps = getLocalIpAddresses();
  console.log('📡 Detected Local Network IP Addresses:', localIps);

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...localIps.map(ip => ({ type: 7, ip: ip }))
  ];

  const attrs = [
    { name: 'commonName', value: localIps[0] || 'localhost' },
    { name: 'countryName', value: 'SO' },
    { shortName: 'ST', value: 'Banaadir' },
    { name: 'localityName', value: 'Mogadishu' },
    { name: 'organizationName', value: 'Tukaan Management System' },
    { shortName: 'OU', value: 'Development' }
  ];

  console.log('🔒 Generating Local Development SSL Certificate with SAN...');
  const pems = await selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{
      name: 'subjectAltName',
      altNames: altNames
    }]
  });

  const keyPath = path.join(certsDir, 'localhost-key.pem');
  const certPath = path.join(certsDir, 'localhost.pem');

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log(`\n✅ Certificates generated successfully in: ${certsDir}`);
  console.log(`   - Key:  ${keyPath}`);
  console.log(`   - Cert: ${certPath}`);
  console.log('\n📱 Mobile Phone Access (Real Camera Enabled):');
  localIps.forEach(ip => {
    console.log(`   👉 https://${ip}:3000`);
  });
  console.log('💻 PC Access:');
  console.log('   👉 https://localhost:3000 or http://localhost:3000\n');
}

generate().catch(err => {
  console.error('Certificate generation failed:', err);
  process.exit(1);
});
