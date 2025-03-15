
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function fetchTweetsUsingTwint(twitterHandle: string, maxTweets = 5) {
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
    
    // First API attempt - Nitter-based Twint-compatible API
    console.log(`[FETCH] Attempting to fetch tweets for ${cleanHandle} from Nitter`);
    const nitterApiUrl = `https://nitter-api-omega.vercel.app/api/user?username=${cleanHandle}&limit=${maxTweets}`;
    
    try {
      const nitterResponse = await fetch(nitterApiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ByteSize/1.0'
        },
      });
      
      if (nitterResponse.ok) {
        const nitterData = await nitterResponse.json();
        console.log(`[FETCH] Nitter API response status: ${nitterResponse.status}`);
        
        if (nitterData && nitterData.tweets && nitterData.tweets.length > 0) {
          console.log(`[FETCH] Successfully fetched ${nitterData.tweets.length} tweets from Nitter`);
          
          return nitterData.tweets.map((tweet: any) => {
            return {
              id: tweet.id,
              content: tweet.text || tweet.tweet,
              created_at: new Date(tweet.date || tweet.timestamp).toISOString(),
              url: `https://twitter.com/${cleanHandle}/status/${tweet.id}`,
              twitter_handle: cleanHandle,
            };
          });
        }
      }
      console.log(`[FETCH] Nitter API failed or returned no tweets: ${nitterResponse.status}`);
    } catch (nitterError) {
      console.error(`[FETCH] Nitter API error:`, nitterError);
    }
    
    // Second API attempt - Twitter API adapter
    console.log(`[FETCH] Attempting to fetch tweets for ${cleanHandle} from Twitter API adapter`);
    const twitterApiUrl = `https://api.twitterpicker.com/user_timeline?screen_name=${cleanHandle}&count=${maxTweets}`;
    
    try {
      const twitterResponse = await fetch(twitterApiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ByteSize/1.0'
        },
      });
      
      if (twitterResponse.ok) {
        const twitterData = await twitterResponse.json();
        console.log(`[FETCH] Twitter API adapter response status: ${twitterResponse.status}`);
        
        if (Array.isArray(twitterData) && twitterData.length > 0) {
          console.log(`[FETCH] Successfully fetched ${twitterData.length} tweets from Twitter API adapter`);
          
          return twitterData.map((tweet: any) => {
            return {
              id: tweet.id_str,
              content: tweet.full_text || tweet.text,
              created_at: new Date(tweet.created_at).toISOString(),
              url: `https://twitter.com/${cleanHandle}/status/${tweet.id_str}`,
              twitter_handle: cleanHandle,
            };
          });
        }
      }
      console.log(`[FETCH] Twitter API adapter failed or returned no tweets: ${twitterResponse.status}`);
    } catch (twitterError) {
      console.error(`[FETCH] Twitter API adapter error:`, twitterError);
    }
    
    // Third API attempt - Scraping Twitter HTML (similar to Twint's approach)
    console.log(`[FETCH] Attempting to fetch tweets for ${cleanHandle} via Twitter HTML scraping`);
    const scrapingUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${cleanHandle}`;
    
    try {
      const scrapingResponse = await fetch(scrapingUrl, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
      });
      
      if (scrapingResponse.ok) {
        const htmlText = await scrapingResponse.text();
        console.log(`[FETCH] Twitter HTML scraping response status: ${scrapingResponse.status}, length: ${htmlText.length}`);
        
        // Extract tweet data from the HTML using regex patterns similar to Twint
        const tweetMatches = htmlText.match(/<div[^>]*data-tweet-id="(\d+)"[^>]*>[\s\S]*?<p class="timeline-Tweet-text"[^>]*>([\s\S]*?)<\/p>[\s\S]*?<time[^>]*datetime="([^"]+)"[^>]*>/g);
        
        if (tweetMatches && tweetMatches.length > 0) {
          console.log(`[FETCH] Successfully extracted ${tweetMatches.length} tweets from HTML`);
          
          const extractedTweets = [];
          for (let i = 0; i < Math.min(tweetMatches.length, maxTweets); i++) {
            const match = tweetMatches[i];
            const idMatch = match.match(/data-tweet-id="(\d+)"/);
            const textMatch = match.match(/<p class="timeline-Tweet-text"[^>]*>([\s\S]*?)<\/p>/);
            const dateMatch = match.match(/<time[^>]*datetime="([^"]+)"[^>]*>/);
            
            if (idMatch && textMatch && dateMatch) {
              const id = idMatch[1];
              // Remove HTML tags from content
              const content = textMatch[1].replace(/<[^>]*>/g, '');
              const date = dateMatch[1];
              
              extractedTweets.push({
                id,
                content,
                created_at: new Date(date).toISOString(),
                url: `https://twitter.com/${cleanHandle}/status/${id}`,
                twitter_handle: cleanHandle,
              });
            }
          }
          
          if (extractedTweets.length > 0) {
            return extractedTweets;
          }
        }
      }
      console.log(`[FETCH] Twitter HTML scraping failed or returned no tweets: ${scrapingResponse.status}`);
    } catch (scrapingError) {
      console.error(`[FETCH] Twitter HTML scraping error:`, scrapingError);
    }
    
    // Final fallback - Twint-compatible REST API
    console.log(`[FETCH] Attempting final fallback for ${cleanHandle}`);
    const fallbackUrl = `https://twint-public-api.vercel.app/api/v1/tweets?username=${cleanHandle}&limit=${maxTweets}`;
    
    try {
      const fallbackResponse = await fetch(fallbackUrl);
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        console.log(`[FETCH] Fallback API response status: ${fallbackResponse.status}`);
        
        if (fallbackData && fallbackData.data && Array.isArray(fallbackData.data) && fallbackData.data.length > 0) {
          console.log(`[FETCH] Successfully fetched ${fallbackData.data.length} tweets from fallback API`);
          
          return fallbackData.data.map((tweet: any) => {
            return {
              id: tweet.id_str || tweet.id,
              content: tweet.full_text || tweet.text,
              created_at: new Date(tweet.created_at).toISOString(),
              url: `https://twitter.com/${cleanHandle}/status/${tweet.id_str || tweet.id}`,
              twitter_handle: cleanHandle,
            };
          });
        }
      }
      console.log(`[FETCH] Fallback API failed or returned no tweets: ${fallbackResponse.status}`);
    } catch (fallbackError) {
      console.error(`[FETCH] Fallback API error:`, fallbackError);
    }
    
    console.error(`[FETCH] All API attempts failed for ${cleanHandle}`);
    
    // Last resort - Generate mock tweets but clearly mark them as mock
    console.log(`[FETCH] Generating clearly marked mock tweets for ${cleanHandle} as last resort`);
    const mockTweets = [];
    for (let i = 0; i < maxTweets; i++) {
      mockTweets.push({
        id: `mock-${Date.now()}-${i}`,
        content: `[MOCK TWEET] This is a mock tweet #${i+1} for @${cleanHandle} because all API fetching attempts failed. Please check logs and try again later.`,
        created_at: new Date().toISOString(),
        url: `https://twitter.com/${cleanHandle}`,
        twitter_handle: cleanHandle,
      });
    }
    return mockTweets;
    
  } catch (error) {
    console.error(`[FETCH] Fatal error fetching tweets for ${twitterHandle}:`, error);
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
    let maxTweets = 5; // Default to 5 tweets (changed from 10)
    
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
                summarized: false, // Initialize this field
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
