const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables
const initDb = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        role TEXT CHECK(role IN ('ADMIN', 'CUSTOMER')) DEFAULT 'CUSTOMER'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        inventory INTEGER,
        release_time TEXT,
        status TEXT CHECK(status IN ('COMING_SOON', 'LIVE', 'SOLD_OUT')) DEFAULT 'COMING_SOON',
        image TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        product_id INTEGER,
        payment_status TEXT CHECK(payment_status IN ('PENDING', 'PAID', 'REFUNDED')),
        timestamp TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT,
        user_id INTEGER,
        product_id INTEGER,
        order_status TEXT CHECK(order_status IN ('SUCCESS', 'FAILED')),
        FOREIGN KEY (transaction_id) REFERENCES transactions (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Seed Admin and default customers if empty
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (row.count === 0) {
        console.log('Seeding initial users...');
        const stmt = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)');
        stmt.run('Admin', 'admin@midnightdrop.com', 'ADMIN');
        stmt.run('Customer 1', 'cust1@test.com', 'CUSTOMER');
        stmt.run('Customer 2', 'cust2@test.com', 'CUSTOMER');
        stmt.finalize();
      }
    });
  });
};

initDb();

module.exports = db;
