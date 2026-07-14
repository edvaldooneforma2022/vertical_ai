const db = require('better-sqlite3')('./data/linkmagico.db');

// Find short_urls table
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%short%'").all();
console.log('Tables:', tables);

if (tables.length > 0) {
    const cols = db.prepare(`PRAGMA table_info(${tables[0].name})`).all();
    console.log('Cols:', cols.map(c => c.name));
    const rows = db.prepare(`SELECT * FROM ${tables[0].name} LIMIT 3`).all();
    console.log('Rows:', JSON.stringify(rows, null, 2));
}

// Also try chatbots table
const chatbots = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%chatbot%'").all();
console.log('\nChatbot tables:', chatbots);

// Look for any table with api_key
const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\nAll tables:', allTables.map(t => t.name));

db.close();
