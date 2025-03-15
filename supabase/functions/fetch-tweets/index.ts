
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Twitter API configuration
const BEARER_TOKEN = Deno.env.get("TWITTER_BEARER_TOKEN") || "";

async function fetchTweetsFromTwitterAPI(twitterHandle: string, maxTweets = 10) {
  try {
    console.log(`[FETCH] Starting to fetch tweets for ${twitterHandle}`);
    
    // Clean up the Twitter handle - remove URL components if present
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
    
    if (!BEARER_TOKEN) {
      console.error("[FETCH] Missing Twitter API Bearer Token");
      throw new Error("Twitter API configuration is incomplete. Please add TWITTER_BEARER_TOKEN to the environment variables.");
    }
    
    // Using Twitter API v2 to fetch recent tweets
    const url = `https://api.twitter.com/2/users/by/username/${cleanHandle}`;
    console.log(`[FETCH] Fetching user ID from URL: ${url}`);
    
    // First, get the user ID from the username
    const userResponse = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${BEARER_TOKEN}`
      }
    });
    
    if (!userResponse.ok) {
      console.error(`[FETCH] Failed to fetch user data: ${userResponse.status} ${userResponse.statusText}`);
      const errorBody = await userResponse.text();
      console.error(`[FETCH] Error response body: ${errorBody}`);
      throw new Error(`Twitter API error: ${userResponse.status} - ${errorBody}`);
    }
    
    const userData = await userResponse.json();
    console.log(`[FETCH] User data:`, userData);
    
    if (!userData.data || !userData.data.id) {
      console.error(`[FETCH] User not found or invalid response:`, userData);
      throw new Error(`Could not find Twitter user with handle: ${cleanHandle}`);
    }
    
    const userId = userData.data.id;
    console.log(`[FETCH] Found user ID: ${userId} for handle: ${cleanHandle}`);
    
    // Now fetch the user's recent tweets
    const tweetsUrl = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxTweets}&tweet.fields=created_at,text&exclude=retweets,replies`;
    console.log(`[FETCH] Fetching tweets from URL: ${tweetsUrl}`);
    
    const tweetsResponse = await fetch(tweetsUrl, {
      headers: {
        "Authorization": `Bearer ${BEARER_TOKEN}`
      }
    });
    
    if (!tweetsResponse.ok) {
      console.error(`[FETCH] Failed to fetch tweets: ${tweetsResponse.status} ${tweetsResponse.statusText}`);
      const errorBody = await tweetsResponse.text();
      console.error(`[FETCH] Error response body: ${errorBody}`);
      throw new Error(`Twitter API error: ${tweetsResponse.status} - ${errorBody}`);
    }
    
    const tweetsData = await tweetsResponse.json();
    console.log(`[FETCH] Retrieved ${tweetsData.data?.length || 0} tweets`);
    
    if (!tweetsData.data || tweetsData.data.length === 0) {
      console.log(`[FETCH] No tweets found for ${cleanHandle}`);
      return [];
    }
    
    // Format the tweets into our database structure
    const tweets = tweetsData.data.map((tweet: any) => {
      return {
        id: tweet.id,
        content: tweet.text,
        created_at: tweet.created_at,
        url: `https://twitter.com/${cleanHandle}/status/${tweet.id}`,
        twitter_handle: cleanHandle,
      };
    });
    
    console.log(`[FETCH] Successfully extracted ${tweets.length} tweets for ${cleanHandle}`);
    return tweets;
  } catch (error) {
    console.error(`[FETCH] Error fetching tweets for ${twitterHandle}:`, error);
    throw error;
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
    
    try {
      const body = await req.json();
      console.log("[FETCH] Request body:", body);
      isTest = body.test === true;
      targetEmail = body.targetEmail || body.email || null;
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
        const tweets = await fetchTweetsFromTwitterAPI(handle);
        
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
                twitter_handle: handle,
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
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
