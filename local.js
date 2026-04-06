require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MySQL Pool setup
const pool = process.env.DATABASE_URL ? mysql.createPool(process.env.DATABASE_URL) : null;

// Database Initialization
async function initDB() {
    if (!pool) {
        console.warn('DATABASE_URL not found. Skipping DB initialization.');
        return;
    }
    try {
        const connection = await pool.getConnection();
        console.log('Connected to Railway MySQL database.');
        
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
        console.log('Messages table verified/created.');
        connection.release();
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

initDB();

// Routes
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    try {
        // 1. Save to Database (if pool exists)
        if (pool) {
            await pool.execute(
                'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
                [name, email, subject || 'No Subject', message]
            );
            console.log('Message saved to database.');
        } else {
            console.warn('Database URL missing. Skipping database save.');
        }

        // 2. Email transporter setup (if credentials exist)
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: email,
                to: process.env.EMAIL_USER,
                subject: `New Portfolio Message: ${subject || 'Contact Request'}`,
                text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
            };

            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: 'Message sent and saved successfully!' });
        } else {
            console.warn('Email credentials missing. Notification not sent.');
            if (pool) {
                res.status(200).json({ message: 'Message saved to database, but email notification failed (missing credentials).' });
            } else {
                res.status(500).json({ error: 'Server configuration error: No database or email service available.' });
            }
        }
    } catch (error) {
        console.error('Error handling contact form:', error);
        res.status(500).json({ error: 'An error occurred. Please try again later.' });
    }
});

// serve frontend via static


module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}
