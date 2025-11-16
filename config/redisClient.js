const redis = require('redis');

// Create a client. It will connect to redis://127.0.0.1:6379 by default.
const redisClient = redis.createClient();

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Asynchronously connect the client.
const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Redis client connected successfully.');
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
};

module.exports = { redisClient, connectRedis };