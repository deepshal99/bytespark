
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.29.0'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string
const RETTIWT_API_URL = Deno.env.get('RETTIWT_API_URL') || 'http://localhost:3000'
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') as string

// Create a mock tweet function to use as fallback
function createMockTweets(username: string, count = 3) {
  const tweets = [];
  const topics = ['technology', 'science', 'politics', 'sports', 'entertainment'];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  for (let i = 0; i < count; i++) {
    tweets.push({
      id: `mock-${Date.now()}-${i}`,
      text: `This is a sample tweet #${i+1} about ${randomTopic} from ${username}. Created as a mock because we couldn't connect to the Twitter API.`,
      created_at: new Date().toISOString(),
      username
    });
  }
  
  return tweets;
}

// Function to summarize tweets using OpenAI
async function summarizeTweets(tweets: any[], username: string) {
  try {
    if (!OPENAI_API_KEY) {
      console.log("No OpenAI API key found, returning generic summary");
      return `Summary of recent tweets from ${username}: Unable to generate AI summary (no API key).`;
    }
    
    // Prepare the tweets content for summarization
    const tweetTexts = tweets.map(t => t.text).join("\n\n");
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes tweets. Create a concise but informative summary.'
          },
          {
            role: 'user',
            content: `Please summarize these recent tweets from ${username}:\n\n${tweetTexts}`
          }
        ],
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      console.error("Unexpected OpenAI response format:", data);
      return `Summary of recent tweets from ${username}: Unable to generate AI summary.`;
    }
  } catch (error) {
    console.error("Error summarizing tweets:", error);
    return `Summary of recent tweets from ${username}: Unable to generate AI summary due to an error.`;
  }
}

// Function to send an email with the summary
async function sendEmail(email: string, summary: string, username: string) {
  try {
    const { data, error } = await fetch(`${SUPABASE_URL}/functions/v1/send-newsletters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        email,
        subject: `Tweet Summary for @${username}`,
        content: summary,
        forceSend: true
      })
    }).then(r => r.json());
    
    if (error) {
      throw new Error(error);
    }
    
    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Parse request body
    const { email, twitterSource } = await req.json()
    
    if (!email || !twitterSource) {
      return new Response(
        JSON.stringify({ error: 'Email and Twitter handle are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Clean Twitter handle (remove @ if present)
    const cleanTwitterHandle = twitterSource.startsWith('@') 
      ? twitterSource.substring(1) 
      : twitterSource
    
    console.log(`🔍 Running quick test for Twitter handle: ${cleanTwitterHandle}, email: ${email}`)
    
    let tweets = [];
    let usedMockData = false;
    
    try {
      // Try to fetch real tweets first
      console.log(`Attempting to fetch tweets from Rettiwt API at ${RETTIWT_API_URL}/fetch-tweets`);
      
      const fetchResponse = await fetch(`${RETTIWT_API_URL}/fetch-tweets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: cleanTwitterHandle, 
          email 
        }),
      });
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch tweets: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      
      const fetchData = await fetchResponse.json();
      console.log("[QUICK-TEST] Fetch tweets result:", JSON.stringify(fetchData, null, 2));
      
      tweets = fetchData.tweets || [];
      usedMockData = fetchData.usedMockData || false;
      
      console.log(`Successfully fetched ${tweets.length} tweets from Rettiwt API (${usedMockData ? 'mock data' : 'real data'})`);
      
      // Store tweets in Supabase if they were fetched successfully
      if (tweets.length > 0) {
        const { data: storedData, error: storeError } = await supabase
          .from('tweets')
          .upsert(tweets.map(tweet => ({
            username: cleanTwitterHandle,
            tweet_id: tweet.id || `gen-${Date.now()}-${Math.random()}`,
            text: tweet.text,
            created_at: tweet.created_at || new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            processed: false,
            email: email,
            is_mock: usedMockData
          })));
        
        if (storeError) {
          console.error("Error storing tweets in Supabase:", storeError);
        } else {
          console.log("Successfully stored tweets in Supabase");
        }
      }
    } catch (error) {
      console.error(`Error fetching real tweets: ${error.message}`);
      console.log("Falling back to mock tweets");
      
      // Fallback to mock tweets
      tweets = createMockTweets(cleanTwitterHandle, 5);
      usedMockData = true;
      
      // Store mock tweets in Supabase
      const { data: storedData, error: storeError } = await supabase
        .from('tweets')
        .upsert(tweets.map(tweet => ({
          username: cleanTwitterHandle,
          tweet_id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          fetched_at: new Date().toISOString(),
          processed: false,
          email: email,
          is_mock: true
        })));
      
      if (storeError) {
        console.error("Error storing mock tweets in Supabase:", storeError);
      } else {
        console.log("Successfully stored mock tweets in Supabase");
      }
    }
    
    if (tweets.length === 0) {
      return new Response(
        JSON.stringify({ error: "No tweets found or could be generated" }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Summarize the tweets
    console.log("Summarizing tweets...");
    const summary = await summarizeTweets(tweets, cleanTwitterHandle);
    
    // Send the email with the summary
    console.log("Sending email with summary...");
    const emailResult = await sendEmail(email, summary, cleanTwitterHandle);
    
    if (!emailResult.success) {
      throw new Error(`Failed to send email: ${emailResult.error}`);
    }
    
    return new Response(
      JSON.stringify({
        message: usedMockData 
          ? 'Quick test completed using mock data! Check your email for the summarized tweets.' 
          : 'Quick test successful! Check your email for the summarized tweets.',
        tweetCount: tweets.length,
        usedMockData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in quick-test function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred during quick test' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
