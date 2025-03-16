const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // for password hashing
const { MongoClient } = require('mongodb');

// MongoDB setup (you could also import this from a separate db.js config)
const uri = 'mongodb://localhost:27017/';
const client = new MongoClient(uri);
let db;

async function initDB() {
    await client.connect();
    db = client.db('Hackaboom'); // your database name
    console.log('Connected to MongoDB');
}

initDB().catch(console.error);

// ================== SIGNUP ==================

// ================== LOGIN ==================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // If you want to use sessions or JWT, you can issue a token/session here.
        delete loggedInUsers[email];

        res.status(200).json({ message: 'Login successful', email: user.email });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password, location } = req.body;

        if (!email || !password || !username || !location || !location.city || !location.lat || !location.lng) {
            return res.status(400).json({ message: 'Username, email, password și locația completă (city, lat, lng) sunt obligatorii.' });
        }

        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ Creăm userul cu locație și oreAdunate implicite
        const newUser = {
            username,
            email,
            password: hashedPassword,
            location: {
                city: location.city,
                lat: parseFloat(location.lat),
                lng: parseFloat(location.lng)
            },
            oreAdunate: 2, // 🚀 Setăm implicit 2 ore
            createdAt: new Date()
        };

        const result = await db.collection('users').insertOne(newUser);
        await db.collection('favorites').insertOne({
            email: email,
            favorites: []
        });
        res.status(201).json({ message: 'User registered successfully', userId: result.insertedId });
    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/logout', (req, res) => {
    const { email } = req.body;

    // Simple verification: check if the email exists and is logged in
    if (!email) {
        return res.status(400).json({ message: 'Couldnt take user email from server!' });
    }

    if (loggedInUsers[email]) {
        delete loggedInUsers[email];
        console.log(`User ${email} logged out.`);
        return res.status(200).json({ message: `User ${email} logged out successfully.` });
    } else {
        return res.status(400).json({ message: `User ${email} is not logged in.` });
    }
});

// GET /myAccount
router.get('/myAccount', async (req, res) => {
    try {

        // Preluăm email-ul din query params
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({
                message: 'Email-ul este obligatoriu!'
            });
        }
        // Caută userul după email
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: 'Utilizatorul nu a fost găsit!'
            });
        }

        // Caută anunțurile publicate de utilizator
        const announcements = await db.collection('announcements').find({
            userEmail: email
        }).toArray();

        // Trimitem informațiile userului + anunțurile
        res.status(200).json({
            username: user.username,
            email: user.email,
            oreAdunate: user.oreAdunate,
            locatie: user.location.city, // doar orașul
            announcements: announcements
        });

    } catch (error) {
        console.error('Eroare la preluarea contului:', error);
        res.status(500).json({
            message: 'Eroare internă pe server.'
        });
    }
});


module.exports = router;

module.exports = router;
