
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

// Base URL for Nitter instance
const NITTER_BASE_URL = "https://nitter.net";

async function fetchTweetsFromNitter(twitterHandle: string, maxTweets = 10) {
  try {
    console.log(`Fetching tweets for ${twitterHandle} from Nitter`);
    const response = await fetch(`${NITTER_BASE_URL}/${twitterHandle}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tweets: ${response.status} ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    const parser = new DOMParser();
    const document = parser.parseFromString(htmlContent, "text/html");
    
    if (!document) {
      throw new Error("Failed to parse HTML content");
    }
    
    const tweetElements = document.querySelectorAll(".timeline-item:not(.thread)");
    const tweets = [];
    
    for (let i = 0; i < Math.min(tweetElements.length, maxTweets); i++) {
      const tweetElement = tweetElements[i];
      
      // Check if it's a retweet or a reply (we can skip these if needed)
      const isRetweet = tweetElement.querySelector(".retweet-header") !== null;
      const isReply = tweetElement.querySelector(".replying-to") !== null;
      
      // Skip retweets and replies if necessary
      if (isRetweet || isReply) {
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
          twitter_handle: twitterHandle,
        });
      }
    }
    
    return tweets;
  } catch (error) {
    console.error(`Error fetching tweets for ${twitterHandle}:`, error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active subscriptions from the database
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("newsletter_subscriptions")
      .select("*")
      .eq("active", true);
    
    if (subscriptionError) {
      throw new Error(`Failed to fetch subscriptions: ${subscriptionError.message}`);
    }
    
    console.log(`Found ${subscriptions.length} active subscriptions`);
    
    // Group subscriptions by Twitter handle to avoid duplicate fetches
    const twitterHandleSet = new Set<string>();
    subscriptions.forEach(sub => {
      if (sub.twitter_source) {
        // Remove @ symbol if present and trim
        const handle = sub.twitter_source.replace('@', '').trim();
        twitterHandleSet.add(handle);
      }
    });
    
    const twitterHandles = Array.from(twitterHandleSet);
    console.log(`Unique Twitter handles to fetch: ${twitterHandles.length}`);
    
    const fetchResults = [];
    
    // Fetch tweets for each unique Twitter handle
    for (const handle of twitterHandles) {
      try {
        console.log(`Processing Twitter handle: ${handle}`);
        const tweets = await fetchTweetsFromNitter(handle);
        
        if (tweets.length > 0) {
          // Store tweets in the database
          const { data: storedTweets, error: storageError } = await supabase
            .from("tweets")
            .upsert(
              tweets.map(tweet => ({
                tweet_id: tweet.id,
                content: tweet.content,
                created_at: tweet.created_at,
                url: tweet.url,
                twitter_handle: tweet.twitter_handle,
                fetched_at: new Date().toISOString(),
              })),
              { onConflict: "tweet_id" }
            );
            
          if (storageError) {
            console.error(`Error storing tweets for ${handle}:`, storageError);
            fetchResults.push({
              handle,
              success: false,
              error: storageError.message,
              tweets_count: 0
            });
          } else {
            console.log(`Successfully stored ${tweets.length} tweets for ${handle}`);
            fetchResults.push({
              handle,
              success: true,
              tweets_count: tweets.length
            });
          }
        } else {
          console.log(`No tweets found for ${handle}`);
          fetchResults.push({
            handle,
            success: true,
            tweets_count: 0
          });
        }
      } catch (error) {
        console.error(`Error processing ${handle}:`, error);
        fetchResults.push({
          handle,
          success: false,
          error: error.message,
          tweets_count: 0
        });
      }
    }
    
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
    console.error("Error in fetch-tweets function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
