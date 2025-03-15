
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function fetchTweetsUsingTwint(twitterHandle: string, maxTweets = 10) {
  try {
    console.log(`[FETCH] Starting to fetch tweets for ${twitterHandle}`);
    
    // Clean up the Twitter handle
    let cleanHandle = twitterHandle;
    if (cleanHandle.startsWith("@")) {
      cleanHandle = cleanHandle.substring(1);
    }
    // If it's a URL, extract just the username
    if (cleanHandle.includes("twitter.com/") || cleanHandle.includes("x.com/")) {
      const matches = cleanHandle.match(/(?:twitter\.com|x\.com)\/([^/?\s]+)/);
      if (matches && matches[1]) {
        cleanHandle = matches[1];
      }
    } else if (cleanHandle.includes("/")) {
      // If it has slashes but isn't clearly a URL, just take the first part
      cleanHandle = cleanHandle.split("/")[0];
    }
    
    console.log(`[FETCH] Cleaned Twitter handle: ${cleanHandle}`);
    
    // Fetch tweets using Twint web service
    // Using twintproject's API endpoint or a compatible alternative
    const apiUrl = `https://twintapi.vercel.app/api/tweets?username=${cleanHandle}&limit=${maxTweets}`;
    console.log(`[FETCH] Fetching tweets from API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[FETCH] Failed to fetch tweets: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error(`[FETCH] Error response body: ${errorBody}`);
      
      // Try alternative Twint API endpoint if the first one fails
      const alternativeApiUrl = `https://twint-api.vercel.app/api/tweets?username=${cleanHandle}&limit=${maxTweets}`;
      console.log(`[FETCH] Trying alternative API endpoint: ${alternativeApiUrl}`);
      
      const alternativeResponse = await fetch(alternativeApiUrl);
      
      if (!alternativeResponse.ok) {
        console.error(`[FETCH] Alternative API also failed: ${alternativeResponse.status}`);
        throw new Error(`Failed to fetch tweets from both API endpoints`);
      }
      
      const alternativeTweetsData = await alternativeResponse.json();
      console.log(`[FETCH] Alternative API response:`, alternativeTweetsData);
      
      if (!alternativeTweetsData.tweets || alternativeTweetsData.tweets.length === 0) {
        console.log(`[FETCH] No tweets found for ${cleanHandle} from alternative API`);
        return [];
      }
      
      // Format the tweets from the alternative API
      return alternativeTweetsData.tweets.map((tweet: any) => {
        return {
          id: tweet.id,
          content: tweet.tweet,
          created_at: new Date(tweet.date).toISOString(),
          url: `https://twitter.com/${cleanHandle}/status/${tweet.id}`,
          twitter_handle: cleanHandle,
        };
      });
    }
    
    const tweetsData = await response.json();
    console.log(`[FETCH] Raw Twint response:`, tweetsData);
    
    if (!tweetsData.tweets || tweetsData.tweets.length === 0) {
      console.log(`[FETCH] No tweets found for ${cleanHandle}`);
      return [];
    }
    
    // Format the tweets into our database structure
    const tweets = tweetsData.tweets.map((tweet: any) => {
      return {
        id: tweet.id,
        content: tweet.tweet,
        created_at: new Date(tweet.date).toISOString(),
        url: `https://twitter.com/${cleanHandle}/status/${tweet.id}`,
        twitter_handle: cleanHandle,
      };
    });
    
    console.log(`[FETCH] Successfully extracted ${tweets.length} tweets for ${cleanHandle}`);
    return tweets;
  } catch (error) {
    console.error(`[FETCH] Error fetching tweets for ${twitterHandle}:`, error);
    
    // As a last resort, try a third API endpoint
    try {
      console.log(`[FETCH] Attempting final fallback API for ${twitterHandle}`);
      const finalFallbackUrl = `https://twint-public-api.vercel.app/api/v1/tweets?username=${twitterHandle.replace('@', '')}&limit=${maxTweets}`;
      
      const finalResponse = await fetch(finalFallbackUrl);
      if (!finalResponse.ok) {
        throw new Error(`Final API also failed: ${finalResponse.status}`);
      }
      
      const finalData = await finalResponse.json();
      
      if (!finalData.data || !Array.isArray(finalData.data) || finalData.data.length === 0) {
        throw new Error("No tweets in final API response");
      }
      
      console.log(`[FETCH] Final API successful with ${finalData.data.length} tweets`);
      
      return finalData.data.map((tweet: any) => {
        return {
          id: tweet.id_str || tweet.id,
          content: tweet.full_text || tweet.text,
          created_at: new Date(tweet.created_at).toISOString(),
          url: `https://twitter.com/${twitterHandle.replace('@', '')}/status/${tweet.id_str || tweet.id}`,
          twitter_handle: twitterHandle.replace('@', ''),
        };
      });
    } catch (finalError) {
      console.error(`[FETCH] All API attempts failed for ${twitterHandle}:`, finalError);
      throw error; // Throw the original error
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[FETCH] Starting fetch-tweets function");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[FETCH] Missing Supabase credentials");
      throw new Error("Missing Supabase credentials");
    }
    
    console.log("[FETCH] Creating Supabase client");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active subscriptions from the database
    console.log("[FETCH] Fetching active subscriptions");
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("newsletter_subscriptions")
      .select("*")
      .eq("active", true);
    
    if (subscriptionError) {
      console.error("[FETCH] Failed to fetch subscriptions:", subscriptionError);
      throw new Error(`Failed to fetch subscriptions: ${subscriptionError.message}`);
    }
    
    console.log(`[FETCH] Found ${subscriptions.length} active subscriptions`);
    
    // Parse request body for test mode and targetEmail
    let isTest = false;
    let targetEmail = null;
    let maxTweets = 10; // Default number of tweets to fetch
    
    try {
      const body = await req.json();
      console.log("[FETCH] Request body:", body);
      isTest = body.test === true;
      targetEmail = body.targetEmail || body.email || null;
      
      // Allow specifying the number of tweets to fetch
      if (body.maxTweets && !isNaN(body.maxTweets)) {
        maxTweets = parseInt(body.maxTweets);
      }
    } catch (e) {
      // If there's no body, or it's not valid JSON, just proceed normally
      console.log("[FETCH] No valid JSON in request body, using default settings");
    }
    
    // Filter subscriptions based on targetEmail if provided
    let filteredSubscriptions = subscriptions;
    if (targetEmail) {
      console.log(`[FETCH] Filtering subscriptions for email: ${targetEmail}`);
      filteredSubscriptions = subscriptions.filter(sub => sub.email === targetEmail);
      console.log(`[FETCH] Filtered to ${filteredSubscriptions.length} subscriptions`);
    }
    
    // Group subscriptions by Twitter handle to avoid duplicate fetches
    const twitterHandleSet = new Set<string>();
    filteredSubscriptions.forEach(sub => {
      if (sub.twitter_source) {
        // Add the twitter handle as is
        twitterHandleSet.add(sub.twitter_source.trim());
      }
    });
    
    const twitterHandles = Array.from(twitterHandleSet);
    console.log(`[FETCH] Unique Twitter handles to fetch: ${twitterHandles.join(', ')}`);
    
    const fetchResults = [];
    
    // Fetch tweets for each unique Twitter handle
    for (const handle of twitterHandles) {
      try {
        console.log(`[FETCH] Processing Twitter handle: ${handle}`);
        const tweets = await fetchTweetsUsingTwint(handle, maxTweets);
        
        if (tweets.length > 0) {
          // Store tweets in the database
          console.log(`[FETCH] Storing ${tweets.length} tweets for ${handle}`);
          const { data: storedTweets, error: storageError } = await supabase
            .from("tweets")
            .upsert(
              tweets.map(tweet => ({
                tweet_id: tweet.id,
                content: tweet.content,
                created_at: tweet.created_at,
                url: tweet.url,
                twitter_handle: handle.replace('@', ''), // Ensure clean handle in database
                fetched_at: new Date().toISOString(),
                summarized: false, // Make sure to initialize this field
              })),
              { onConflict: "tweet_id" }
            );
            
          if (storageError) {
            console.error(`[FETCH] Error storing tweets for ${handle}:`, storageError);
            fetchResults.push({
              handle,
              success: false,
              error: storageError.message,
              tweets_count: 0
            });
          } else {
            console.log(`[FETCH] Successfully stored ${tweets.length} tweets for ${handle}`);
            fetchResults.push({
              handle,
              success: true,
              tweets_count: tweets.length
            });
          }
        } else {
          console.log(`[FETCH] No tweets found for ${handle}`);
          fetchResults.push({
            handle,
            success: true,
            tweets_count: 0
          });
        }
      } catch (error) {
        console.error(`[FETCH] Error processing ${handle}:`, error);
        fetchResults.push({
          handle,
          success: false,
          error: error.message,
          tweets_count: 0
        });
      }
    }
    
    console.log("[FETCH] Completed fetch-tweets function");
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Tweets fetched and stored successfully",
        results: fetchResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("[FETCH] Error in fetch-tweets function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "An unexpected error occurred",
        message: "Failed to fetch tweets, please try again later"
      }),
      {
        status: 200, // Return 200 even for errors to prevent function failures
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
