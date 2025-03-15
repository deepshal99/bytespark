
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get all active subscribers
    const { data: subscribers, error: subscribersError } = await supabase
      .from("newsletter_subscriptions")
      .select("*");

    if (subscribersError) {
      console.error("Error fetching subscribers:", subscribersError);
      throw new Error("Failed to fetch subscribers");
    }

    console.log(`Processing ${subscribers.length} subscribers`);
    
    const results = [];
    
    // Process each subscriber
    for (const subscriber of subscribers) {
      try {
        const twitterSource = subscriber.twitter_source;
        let username = twitterSource;
        
        // Extract username from URL if needed
        if (twitterSource.includes("twitter.com/") || twitterSource.includes("x.com/")) {
          const urlParts = twitterSource.split("/");
          username = urlParts[urlParts.length - 1].split("?")[0];
        }
        
        console.log(`Fetching tweets for username: ${username}`);
        
        // Fetch tweets using Nitter
        const nitterUrl = `https://nitter.net/${username}`;
        const response = await fetch(nitterUrl);
        const html = await response.text();
        
        // Parse HTML
        const document = new DOMParser().parseFromString(html, "text/html");
        if (!document) {
          throw new Error("Failed to parse HTML");
        }
        
        // Extract tweets
        const tweetElements = document.querySelectorAll(".timeline-item");
        const tweets = [];
        
        // Only process up to 5 recent tweets to avoid overloading
        const maxTweets = Math.min(5, tweetElements.length);
        
        for (let i = 0; i < maxTweets; i++) {
          const tweetElement = tweetElements[i];
          
          // Skip if not a tweet element
          if (!tweetElement) continue;
          
          // Check if it's a retweet or reply (we can skip these)
          const isRetweet = tweetElement.querySelector(".retweet-header");
          const isReply = tweetElement.querySelector(".replying-to");
          if (isRetweet || isReply) continue;
          
          // Extract tweet content
          const contentElement = tweetElement.querySelector(".tweet-content");
          if (!contentElement) continue;
          
          const tweetContent = contentElement.textContent.trim();
          
          // Extract tweet date
          const timeElement = tweetElement.querySelector(".tweet-date a");
          const tweetDate = timeElement ? timeElement.getAttribute("title") : "";
          
          // Extract tweet ID
          const tweetUrl = timeElement ? timeElement.getAttribute("href") : "";
          const tweetId = tweetUrl ? tweetUrl.split("/").pop() : "";
          
          tweets.push({
            id: tweetId,
            username,
            content: tweetContent,
            date: tweetDate,
            source_url: `https://twitter.com/${username}/status/${tweetId}`
          });
        }
        
        // Check if we found any tweets
        if (tweets.length === 0) {
          console.log(`No new tweets found for ${username}`);
          continue;
        }
        
        console.log(`Found ${tweets.length} tweets for ${username}`);
        
        // Store tweets in database
        for (const tweet of tweets) {
          // Check if tweet already exists in database
          const { data: existingTweet } = await supabase
            .from("tweets")
            .select("id")
            .eq("tweet_id", tweet.id)
            .single();
            
          if (existingTweet) {
            console.log(`Tweet ${tweet.id} already exists, skipping`);
            continue;
          }
          
          // Insert new tweet
          const { error: insertError } = await supabase
            .from("tweets")
            .insert({
              tweet_id: tweet.id,
              username: tweet.username,
              content: tweet.content,
              tweet_date: tweet.date,
              source_url: tweet.source_url,
              subscriber_id: subscriber.id,
              processed: false
            });
            
          if (insertError) {
            console.error(`Error storing tweet ${tweet.id}:`, insertError);
          } else {
            console.log(`Successfully stored tweet ${tweet.id}`);
          }
        }
        
        results.push({
          username,
          tweets_fetched: tweets.length,
          success: true
        });
        
      } catch (error) {
        console.error(`Error processing subscriber ${subscriber.email}:`, error);
        results.push({
          username: subscriber.twitter_source,
          error: error.message,
          success: false
        });
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${subscribers.length} subscribers`, 
        results 
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
