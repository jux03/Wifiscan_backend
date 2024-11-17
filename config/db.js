const mysql = require('mysql2');

// Create MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',         
  password: 'root',  
  database: 'network_scanner',
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection failed:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
});

module.exports = db;
