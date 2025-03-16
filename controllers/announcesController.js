const express = require('express');
const router = express.Router();// for password hashing
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');
const formidable = require('express-formidable');
const path = require('path');
const fs = require('fs');

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
// Middleware specific pentru aceasta ruta

// ✅ Middleware pentru prelucrare formData
router.post('/create', formidable(), async (req, res) => {
    try {

        console.log('➡️ Fields:', req.fields);
        console.log('➡️ Files:', req.files);

        // Extragem valorile trimise prin formData
        const name = req.fields.name;
        const description = req.fields.description;
        const price = req.fields.price;
        const userEmail = req.fields.userEmail;

        // ✅ Location este un array: [city, lat, lng]
        let locationArray;
        try {
            locationArray = JSON.parse(req.fields.location);
        } catch (parseError) {
            console.error('❌ JSON parse error for location:', parseError);
            return res.status(400).json({ message: 'Locația nu a fost trimisă corect!' });
        }

        const city = locationArray[0];
        const lat = parseFloat(locationArray[1]);
        const lng = parseFloat(locationArray[2]);

        // ✅ Validare minimă
        if (!name || !description || !price || !userEmail || !city || !lat || !lng) {
            return res.status(400).json({
                message: 'Toate câmpurile sunt obligatorii!'
            });
        }

        // ✅ Verificăm dacă există deja un anunț identic
        const existingAnnouncement = await db.collection('announcements').findOne({
            name: name,
            userEmail: userEmail,
            description: description,
            price: parseFloat(price),
            "location.city": city
        });

        if (existingAnnouncement) {
            return res.status(409).json({
                message: 'Anunțul există deja!'
            });
        }

        // ✅ Prelucrăm fișierul imagine primit
        const photoFile = req.files.photo;

        if (!photoFile) {
            return res.status(400).json({
                message: 'Imaginea este obligatorie!'
            });
        }

        const uploadDir = path.join(__dirname, '../uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const photoFileName = `${Date.now()}_${photoFile.name}`; // pentru a evita conflicte de nume
        const photoFilePath = path.join(uploadDir, photoFileName);

        // ✅ Mutăm fișierul primit în folderul uploads
        fs.renameSync(photoFile.path, photoFilePath);

        // ✅ Construim obiectul care va fi salvat în baza de date
        const announcement = {
            name: name,
            userEmail: userEmail,
            description: description,
            price: parseFloat(price),
            location: {
                city: city,
                lat: lat,
                lng: lng
            },
            photoPath: `/uploads/${photoFileName}`,
            createdAt: new Date()
        };

        console.log('✅ Announcement ready for DB:', announcement);

        const result = await db.collection('announcements').insertOne(announcement);

        if (result.acknowledged && result.insertedId) {
            return res.status(201).json({
                message: 'Anunț creat cu succes!',
                announcementId: result.insertedId
            });
        } else {
            return res.status(500).json({
                message: 'Nu s-a putut crea anunțul!'
            });
        }

    } catch (error) {
        console.error('❌ Create Announcement Error:', error);
        return res.status(500).json({ message: 'Eroare internă pe server!' });
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

router.get('/favorite', async (req, res) => {
    try {
        const { email } = req.query;
        console.log(email);
        if (!email) {
            return res.status(400).json({ message: 'Email este obligatoriu!' });
        }

        const userFavorites = await db.collection('favorites').findOne({ email: email });

        if (!userFavorites) {
            return res.status(404).json({ message: 'Nu există favorite pentru acest utilizator.' });
        }

        // Dacă vrei să returnezi direct detaliile anunțurilor favorite:
        const announcements = await db.collection('announcements').find({
            _id: { $in: userFavorites.favorites.map(id => new ObjectId(id)) }
        }).toArray();

        res.status(200).json({ favorites: announcements });

    } catch (error) {
        console.error('Eroare la obținerea favoritelor:', error);
        res.status(500).json({ message: 'Eroare server!' });
    }
});

router.post('/addFavorite', async (req, res) => {
    try {
        const { email, name } = req.body;

        if (!email || !name) {
            return res.status(400).json({ message: 'Email și numele anunțului sunt obligatorii!' });
        }

        // 1️⃣ Găsim anunțul după nume
        const announcement = await db.collection('announcements').findOne({ name: name });

        if (!announcement) {
            return res.status(404).json({ message: 'Anunțul nu a fost găsit!' });
        }

        const announcementId = announcement._id.toString();

        // 2️⃣ Verificăm dacă userul are deja acest anunț la favorite
        const userFavorites = await db.collection('favorites').findOne({ email: email });

        if (userFavorites) {
            const alreadyFavorite = userFavorites.favorites.includes(announcementId);

            if (alreadyFavorite) {
                return res.status(409).json({ message: 'Anunțul este deja în favorite!' });
            }

            // 3️⃣ Adaugă anunțul la favorite (nu există deja)
            await db.collection('favorites').updateOne(
                { email: email },
                { $push: { favorites: announcementId } }
            );

            return res.status(200).json({ message: '✅ Anunț adăugat la favorite!' });

        } else {
            // 4️⃣ Dacă userul nu are încă favorite, creăm documentul
            await db.collection('favorites').insertOne({
                email: email,
                favorites: [announcementId]
            });

            return res.status(201).json({ message: '✅ Favorite create și anunț adăugat!' });
        }

    } catch (error) {
        console.error('❌ Eroare la adăugarea în favorite:', error);
        res.status(500).json({ message: 'Eroare server!' });
    }
});






module.exports = router;
