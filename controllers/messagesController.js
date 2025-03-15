const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017/';
const client = new MongoClient(uri);

let db;
async function initDB() {
    await client.connect();
    db = client.db('Hackaboom'); // your database name
    console.log('Connected to MongoDB');
}

initDB().catch(console.error);
// POST /messages/send
router.post('/send', async (req, res) => {
    try {
        const io = req.app.locals.io;   // ✅ Socket.io (opțional)

        const { senderEmail, receiverEmail, message } = req.body;

        if (!senderEmail || !receiverEmail || !message) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const newMessage = {
            senderEmail,
            receiverEmail,
            message,
            createdAt: new Date()
        };

        // ✅ Insert in MongoDB
        const result = await db.collection('messages').insertOne(newMessage);

        if (!result.acknowledged) {
            return res.status(500).json({ message: 'Failed to save message in DB' });
        }

        // ✅ Emit Socket.io event (optional)
        const room = [senderEmail, receiverEmail].sort().join('-');
        io.to(room).emit('newMessage', newMessage);

        res.status(201).json({
            message: 'Mesaj trimis și salvat!',
            messageId: result.insertedId
        });

    } catch (error) {
        console.error('❌ Eroare la send message:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /messages/conversation
router.get('/conversation', async (req, res) => {
    try {
        const { user1, user2 } = req.query; // email-urile vin ca query params

        // Validare: ambele email-uri trebuie să fie prezente
        if (!user1 || !user2) {
            return res.status(400).json({
                message: 'Trebuie să trimiți ambii useri (user1 și user2) ca parametri de query!'
            });
        }

        // Căutăm toate mesajele dintre user1 și user2 (indiferent cine a trimis)
        const messages = await db.collection('messages').find({
            $or: [
                { senderEmail: user1, receiverEmail: user2 },
                { senderEmail: user2, receiverEmail: user1 }
            ]
        }).sort({ createdAt: 1 }).toArray(); // Sortăm după data trimiterii (cronologic)

        // Dacă nu există mesaje, trimitem un array gol
        res.status(200).json({
            conversation: messages
        });

    } catch (error) {
        console.error('❌ Eroare la preluarea conversației:', error);
        res.status(500).json({
            message: 'Eroare internă pe server'
        });
    }
});

module.exports = router;
