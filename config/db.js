const { MongoClient } = require('mongodb');

const client = new MongoClient('mongodb://localhost:27017/');

async function connectDB() {
    try {
        await client.connect();
        console.log("MongoDB connected successfully.");
        return client.db('mydatabase'); // use your database name here
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
}

module.exports = connectDB;
