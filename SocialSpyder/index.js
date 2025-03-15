import express from 'express';
import { Rettiwt } from 'rettiwt-api';
import dotenv from 'dotenv';

dotenv.config(); // Load API key from .env

const app = express();
const PORT = 3000;

// Ensure API key is available
const apiKey = process.env.RETTIWT_API_KEY;
if (!apiKey) {
    console.error("❌ API Key is missing! Set RETTIWT_API_KEY in the .env file.");
    process.exit(1);
}

// Creating a new Rettiwt instance with API key authentication
const rettiwt = new Rettiwt({ apiKey });

// Endpoint to fetch recent tweets by username
app.get('/tweets/:username', async (req, res) => {
    const { username } = req.params;

    try {
        // Fetch recent tweets from the given username
        const tweets = await rettiwt.tweet.search({
            fromUsers: [username],
        });

        res.json({ username, tweets });
    } catch (error) {
        console.error(`❌ Error fetching tweets for @${username}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Default route
app.get('/', (req, res) => {
    res.send('✅ Rettiwt API is running! Use /tweets/:username to fetch tweets.');
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
