const redis = require('redis');

// 1. Use Cloud URL if available, otherwise fallback to Localhost
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redisClient = redis.createClient({
    url: redisUrl
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

const connectRedis = async () => {
    try {
        await redisClient.connect();
        // Log where we connected so you can show the teacher
        if (redisUrl.includes('cloud')) {
            console.log('✅ CONNECTED TO REDIS CLOUD'); 
        } else {
            console.log('⚠️ Connected to Local Docker Redis');
        }
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
};

module.exports = { redisClient, connectRedis };
