import express from 'express';
import cors from 'cors';
import { Rettiwt } from 'rettiwt-api';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config(); // Load environment variables

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors()); // Allow frontend requests

// Ensure API keys are available
const apiKey = process.env.RETTIWT_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!apiKey || !supabaseUrl || !supabaseKey) {
    console.error("❌ Missing API keys! Ensure RETTIWT_API_KEY, SUPABASE_URL, and SUPABASE_KEY are set in the .env file.");
    process.exit(1);
}

// Initialize Rettiwt API
const rettiwt = new Rettiwt({ apiKey });

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// API endpoint to fetch and store tweets
app.post('/fetch-tweets', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Username is required." });
    }

    try {
        // Fetch recent tweets from Rettiwt API
        const tweets = await rettiwt.tweet.search({
            fromUsers: [username],
        });

        if (!tweets || tweets.length === 0) {
            return res.status(404).json({ message: "No tweets found for this user." });
        }

        // Store tweets in Supabase
        const { data, error } = await supabase
            .from('tweets')
            .insert(tweets.map(tweet => ({
                username,
                tweet_id: tweet.id,
                text: tweet.text,
                created_at: tweet.created_at
            })));

        if (error) {
            throw error;
        }

        res.json({ message: "Tweets stored successfully!", data });
    } catch (error) {
        console.error("❌ Error fetching or storing tweets:", error);
        res.status(500).json({ error: error.message });
    }
});

// Default route
app.get('/', (req, res) => {
    res.send('✅ Rettiwt API is running! Send a POST request to /fetch-tweets with { "username": "elonmusk" }.');
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
