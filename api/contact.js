require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Pool setup
const pool = process.env.DATABASE_URL ? mysql.createPool(process.env.DATABASE_URL) : null;

// Database Initialization (Serverless)
let dbInitialized = false;
async function initDB() {
    if (dbInitialized || !pool) return;
    try {
        const connection = await pool.getConnection();
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(255),
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await connection.query(createTableQuery);
        console.log('Messages table verified.');
        dbInitialized = true;
        connection.release();
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Handler - Catch all POST requests to this function
app.post('*', async (req, res) => {
    await initDB();
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    try {
        if (pool) {
            await pool.execute(
                'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
                [name, email, subject || 'No Subject', message]
            );
        }

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: email,
                to: process.env.EMAIL_USER,
                subject: `New Portfolio Message: ${subject || 'Contact Request'}`,
                text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
            });
            res.status(200).json({ message: 'Message sent and saved successfully!' });
        } else {
            if (pool) {
                res.status(200).json({ message: 'Message saved to database, but email credentials missing.' });
            } else {
                res.status(500).json({ error: 'Server configuration error: No database or email available.' });
            }
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'An error occurred. Please try again!' });
    }
});

module.exports = app;
