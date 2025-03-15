const express = require('express');
const app = express();
const userRoutes = require('./controllers/userController');
const announcesRoutes = require('./controllers/announcesController');
const connectDB = require('./config/db');

// Middleware
app.use(express.json());
global.loggedInUsers = {}; //a this resets if server restarts (no persistence)

// Connect Database
connectDB().then((db) => {
    // Make the database available in requests
    app.locals.db = db;

    // Routes
    app.use('/user', userRoutes);
    app.use('/announces', announcesRoutes);


    // Start Server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(console.error);
