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

router.get('/chat', async (req, res) => {
    try {
        const { senderEmail, receiverEmail } = req.query;

        if (!senderEmail || !receiverEmail) {
            return res.status(400).json({ message: 'Missing senderEmail or receiverEmail!' });
        }

        // Căutăm mesajele dintre cei doi useri
        const messages = await db.collection('messages').find(
            {
                $or: [
                    { senderEmail: senderEmail, receiverEmail: receiverEmail },
                    { senderEmail: receiverEmail, receiverEmail: senderEmail }
                ]
            },
            {
                projection: {
                    senderEmail: 1,
                    receiverEmail: 1,
                    message: 1
                }
            }
        )
            .sort({ createdAt: 1 }) // sortăm cronologic
            .toArray();

        res.status(200).json({
            message: 'Lista mesajelor dintre utilizatori',
            conversations: messages
        });

    } catch (error) {
        console.error('❌ Eroare la preluarea mesajelor:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /messages/conversation

router.get('/conversationsUsers', async (req, res) =>    {
    try {
        const { email } = req.query; // <-- nu params, ci query!
        console.log("Email primit:", email);

        if (!email) {
            return res.status(400).json({ message: 'Email param is missing!' });
        }

        // Căutăm conversațiile în care apare acest email ca sender sau receiver
        const conversations = await db.collection('conversations').find({
            $or: [
                { senderEmail: email }
            ]
        }).toArray();

        console.log("Conversații găsite:", conversations);

        if (!conversations.length) {
            return res.status(200).json({
                message: 'Nu există conversații.',
                conversations: []
            });
        }

        res.status(200).json({
            message: 'Lista conversațiilor',
            conversations: conversations
        });

    } catch (error) {
        console.error('❌ Eroare la preluarea conversațiilor:', error);
        res.status(500).json({
            message: 'Eroare internă pe server'
        });
    }
});

router.post('/create/conversation', async (req, res) => {
    const { senderEmail, receiverEmail } = req.body;
    console.log(senderEmail);
    console.log(receiverEmail);
    try {
        const { senderEmail, receiverEmail } = req.body;

        console.log("➡️ Cerere creare conversație");
        console.log("SenderEmail:", senderEmail);
        console.log("ReceiverEmail:", receiverEmail);

        // ✅ Verificări de bază
        if (!senderEmail || !receiverEmail) {
            return res.status(400).json({
                message: 'Lipsește senderEmail sau receiverEmail!'
            });
        }

        // ✅ Verificăm dacă există deja conversația (opțional)
        const existingConversation = await db.collection('conversations').findOne({
            $or: [
                { senderEmail: senderEmail, receiverEmail: receiverEmail },
                { senderEmail: receiverEmail, receiverEmail: senderEmail }
            ]
        });

        if (existingConversation) {
            return res.status(409).json({
                message: 'Conversația există deja!',
                conversationId: existingConversation._id
            });
        }

        // ✅ Construim conversația nouă
        const newConversation = {
            senderEmail: senderEmail,
            receiverEmail: receiverEmail,
            createdAt: new Date()
        };
        console.log(newConversation);
        const result = await db.collection('conversations').insertOne(newConversation);

        if (result.acknowledged) {
            console.log("✅ Conversație creată cu succes:", result.insertedId);
            return res.status(201).json({
                message: 'Conversație creată cu succes!',
                conversationId: result.insertedId
            });
        } else {
            return res.status(500).json({
                message: 'Eroare la crearea conversației!'
            });
        }

    } catch (error) {
        console.error('❌ Eroare la crearea conversației:', error);
        res.status(500).json({
            message: 'Eroare internă pe server!'
        });
    }
});

module.exports = router;
