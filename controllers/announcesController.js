const express = require('express');
const router = express.Router();// for password hashing
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');
const e = require("express");

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

/*
* {
    "name": "nume",
    "email": "user@example.com",
    "description": "Vând bicicletă de munte, stare excelentă!",
    "price": 1500,
    "location": "Brașov",
    "photos": [
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
    ]
}
*/
router.post('/create', async (req, res) => {
    try {
        const { name, email, description, photos, price, location } = req.body;

        // 🔴 Validare email, descriere, preț și locație (coordonate)
        if (!name || !email || !description || !price || !location || !location.lat || !location.lng) {
            return res.status(400).json({
                message: 'Email, description, price și location (cu lat și lng) sunt obligatorii.'
            });
        }

        // ✅ Verificăm dacă există deja un anunț identic
        const existingAnnouncement = await db.collection('announcements').findOne({
            name: name,
            userEmail: email,
            description: description,
            price: price,
            "location.city": location.city || ''
        });

        if (existingAnnouncement) {
            return res.status(409).json({
                message: 'Anunțul există deja. Nu poți posta același anunț de două ori!'
            });
        }

        // ✅ Prelucrăm pozele, dacă există
        const processedPhotos = photos && photos.length > 0
            ? photos.map(base64 => ({
                data: base64,
                uploadedAt: new Date()
            }))
            : [];

        // ✅ Construim obiectul de anunț cu locație exactă
        const announcement = {
            name: name,
            userEmail: email,
            description,
            price: parseFloat(price),
            location: {
                city: location.city || '',
                lat: parseFloat(location.lat),
                lng: parseFloat(location.lng)
            },
            photos: processedPhotos,
            createdAt: new Date()
        };
        console.log(announcement);
        const result = await db.collection('announcements').insertOne(announcement);

        if (result.acknowledged && result.insertedId) {
            res.status(201).json({
                message: 'Announcement created successfully!',
                announcementId: result.insertedId
            });
        } else {
            res.status(500).json({
                message: 'Failed to create announcement in the database.'
            });
        }

    } catch (error) {
        console.error('Create Announcement Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

/*
* {
    "announcementId": "67d4c6227e82981a81132ff1"
}
* */
router.delete('/delete', async (req, res) => {
    try {
        const { announcementId } = req.body;

        // Verificăm dacă avem id-ul
        if (!announcementId) {
            return res.status(400).json({
                message: 'announcementId este obligatoriu.'
            });
        }

        // Convertim în ObjectId pentru MongoDB
        let announcementObjectId;
        try {
            announcementObjectId = new ObjectId(announcementId);
        } catch (error) {
            return res.status(400).json({
                message: 'announcementId invalid.'
            });
        }

        // Ștergem documentul după _id
        const deleteResult = await db.collection('announcements').deleteOne({
            _id: announcementObjectId
        });

        if (deleteResult.deletedCount === 1) {
            return res.status(200).json({
                message: `Anunțul ${announcementId} a fost șters cu succes.`
            });
        } else {
            return res.status(404).json({
                message: 'Anunțul nu a fost găsit.'
            });
        }

    } catch (error) {
        console.error('Eroare la ștergerea anunțului:', error);
        res.status(500).json({
            message: 'Eroare internă pe server.'
        });
    }
});

/*
{
    email: "user2@gmail.com";
}

*/
router.get('/user', async (req, res) => {
    try {
        const { email } = req.query;  // De obicei, la GET folosim query params: req.query.email

        // Verificăm dacă email-ul a fost trimis
        if (!email) {
            return res.status(400).json({
                message: 'Email este obligatoriu.'
            });
        }

        // Găsim toate anunțurile care aparțin acestui email
        const announcements = await db.collection('announcements').find({
            userEmail: email
        }).toArray();
        // Dacă nu sunt anunțuri, trimitem un array gol
        return res.status(200).json({
            message: `Anunțurile utilizatorului ${email}:`,
            announcements: announcements
        });

    } catch (error) {
        console.error('Eroare la preluarea anunțurilor:', error);
        res.status(500).json({
            message: 'Eroare internă pe server.'
        });
    }
});

/**/
router.get('/feed', async (req, res) => {
    try {
        // Căutăm toate anunțurile din colecția "announcements"
        const announcements = await db.collection('announcements').find({}).toArray();

        console.log(`Feed global cu ${announcements.length} anunțuri`);

        // Răspundem cu lista de anunțuri
        return res.status(200).json({
            message: 'Feed-ul cu toate anunțurile:',
            announcements: announcements
        });

    } catch (error) {
        console.error('Eroare la preluarea feed-ului:', error);
        res.status(500).json({
            message: 'Eroare internă pe server.'
        });
    }
});

router.get('/map', async (req, res) => {
    try {
        // Selectezi doar anunțurile cu locație (lat/lng)
        const announcements = await db.collection('announcements').find({
            "location.lat": { $exists: true },
            "location.lng": { $exists: true }
        }).project({
            description: 1,
            price: 1,
            location: 1,
            photos: 1,
            createdAt: 1
        }).toArray();

        res.status(200).json({
            message: 'Lista anunțurilor pentru hartă',
            announcements: announcements
        });

    } catch (error) {
        console.error('❌ Eroare la preluarea anunțurilor pentru hartă:', error);
        res.status(500).json({
            message: 'Eroare internă pe server'
        });
    }
});






module.exports = router;
