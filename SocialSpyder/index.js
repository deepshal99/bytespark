
import express from 'express';
import cors from 'cors';
import { Rettiwt } from 'rettiwt-api';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:8080', 'https://localhost:8080', process.env.FRONTEND_URL],
  methods: ['GET', 'POST'],
  credentials: true
})); 

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
    const { username, email } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Username is required." });
    }

    try {
        console.log(`🔍 Fetching tweets for ${username}...`);
        
        // Clean username format (remove @ if present)
        const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
        
        // Fetch recent tweets from Rettiwt API (limit to 5 tweets)
        const tweets = await rettiwt.tweet.search({
            fromUsers: [cleanUsername],
            limit: 5
        });

        if (!tweets || tweets.length === 0) {
            console.log(`⚠️ No tweets found for ${username}`);
            return res.status(404).json({ message: "No tweets found for this user." });
        }

        console.log(`✅ Found ${tweets.length} tweets for ${username}`);

        // Format tweets for database storage
        const formattedTweets = tweets.map(tweet => ({
            username: cleanUsername,
            tweet_id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at,
            fetched_at: new Date().toISOString(),
            processed: false,
            email: email || null
        }));

        // Store tweets in Supabase
        const { data, error } = await supabase
            .from('tweets')
            .insert(formattedTweets);

        if (error) {
            console.error("❌ Error storing tweets:", error);
            throw error;
        }

        console.log(`✅ Successfully stored ${formattedTweets.length} tweets in database`);
        res.json({ 
            message: "Tweets fetched and stored successfully!", 
            count: formattedTweets.length,
            tweets: formattedTweets 
        });
    } catch (error) {
        console.error("❌ Error fetching or storing tweets:", error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint for quick testing (fetch, summarize and email)
app.post('/quick-test', async (req, res) => {
    const { username, email } = req.body;

    if (!username || !email) {
        return res.status(400).json({ error: "Both username and email are required." });
    }

    try {
        console.log(`🔍 Quick test for ${username}, sending results to ${email}...`);
        
        // First fetch and store tweets
        const fetchResponse = await fetch(`http://localhost:${PORT}/fetch-tweets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email }),
        });
        
        const fetchData = await fetchResponse.json();
        
        if (!fetchResponse.ok) {
            throw new Error(fetchData.error || 'Failed to fetch tweets');
        }
        
        // Now invoke the summarize-tweets function via Supabase Edge Function
        const { error: summaryError } = await supabase.functions.invoke('summarize-tweets', {
            body: { usernames: [username], email }
        });
        
        if (summaryError) {
            throw new Error(`Error summarizing tweets: ${summaryError.message}`);
        }
        
        // Finally send an email with the summarized content
        const { error: emailError } = await supabase.functions.invoke('send-newsletters', {
            body: { email, forceSend: true }
        });
        
        if (emailError) {
            throw new Error(`Error sending email: ${emailError.message}`);
        }
        
        res.json({ 
            message: "Quick test completed successfully! Check your email for the summarized tweets.",
            tweetCount: fetchData.count
        });
    } catch (error) {
        console.error("❌ Error during quick test:", error);
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
    console.log(`📌 Available endpoints:`);
    console.log(`   - POST /fetch-tweets - Fetch and store tweets`);
    console.log(`   - POST /quick-test - Fetch, summarize and email tweets`);
});
