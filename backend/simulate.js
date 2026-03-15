const axios = require('axios');
const API_URL = 'http://localhost:3000/api';

async function simulate() {
  console.log('--- Flash Sale Concurrency Simulator ---');

  // 1. Create a product with 100 inventory
  const prodRes = await axios.post(`${API_URL}/admin/add-product`, {
    name: 'Midnight Sneakers Limited Edition',
    price: 199.99,
    inventory: 100,
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=600'
  });

  const productId = prodRes.data.productId;
  console.log(`Created test product ID ${productId} with inventory 100`);

  // 2. Prepare 1000 users attempting to buy at the exact same moment
  console.log('Sending 1000 concurrent purchase requests...');

  const promises = [];
  const start = Date.now();

  for (let i = 1; i <= 1000; i++) {
    const userId = (i % 2) + 1; // Alternating fake users 1 and 2

    // Fire all seamlessly without awaiting inside loop
    const req = axios.post(`${API_URL}/purchase`, {
      userId,
      productId
    }).then(res => res.data).catch(e => ({ error: e.message }));

    promises.push(req);
  }

  // 3. Wait for all requests to finish
  const results = await Promise.all(promises);
  const end = Date.now();
  console.log(`Completed 1000 requests in ${end - start}ms`);

  // 4. Analyze Results
  let successCount = 0;
  let soldOutCount = 0;
  let errorCount = 0;

  for (const res of results) {
    if (res.status === 'SUCCESS') successCount++;
    else if (res.status === 'SOLD_OUT') soldOutCount++;
    else errorCount++;
  }

  console.log(`\n--- Results Analysis ---`);
  console.log(`Successful Purchases: ${successCount} (Should be exactly 100)`);
  console.log(`Sold Out (Refunded): ${soldOutCount} (Should be exactly 900)`);
  if (errorCount > 0) console.log(`Errors: ${errorCount}`);

  // 5. Check actual DB state
  const dbCheck = await axios.get(`${API_URL}/products`);
  const prod = dbCheck.data.find(p => p.id === productId);
  console.log(`\nFinal Database Inventory: ${prod.inventory} (Should be 0)`);
  console.log(`Final Database Status: ${prod.status} (Should be SOLD_OUT)`);

  if (successCount === 100 && prod.inventory === 0) {
    console.log('\n✅ CONCURRENCY TEST PASSED! No overselling occurred.');
  } else {
    console.log('\n❌ CONCURRENCY TEST FAILED!');
  }
}

simulate().catch(console.error);
