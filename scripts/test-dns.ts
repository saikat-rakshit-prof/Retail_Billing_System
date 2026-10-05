// Quick test to check DNS resolution with different DNS servers
const dns = require('dns');
const dns2 = require('dns2'); // If available
const util = require('util');

const resolve4 = util.promisify(dns.resolve4);

const hostname = 'ep-noisy-surf-amdgjvq3-pooler.c-5.us-east-1.aws.neon.tech';

console.log('🔍 Testing DNS resolution for:', hostname);

// Test 1: System DNS (default)
console.log('\n--- Test 1: System DNS ---');
resolve4(hostname)
  .then((addresses: string[]) => {
    console.log('✅ System DNS succeeded!');
    console.log('IP addresses:', addresses);
  })
  .catch((err: any) => {
    console.log('❌ System DNS failed:', err.code, err.message);
  });

// Test 2: Try to set DNS server via environment
console.log('\n--- Test 2: With NODE_OPTIONS ---');
console.log('Try running: set DNS_SERVERS=8.8.8.8 && npx tsx scripts/test-dns.ts');
