
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

if (!apiKey) {
    console.error("❌ Missing RETTIWT_API_KEY! Ensure it is set in the .env file.");
}

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY! Ensure they are set in the .env file.");
}

// Initialize Rettiwt API with retries and timeout
let rettiwt = null;
const maxRetries = 3;

async function initializeRettiwtWithRetry(retryCount = 0) {
    try {
        console.log(`🔄 Initializing Rettiwt API (attempt ${retryCount + 1}/${maxRetries})...`);
        rettiwt = new Rettiwt({ 
            apiKey,
            timeout: 30000 // 30 second timeout
        });
        console.log("✅ Rettiwt API initialized successfully");
        return true;
    } catch (error) {
        console.error(`❌ Error initializing Rettiwt API: ${error.message}`);
        if (retryCount < maxRetries - 1) {
            console.log(`🔄 Retrying in 3 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return initializeRettiwtWithRetry(retryCount + 1);
        } else {
            console.error("❌ Failed to initialize Rettiwt API after multiple attempts");
            return false;
        }
    }
}

// Initialize Supabase client
let supabase = null;
if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log("✅ Supabase client initialized successfully");
    } catch (error) {
        console.error(`❌ Error initializing Supabase client: ${error.message}`);
    }
}

// Initialize API during startup
initializeRettiwtWithRetry();

// Helper function to create mock tweets as a fallback
function createMockTweets(username, count = 5) {
    console.log(`⚠️ Creating ${count} mock tweets for ${username}`);
    const mockTweets = [];
    const topics = ['technology', 'AI', 'climate change', 'startups', 'web development'];
    
    for (let i = 0; i < count; i++) {
        const topic = topics[Math.floor(Math.random() * topics.length)];
        mockTweets.push({
            id: `mock-${Date.now()}-${i}`,
            text: `This is a mock tweet #${i+1} about ${topic} since we couldn't fetch real tweets for @${username}.`,
            created_at: new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            username: username,
            is_mock: true
        });
    }
    
    return mockTweets;
}

// API endpoint to fetch and store tweets
app.post('/fetch-tweets', async (req, res) => {
    const { username, email } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Username is required." });
    }

    try {
        // Check if Rettiwt API is initialized
        if (!rettiwt) {
            const success = await initializeRettiwtWithRetry();
            if (!success) {
                const mockTweets = createMockTweets(username);
                return res.json({ 
                    message: "Rettiwt API unavailable. Returning mock tweets.", 
                    tweets: mockTweets,
                    count: mockTweets.length,
                    is_mock: true 
                });
            }
        }
        
        console.log(`🔍 Fetching tweets for ${username}...`);
        
        // Clean username format (remove @ if present)
        const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
        
        // Fetch recent tweets from Rettiwt API (limit to 5 tweets)
        let tweets = [];
        try {
            tweets = await rettiwt.tweet.search({
                fromUsers: [cleanUsername],
                limit: 5
            });
        } catch (error) {
            console.error(`❌ Error fetching tweets from Rettiwt API: ${error.message}`);
            // Use mock tweets as fallback
            tweets = createMockTweets(cleanUsername);
            
            if (supabase) {
                // Store mock tweets in Supabase
                try {
                    const { data, error } = await supabase
                        .from('tweets')
                        .insert(tweets.map(tweet => ({
                            username: cleanUsername,
                            tweet_id: tweet.id,
                            text: tweet.text,
                            created_at: tweet.created_at,
                            fetched_at: new Date().toISOString(),
                            processed: false,
                            email: email || null,
                            is_mock: true
                        })));
    
                    if (error) {
                        console.error("❌ Error storing mock tweets:", error);
                    } else {
                        console.log(`✅ Successfully stored ${tweets.length} mock tweets in database`);
                    }
                } catch (storeError) {
                    console.error("❌ Error during Supabase storage:", storeError);
                }
            }
            
            return res.json({ 
                message: "Failed to fetch real tweets. Returning mock tweets instead.", 
                tweets, 
                count: tweets.length,
                is_mock: true 
            });
        }

        if (!tweets || tweets.length === 0) {
            console.log(`⚠️ No tweets found for ${username}`);
            const mockTweets = createMockTweets(cleanUsername);
            return res.json({ 
                message: "No tweets found for this user. Returning mock tweets.", 
                tweets: mockTweets,
                count: mockTweets.length,
                is_mock: true 
            });
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
            email: email || null,
            is_mock: false
        }));

        // Store tweets in Supabase if available
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('tweets')
                    .insert(formattedTweets);
    
                if (error) {
                    console.error("❌ Error storing tweets:", error);
                } else {
                    console.log(`✅ Successfully stored ${formattedTweets.length} tweets in database`);
                }
            } catch (error) {
                console.error("❌ Error during Supabase storage:", error);
            }
        } else {
            console.log("⚠️ Supabase client not available, skipping database storage");
        }

        res.json({ 
            message: "Tweets fetched successfully!", 
            count: formattedTweets.length,
            tweets: formattedTweets 
        });
    } catch (error) {
        console.error("❌ Error fetching or storing tweets:", error);
        
        // Provide mock tweets as fallback
        const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
        const mockTweets = createMockTweets(cleanUsername);
        
        res.status(200).json({ 
            message: "Error fetching real tweets. Using mock data instead.",
            error: error.message,
            count: mockTweets.length,
            tweets: mockTweets,
            is_mock: true
        });
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
        
        if (!fetchResponse.ok && !fetchData.is_mock) {
            throw new Error(fetchData.error || 'Failed to fetch tweets');
        }
        
        // Now invoke the summarize-tweets function via Supabase Edge Function
        if (supabase) {
            try {
                const { data: summaryData, error: summaryError } = await supabase.functions.invoke('summarize-tweets', {
                    body: { usernames: [username], email }
                });
                
                if (summaryError) {
                    console.error("❌ Error summarizing tweets:", summaryError);
                }
                
                // Finally send an email with the summarized content
                const { data: emailData, error: emailError } = await supabase.functions.invoke('send-newsletters', {
                    body: { email, forceSend: true }
                });
                
                if (emailError) {
                    console.error("❌ Error sending email:", emailError);
                    throw new Error(`Error sending email: ${emailError.message}`);
                }
            } catch (error) {
                console.error("❌ Error invoking Supabase functions:", error);
                throw new Error(`Error processing tweets with Supabase: ${error.message}`);
            }
        } else {
            console.log("⚠️ Supabase client not available, using direct API call");
            
            // Call the quick-test function directly via API
            try {
                const supabaseApiUrl = process.env.SUPABASE_URL;
                const quickTestResponse = await fetch(`${supabaseApiUrl}/functions/v1/quick-test`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
                    },
                    body: JSON.stringify({ 
                        email, 
                        twitterSource: username 
                    })
                });
                
                if (!quickTestResponse.ok) {
                    const errorText = await quickTestResponse.text();
                    throw new Error(`Failed to run quick test: ${errorText}`);
                }
            } catch (error) {
                console.error("❌ Error calling quick-test function:", error);
                throw error;
            }
        }
        
        res.json({ 
            message: fetchData.is_mock 
                ? "Quick test completed with mock data! Check your email for the summarized tweets." 
                : "Quick test completed successfully! Check your email for the summarized tweets.",
            tweetCount: fetchData.count,
            usedMockData: fetchData.is_mock
        });
    } catch (error) {
        console.error("❌ Error during quick test:", error);
        res.status(500).json({ error: error.message || "An error occurred during the quick test." });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        uptime: process.uptime(),
        status: 'ok',
        timestamp: new Date().toISOString()
    };
    res.json(health);
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
    console.log(`   - GET /health - Health check endpoint`);
    
    // Periodic health check of Rettiwt API
    setInterval(async () => {
        if (!rettiwt) {
            console.log("🔄 Rettiwt API not initialized, attempting to initialize...");
            await initializeRettiwtWithRetry();
        }
    }, 60000); // Check every minute
});
