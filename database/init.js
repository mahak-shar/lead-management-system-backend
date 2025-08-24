const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/leads.db';

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');
      
      // Create tables
      createTables()
        .then(() => {
          console.log('Database tables created successfully');
          resolve();
        })
        .catch(reject);
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createLeadsTable = `
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        city TEXT,
        state TEXT,
        source TEXT CHECK(source IN ('website', 'facebook_ads', 'google_ads', 'referral', 'events', 'other')) NOT NULL,
        status TEXT CHECK(status IN ('new', 'contacted', 'qualified', 'lost', 'won')) NOT NULL DEFAULT 'new',
        score INTEGER CHECK(score >= 0 AND score <= 100) DEFAULT 0,
        lead_value REAL DEFAULT 0,
        last_activity_at DATETIME,
        is_qualified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, email)
      )
    `;
    
    db.serialize(() => {
      db.run(createUsersTable, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
          return;
        }
        
        db.run(createLeadsTable, (err) => {
          if (err) {
            console.error('Error creating leads table:', err);
            reject(err);
            return;
          }
          
          resolve();
        });
      });
    });
  });
}

function getDatabase() {
  return db;
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};
