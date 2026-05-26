const http = require('http');

const TARGET_URL = 'http://localhost:3000/api/channels';
const CONCURRENT_REQUESTS = 110;

console.log(`🚀 Starting Rate Limit Test against: ${TARGET_URL}`);
console.log(`📦 Sending ${CONCURRENT_REQUESTS} requests in rapid succession...\n`);

let completed = 0;
let successCount = 0;
let rateLimitedCount = 0;
let otherErrorCount = 0;
let retryAfterHeader = null;

const start = Date.now();

for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
  const req = http.get(TARGET_URL, (res) => {
    completed++;
    
    if (res.statusCode === 200) {
      successCount++;
    } else if (res.statusCode === 429) {
      rateLimitedCount++;
      if (res.headers['retry-after']) {
        retryAfterHeader = res.headers['retry-after'];
      }
    } else {
      otherErrorCount++;
      if (otherErrorCount <= 5) {
        console.log(`ℹ️ Received non-expected status: ${res.statusCode} (Redirect URL: ${res.headers.location || 'None'})`);
      }
    }

    if (completed === CONCURRENT_REQUESTS) {
      const duration = Date.now() - start;
      console.log('🏁 --- Test Results --- 🏁');
      console.log(`⏱️ Duration: ${duration}ms`);
      console.log(`🟢 Successful Requests (200 OK): ${successCount}`);
      console.log(`🔴 Rate Limited Requests (429): ${rateLimitedCount}`);
      if (retryAfterHeader) {
        console.log(`⏳ Retry-After Header Returned: ${retryAfterHeader} seconds`);
      } else {
        console.log(`⏳ Retry-After Header: None found`);
      }
      if (otherErrorCount > 0) {
        console.log(`⚠️ Other Error Requests (non-200, non-429): ${otherErrorCount}`);
      }
      console.log('------------------------');
      
      if (rateLimitedCount > 0) {
        console.log('✅ PASS: Rate limiter successfully triggered and returned 429!');
      } else {
        console.log('❌ FAIL: Rate limiter was NOT triggered (all requests completed without 429).');
      }
    }
  });

  req.on('error', (err) => {
    completed++;
    otherErrorCount++;
    if (completed === CONCURRENT_REQUESTS) {
      console.log(`⚠️ Connection Error: ${err.message}`);
    }
  });
}
