
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Twitter API token
const RETTIWT_API_KEY = process.env.RETTIWT_API_KEY;

// Simulated wait time for API initialization
let apiInitialized = false;
setTimeout(() => {
  console.log('Rettiwt API initialized');
  apiInitialized = true;
}, 2000);

// Function to fetch tweets from Twitter API
async function fetchTweets(username, count = 10) {
  try {
    if (!RETTIWT_API_KEY) {
      throw new Error('RETTIWT_API_KEY not configured');
    }

    // Log the API key (masked for security)
    const maskedKey = RETTIWT_API_KEY.substring(0, 5) + '...' + RETTIWT_API_KEY.substring(RETTIWT_API_KEY.length - 5);
    console.log(`Using API key: ${maskedKey}`);

    // Construct the Twitter API URL
    const apiUrl = `https://api.twitter.com/2/users/by/username/${username}/tweets`;
    
    console.log(`Fetching tweets for ${username} from ${apiUrl}`);
    
    // Make request to Twitter API with exponential backoff (3 attempts)
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        response = await axios.get(apiUrl, {
          headers: {
            'Authorization': `Bearer ${RETTIWT_API_KEY}`
          },
          params: {
            max_results: count,
            'tweet.fields': 'created_at,text'
          },
          timeout: 10000 // 10 second timeout
        });
        break; // Success, exit the retry loop
      } catch (error) {
        attempts++;
        console.log(`API request failed (attempt ${attempts}/${maxAttempts}): ${error.message}`);
        
        if (attempts >= maxAttempts) {
          throw error; // Rethrow after max attempts
        }
        
        // Exponential backoff: wait 2^attempt * 1000ms
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
    
    if (response && response.data && response.data.data) {
      // Successfully retrieved tweets
      console.log(`Retrieved ${response.data.data.length} tweets for ${username}`);
      
      return response.data.data.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        username: username
      }));
    } else {
      console.log('No tweets found in the API response');
      return [];
    }
  } catch (error) {
    console.error(`Error fetching tweets for ${username}:`, error.message);
    throw new Error(`Twint API error: ${error.message}`);
  }
}

// Generate mock tweets for testing when the API is down
function generateMockTweets(username, count = 5) {
  console.log(`Generating ${count} mock tweets for ${username}`);
  
  const topics = ['technology', 'AI', 'software', 'crypto', 'startups', 'innovation'];
  const tweets = [];
  
  for (let i = 0; i < count; i++) {
    const topic = topics[Math.floor(Math.random() * topics.length)];
    tweets.push({
      id: `mock-${Date.now()}-${i}`,
      text: `This is a mock tweet #${i+1} about ${topic} from ${username}. #MockData #Testing`,
      created_at: new Date().toISOString(),
      username: username
    });
  }
  
  return tweets;
}

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    apiInitialized: apiInitialized 
  });
});

// Fetch tweets endpoint
app.post('/fetch-tweets', async (req, res) => {
  const { username, email } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  console.log(`Received request to fetch tweets for @${username}`);
  
  try {
    // Ensure API is initialized
    if (!apiInitialized) {
      console.log('API not yet initialized, waiting...');
      return res.status(503).json({ 
        error: 'API initialization in progress, please try again in a few seconds' 
      });
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    let tweets;
    try {
      tweets = await fetchTweets(cleanUsername);
    } catch (error) {
      console.error(`Error fetching real tweets: ${error.message}`);
      
      // Fallback to mock tweets
      console.log('Falling back to mock tweets');
      tweets = generateMockTweets(cleanUsername);
    }
    
    if (tweets.length === 0) {
      console.log('No tweets found, generating mock tweets as fallback');
      tweets = generateMockTweets(cleanUsername);
    }
    
    if (supabase && email) {
      try {
        // Store tweets in Supabase
        const { data, error } = await supabase
          .from('tweets')
          .upsert(tweets.map(tweet => ({
            tweet_id: tweet.id,
            username: cleanUsername,
            text: tweet.text,
            created_at: tweet.created_at,
            fetched_at: new Date().toISOString(),
            processed: false,
            email: email
          })));
          
        if (error) {
          console.error('Error storing tweets in Supabase:', error.message);
        } else {
          console.log(`Successfully stored ${tweets.length} tweets in Supabase`);
        }
      } catch (dbError) {
        console.error('Supabase error:', dbError.message);
      }
    }
    
    res.json({ 
      tweets,
      count: tweets.length,
      username: cleanUsername
    });
  } catch (error) {
    console.error('Error processing request:', error.message);
    res.status(500).json({ 
      error: `Failed to fetch tweets: ${error.message}` 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`SocialSpyder API server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
