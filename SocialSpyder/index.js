
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

// Twitter API token - trim to remove any whitespace that might cause issues
const RETTIWT_API_KEY = process.env.RETTIWT_API_KEY ? process.env.RETTIWT_API_KEY.trim() : null;

// Initialize API immediately instead of waiting
let apiInitialized = RETTIWT_API_KEY ? true : false;
console.log(`Rettiwt API initialization status: ${apiInitialized ? 'Ready' : 'Failed - Missing API key'}`);

// Function to fetch tweets from Twitter API with better error handling
async function fetchTweets(username, count = 10) {
  try {
    if (!RETTIWT_API_KEY) {
      throw new Error('RETTIWT_API_KEY not configured');
    }

    // Log the API key (masked for security)
    const maskedKey = RETTIWT_API_KEY.substring(0, 5) + '...' + RETTIWT_API_KEY.substring(RETTIWT_API_KEY.length - 5);
    console.log(`Using API key: ${maskedKey}`);

    // The proper Twitter API v2 endpoint for getting user tweets
    // First get the user ID by username
    console.log(`Looking up user ID for username: ${username}`);
    
    const userLookupUrl = `https://api.twitter.com/2/users/by/username/${username}`;
    const userResponse = await axios.get(userLookupUrl, {
      headers: {
        'Authorization': `Bearer ${RETTIWT_API_KEY}`
      },
      timeout: 10000 // 10 second timeout
    });
    
    if (!userResponse.data || !userResponse.data.data || !userResponse.data.data.id) {
      console.error(`User not found: ${username}`);
      throw new Error(`Twitter user not found: ${username}`);
    }
    
    const userId = userResponse.data.data.id;
    console.log(`Found user ID for ${username}: ${userId}`);
    
    // Now get the user's tweets with the ID
    const tweetsUrl = `https://api.twitter.com/2/users/${userId}/tweets`;
    console.log(`Fetching tweets for user ID ${userId} from ${tweetsUrl}`);
    
    // Make request to Twitter API with exponential backoff (3 attempts)
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        response = await axios.get(tweetsUrl, {
          headers: {
            'Authorization': `Bearer ${RETTIWT_API_KEY}`
          },
          params: {
            max_results: count,
            'tweet.fields': 'created_at,text'
          },
          timeout: 15000 // 15 second timeout
        });
        
        // Check if we have a proper response with data
        if (response && response.data && response.data.data) {
          break; // Success, exit the retry loop
        } else {
          throw new Error('Twitter API returned an empty response');
        }
      } catch (error) {
        attempts++;
        const status = error.response ? error.response.status : 'unknown';
        const message = error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
        
        console.log(`API request failed (attempt ${attempts}/${maxAttempts}): Status ${status}, ${message}`);
        
        if (attempts >= maxAttempts) {
          throw error; // Rethrow after max attempts
        }
        
        // Exponential backoff: wait 2^attempt * 1000ms
        const backoffTime = Math.pow(2, attempts) * 1000;
        console.log(`Retrying in ${backoffTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
    
    if (response && response.data && response.data.data && response.data.data.length > 0) {
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
    throw new Error(`Twitter API error: ${error.message}`);
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
    apiInitialized: apiInitialized, 
    apiKeyPresent: !!RETTIWT_API_KEY
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
      console.log('API not initialized, cannot fetch real tweets');
      return res.status(503).json({ 
        error: 'API initialization failed, please check server logs' 
      });
    }
    
    // Clean username (remove @ if present)
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    let tweets;
    let usedMockData = false;
    
    try {
      console.log(`Attempting to fetch real tweets for ${cleanUsername}`);
      tweets = await fetchTweets(cleanUsername);
      console.log(`Successfully fetched ${tweets.length} real tweets`);
    } catch (error) {
      console.error(`Error fetching real tweets: ${error.message}`);
      
      // Fallback to mock tweets
      console.log('Falling back to mock tweets due to API error');
      tweets = generateMockTweets(cleanUsername);
      usedMockData = true;
    }
    
    if (tweets.length === 0) {
      console.log('No tweets found, generating mock tweets as fallback');
      tweets = generateMockTweets(cleanUsername);
      usedMockData = true;
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
            email: email,
            is_mock: usedMockData
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
      username: cleanUsername,
      usedMockData: usedMockData
    });
  } catch (error) {
    console.error('Error processing request:', error.message);
    res.status(500).json({ 
      error: `Failed to fetch tweets: ${error.message}` 
    });
  }
});

// Start the server
const server = app.listen(PORT, () => {
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
