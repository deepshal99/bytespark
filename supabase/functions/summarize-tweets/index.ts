
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get unprocessed tweets grouped by subscriber
    const { data: subscribers, error: subscribersError } = await supabase
      .from("newsletter_subscriptions")
      .select("id, email, twitter_source");

    if (subscribersError) {
      console.error("Error fetching subscribers:", subscribersError);
      throw new Error("Failed to fetch subscribers");
    }
    
    const results = [];
    
    // Process each subscriber's tweets
    for (const subscriber of subscribers) {
      try {
        // Get unprocessed tweets for this subscriber
        const { data: unprocessedTweets, error: tweetsError } = await supabase
          .from("tweets")
          .select("*")
          .eq("subscriber_id", subscriber.id)
          .eq("processed", false)
          .order("tweet_date", { ascending: false });
        
        if (tweetsError) {
          console.error(`Error fetching tweets for subscriber ${subscriber.id}:`, tweetsError);
          continue;
        }
        
        if (!unprocessedTweets || unprocessedTweets.length === 0) {
          console.log(`No unprocessed tweets for subscriber ${subscriber.id}`);
          continue;
        }
        
        console.log(`Found ${unprocessedTweets.length} unprocessed tweets for subscriber ${subscriber.id}`);
        
        // Prepare tweets for summarization
        const tweetTexts = unprocessedTweets.map(tweet => 
          `Tweet from @${tweet.username}: "${tweet.content}"`
        ).join("\n\n");
        
        // Get username for context
        let username = subscriber.twitter_source;
        if (username.includes("twitter.com/") || username.includes("x.com/")) {
          const urlParts = username.split("/");
          username = urlParts[urlParts.length - 1].split("?")[0];
        }
        
        // Call OpenAI API to summarize tweets
        const promptText = `
Summarize the following tweets from Twitter user @${username} into a concise, engaging newsletter section.
Highlight the most interesting insights, announcements, or thoughts.
Format the summary in a way that would be engaging to read in an email newsletter.
Include a compelling headline about this Twitter user's recent activity.

Tweets to summarize:
${tweetTexts}

Your summary should be about 2-3 paragraphs long, be informative yet conversational in tone,
and capture the essence of what makes these tweets valuable to the reader.
`;

        const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a skilled newsletter writer who can distill Twitter content into valuable insights."
              },
              {
                role: "user",
                content: promptText
              }
            ],
            temperature: 0.7,
          })
        });
        
        const openAIData = await openAIResponse.json();
        
        if (!openAIData.choices || openAIData.choices.length === 0) {
          console.error("Invalid response from OpenAI:", openAIData);
          throw new Error("Failed to generate summary");
        }
        
        const summary = openAIData.choices[0].message.content;
        
        // Store summary in database
        const { data: summaryData, error: summaryError } = await supabase
          .from("tweet_summaries")
          .insert({
            subscriber_id: subscriber.id,
            username,
            summary,
            tweet_count: unprocessedTweets.length,
            sent: false,
            created_at: new Date().toISOString()
          })
          .select();
        
        if (summaryError) {
          console.error(`Error storing summary for subscriber ${subscriber.id}:`, summaryError);
          throw new Error("Failed to store summary");
        }
        
        // Mark tweets as processed
        const tweetIds = unprocessedTweets.map(tweet => tweet.id);
        const { error: updateError } = await supabase
          .from("tweets")
          .update({ processed: true, summary_id: summaryData[0].id })
          .in("id", tweetIds);
        
        if (updateError) {
          console.error(`Error marking tweets as processed for subscriber ${subscriber.id}:`, updateError);
        }
        
        results.push({
          subscriber_id: subscriber.id,
          username,
          tweets_processed: unprocessedTweets.length,
          summary_id: summaryData[0].id,
          success: true
        });
        
      } catch (error) {
        console.error(`Error processing tweets for subscriber ${subscriber.id}:`, error);
        results.push({
          subscriber_id: subscriber.id,
          error: error.message,
          success: false
        });
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed tweets for ${results.length} subscribers`, 
        results 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("Error in summarize-tweets function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
