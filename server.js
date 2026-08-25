const { spawn } = require('child_process');
const os = require('os');

// Get local network IP
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const networkIP = getNetworkIP();
const port = process.env.PORT || 3000;

console.log('\n🚀 Starting Next.js server...\n');

// Start Next.js with network binding
const nextProcess = spawn('next', ['dev', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  shell: true
});

// Wait a moment for server to start, then show the correct URLs
setTimeout(() => {
  console.log('\n┌─────────────────────────────────────────────┐');
  console.log('│  ✓ Server ready!                           │');
  console.log('├─────────────────────────────────────────────┤');
  console.log(`│  Local:    http://localhost:${port}           │`);
  console.log(`│  Network:  http://${networkIP}:${port}      │`);
  console.log('└─────────────────────────────────────────────┘\n');
}, 2000);

nextProcess.on('exit', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  nextProcess.kill('SIGINT');
  process.exit();
});
