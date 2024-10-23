const express = require('express');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'expense-tracker.db');
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Create the 'transactions' table if it doesn't exist
    await db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        category TEXT,
        amount REAL,
        date TEXT,
        description TEXT
      );
    `);

    app.listen(3000, () => {
      console.log('Server is Running At http://localhost:3000/');
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// POST: Add a new transaction
app.post('/transactions', async (req, res) => {
  try {
    const { type, category, amount, date, description } = req.body;

    // Validate if all required fields are provided
    if (!type || !category || !amount || !date || !description) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const sql = `
      INSERT INTO transactions (type, category, amount, date, description)
      VALUES (?, ?, ?, ?, ?)
    `;
    await db.run(sql, [type, category, amount, date, description]);

    res.status(201).json({ message: 'Transaction added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET: Retrieve all transactions
app.get('/transactions', async (req, res) => {
  try {
    const sql = 'SELECT * FROM transactions';
    const transactions = await db.all(sql);
    res.status(200).json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET: Retrieve a transaction by ID
app.get('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'SELECT * FROM transactions WHERE id = ?';
    const transaction = await db.get(sql, [id]);
    
    if (transaction) {
      res.status(200).json(transaction);
    } else {
      res.status(404).json({ error: 'Transaction not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT: Update a transaction by ID
app.put('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, category, amount, date, description } = req.body;

    // Validate if at least one field is provided
    if (!type && !category && !amount && !date && !description) {
      return res.status(400).json({ error: "At least one field is required to update" });
    }

    const sql = `
      UPDATE transactions 
      SET 
        type = COALESCE(?, type), 
        category = COALESCE(?, category), 
        amount = COALESCE(?, amount), 
        date = COALESCE(?, date), 
        description = COALESCE(?, description)
      WHERE id = ?
    `;
    await db.run(sql, [type, category, amount, date, description, id]);
    
    res.status(200).json({ message: 'Transaction updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE: Delete a transaction by ID
app.delete('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'DELETE FROM transactions WHERE id = ?';
    const result = await db.run(sql, [id]);

    if (result.changes > 0) {
      res.status(200).json({ message: 'Transaction deleted successfully' });
    } else {
      res.status(404).json({ error: 'Transaction not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET: Retrieve a summary of transactions
app.get('/summary', async (req, res) => {
  try {
    const sql = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS totalIncome,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS totalExpenses
      FROM transactions
    `;
    const summary = await db.get(sql);
    
    summary.balance = summary.totalIncome - summary.totalExpenses;
    
    res.status(200).json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});
