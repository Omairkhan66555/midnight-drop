const express = require('express');
const cors = require('cors');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Add product (Admin)
app.post('/api/admin/add-product', (req, res) => {
  const { name, price, inventory, image } = req.body;
  const stmt = db.prepare('INSERT INTO products (name, price, inventory, status, image) VALUES (?, ?, ?, ?, ?)');
  stmt.run([name, price, inventory, 'LIVE', image], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, productId: this.lastID });
  });
});

// Schedule product (Admin)
app.post('/api/admin/schedule-product', (req, res) => {
  const { name, price, inventory, release_time, image } = req.body;
  const stmt = db.prepare('INSERT INTO products (name, price, inventory, release_time, status, image) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run([name, price, inventory, release_time, 'COMING_SOON', image], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, productId: this.lastID });
  });
});

// Check scheduled drops and make them live
setInterval(() => {
  const now = new Date().toISOString();
  db.run(`UPDATE products SET status = 'LIVE' WHERE status = 'COMING_SOON' AND release_time <= ?`, [now], function(err) {
    if (err) console.error('Schedule check err:', err);
    if (this.changes > 0) {
      console.log(`[Drop Event] ${this.changes} scheduled products are now LIVE!`);
    }
  });
}, 1000); // Check every second

// Get products (Customer)
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Admin orders list
app.get('/api/admin/orders', (req, res) => {
  db.all(`
    SELECT orders.id, users.email as user_email, products.name as product_name, orders.order_status, transactions.payment_status 
    FROM orders 
    JOIN users ON orders.user_id = users.id 
    JOIN products ON orders.product_id = products.id
    JOIN transactions ON orders.transaction_id = transactions.id
    ORDER BY orders.id DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Purchase Product with Concurrency Control
app.post('/api/purchase', async (req, res) => {
  const { userId, productId } = req.body;
  // Step 1: Initialize transaction ID (simulating payment creation)
  const transactionId = uuidv4();

  // Step 2: Simulate Payment Gateway processing (e.g. 50ms)
  await new Promise(resolve => setTimeout(resolve, 50));
  const timeStr = new Date().toISOString();

  db.serialize(() => {
    // Start by recording the payment transaction
    const transStmt = db.prepare('INSERT INTO transactions (id, user_id, product_id, payment_status, timestamp) VALUES (?, ?, ?, ?, ?)');
    transStmt.run([transactionId, userId, productId, 'PAID', timeStr], (err) => {
      if (err) {
         console.error('Transaction Error', err);
         return res.status(500).json({ error: 'Payment failed' });
      }

      // Concurrency Logic: Atomic UPDATE with RETURNING
      // We attempt to decrement inventory ONLY IF inventory > 0 AND status = 'LIVE'
      db.get(
        `UPDATE products SET inventory = inventory - 1 
         WHERE id = ? AND inventory > 0 AND status = 'LIVE' 
         RETURNING inventory`,
        [productId],
        (updateErr, row) => {
          if (updateErr) {
            console.error('Update Error:', updateErr);
            return res.status(500).json({ error: 'System error' });
          }

          if (row) {
            // SUCCESS - Inventory was safely decremented
            // Check if it reached 0, mark as SOLD_OUT
            if (row.inventory === 0) {
              db.run(`UPDATE products SET status = 'SOLD_OUT' WHERE id = ?`, [productId]);
            }

            const orderStmt = db.prepare('INSERT INTO orders (transaction_id, user_id, product_id, order_status) VALUES (?, ?, ?, ?)');
            orderStmt.run([transactionId, userId, productId, 'SUCCESS'], function() {
              return res.json({ 
                status: 'SUCCESS', 
                transactionId, 
                message: 'Purchase successful!' 
              });
            });
            orderStmt.finalize();

          } else {
            // FAILED - No row returned means inventory was 0 or product not live
            // Simulate Refund
            db.run(`UPDATE transactions SET payment_status = 'REFUNDED' WHERE id = ?`, [transactionId]);
            const orderStmt = db.prepare('INSERT INTO orders (transaction_id, user_id, product_id, order_status) VALUES (?, ?, ?, ?)');
            orderStmt.run([transactionId, userId, productId, 'FAILED'], function() {
              return res.json({ 
                status: 'SOLD_OUT', 
                transactionId, 
                message: 'Product is sold out. Payment has been refunded.' 
              });
            });
            orderStmt.finalize();
          }
        }
      );
    });
    transStmt.finalize();
  });
});

// Check order status
app.get('/api/order-status/:txId', (req, res) => {
  db.get('SELECT * FROM orders JOIN transactions ON orders.transaction_id = transactions.id WHERE transactions.id = ?', [req.params.txId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});
app.delete("/api/admin/product/:id", (req, res) => {

  const id = req.params.id;

  db.run("DELETE FROM products WHERE id=?", [id], function(err) {

    if(err){
      console.log("Delete error:", err);
      return res.status(500).json({error: err.message});
    }

    console.log("Deleted product id:", id);

    res.json({success:true});
  });

});



const PORT = 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
