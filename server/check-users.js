const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'easytalk.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, name, email FROM users', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\n📋 Users in database:');
    console.log('='.repeat(50));
    if (rows.length === 0) {
      console.log('No users found. Please register first.');
    } else {
      rows.forEach(user => {
        console.log(`ID: ${user.id}`);
        console.log(`Name: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log('-'.repeat(30));
      });
    }
    console.log(`\nTotal users: ${rows.length}`);
  }
  db.close();
});