const express = require('express');
const http = require('http');              // 👈 Avem nevoie de server HTTP pentru Socket.io
const { Server } = require('socket.io');   // 👈 Socket.io server
const path = require('path'); // ✅ Adăugat aici!

const app = express();
const userRoutes = require('./controllers/userController');
const announcesRoutes = require('./controllers/announcesController');
const messagesRoutes = require('./controllers/messagesController');
const connectDB = require('./config/db');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Frontend')));

// LOGIN PAGE
app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'login.html'));
});

app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'main.html'));
});

app.get('/map', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'map.html'));
});

app.get('/myAccount', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'myAccount.html'));
});

app.get('/addAnnounce', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'addAccount.html'));
});

app.get('/favorite', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'favorite.html'));
});

app.get('/conversations', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'conversations.html'));
});

global.loggedInUsers = {}; // a this resets if server restarts (no persistence)

// Creezi serverul HTTP pe care rulezi Express + Socket.io
const server = http.createServer(app);

// Inițializezi Socket.io pe acest server
const io = new Server(server, {
    cors: {
        origin: '*', // 👉 În dev accepti orice, in prod setezi domeniul frontend
        methods: ['GET', 'POST']
    }
});

// Socket.io logic (conexiuni)
io.on('connection', (socket) => {
    console.log(`🟢 New user connected: ${socket.id}`);

    // Când utilizatorul intră într-un room
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`🟡 User ${socket.id} joined room ${room}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔴 User disconnected: ${socket.id}`);
    });
});

// Conectarea la baza de date și pornirea serverului
connectDB()
    .then((db) => {
        console.log('MongoDB connected successfully.');

        // Make the database available in requests
        app.locals.db = db;

        // Make Socket.io available too
        app.locals.io = io;

        // Rute
        app.use('/user', userRoutes);
        app.use('/announces', announcesRoutes); // ⚠️ Asigură-te că în messagesController exporți corect un `router`
        app.use('/messages', messagesRoutes);

        // Start Server (Express + WebSocket pe același port)
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            console.log(`🚀 Server + WebSocket running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error);
    });
