
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Base URL for Nitter instance - try alternative instances if the primary one fails
const NITTER_INSTANCES = [
  "https://nitter.net",
  "https://nitter.lacontrevoie.fr",
  "https://nitter.1d4.us",
  "https://nitter.kavin.rocks",
  "https://nitter.unixfox.eu"
];

async function fetchTweetsFromNitter(twitterHandle: string, maxTweets = 10) {
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
    
    // Try different Nitter instances until one works
    let success = false;
    let document = null;
    let usedInstance = "";
    
    for (const instance of NITTER_INSTANCES) {
      try {
        console.log(`[FETCH] Trying Nitter instance: ${instance}`);
        const url = `${instance}/${cleanHandle}`;
        console.log(`[FETCH] Fetching from URL: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`[FETCH] Failed to fetch from ${instance}: ${response.status} ${response.statusText}`);
          continue;
        }
        
        console.log(`[FETCH] Got response from ${instance}, parsing HTML`);
        const htmlContent = await response.text();
        
        if (htmlContent.includes("user not found") || htmlContent.includes("User not found")) {
          console.error(`[FETCH] Twitter user not found on ${instance}: ${cleanHandle}`);
          continue;
        }
        
        const parser = new DOMParser();
        document = parser.parseFromString(htmlContent, "text/html");
        
        if (!document) {
          console.error(`[FETCH] Failed to parse HTML content from ${instance}`);
          continue;
        }
        
        success = true;
        usedInstance = instance;
        break;
        
      } catch (instanceError) {
        console.error(`[FETCH] Error with Nitter instance ${instance}:`, instanceError);
        // Continue to next instance
      }
    }
    
    if (!success || !document) {
      throw new Error(`Failed to fetch tweets from any Nitter instance for handle: ${cleanHandle}`);
    }
    
    console.log(`[FETCH] Successfully connected to Nitter instance: ${usedInstance}`);
    
    const tweetElements = document.querySelectorAll(".timeline-item:not(.thread)");
    console.log(`[FETCH] Found ${tweetElements.length} tweet elements for ${cleanHandle}`);
    
    if (tweetElements.length === 0) {
      console.log(`[FETCH] Timeline DOM structure:`, document.querySelector(".timeline")?.innerHTML || "No timeline found");
    }
    
    const tweets = [];
    
    for (let i = 0; i < Math.min(tweetElements.length, maxTweets); i++) {
      const tweetElement = tweetElements[i];
      
      // Check if it's a retweet or a reply (we can skip these if needed)
      const isRetweet = tweetElement.querySelector(".retweet-header") !== null;
      const isReply = tweetElement.querySelector(".replying-to") !== null;
      
      // Skip retweets and replies if necessary
      if (isRetweet || isReply) {
        console.log(`[FETCH] Skipping retweet or reply (${i+1}/${tweetElements.length})`);
        continue;
      }
      
      const contentElement = tweetElement.querySelector(".tweet-content");
      const dateElement = tweetElement.querySelector(".tweet-date a");
      const linkElement = tweetElement.querySelector(".tweet-link");
      
      if (contentElement && dateElement && linkElement) {
        const content = contentElement.textContent.trim();
        const dateStr = dateElement.getAttribute("title") || "";
        const tweetId = linkElement.getAttribute("href")?.split("/").pop() || "";
        const tweetUrl = `https://twitter.com${linkElement.getAttribute("href")}`;
        
        tweets.push({
          id: tweetId,
          content,
          created_at: new Date(dateStr).toISOString(),
          url: tweetUrl,
          twitter_handle: cleanHandle,
        });
        
        console.log(`[FETCH] Processed tweet ${tweets.length}: ID=${tweetId.substring(0, 8)}...`);
      } else {
        console.log(`[FETCH] Could not extract tweet data at index ${i}`);
        if (!contentElement) console.log(`[FETCH] Missing content element`);
        if (!dateElement) console.log(`[FETCH] Missing date element`);
        if (!linkElement) console.log(`[FETCH] Missing link element`);
      }
    }
    
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
        const tweets = await fetchTweetsFromNitter(handle);
        
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
