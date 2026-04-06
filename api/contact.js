const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');

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

// Native Vercel Handler
module.exports = async (req, res) => {
    // 1. Only allow POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        await initDB();
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Please provide all required fields.' });
        }

        // 2. Save to Database
        if (pool) {
            await pool.execute(
                'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
                [name, email, subject || 'No Subject', message]
            );
        }

        // 3. Email Notification
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
            return res.status(200).json({ message: 'Message sent and saved successfully!' });
        } else {
            return res.status(200).json({ message: 'Message saved, but email notification skipped (missing settings).' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: `Server error: ${error.message}` });
    }
};
