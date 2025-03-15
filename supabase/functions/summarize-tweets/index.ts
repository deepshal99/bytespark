
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { OpenAI } from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

async function summarizeTweets(tweets: any[], twitterHandle: string): Promise<string> {
  try {
    if (tweets.length === 0) {
      return "No tweets to summarize.";
    }

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Format tweets for the prompt
    const tweetContent = tweets.map((tweet, index) => {
      return `Tweet ${index + 1}: ${tweet.content}\n`;
    }).join("\n");

    const prompt = `
    Summarize the following tweets by ${twitterHandle} into a cohesive newsletter section. 
    Focus on the main themes, insights, and valuable information. 
    Make it engaging and insightful, like a well-written newsletter.
    Format it in a way that's easy to read with bullet points where appropriate.
    Keep the tone conversational but professional.
    
    Tweets:
    ${tweetContent}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert newsletter curator who creates insightful and engaging summaries of tweets."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content || "No summary could be generated.";
  } catch (error) {
    console.error("Error summarizing tweets:", error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all unique Twitter handles that have tweets
    const { data: twitterHandles, error: handlesError } = await supabase
      .from("tweets")
      .select("twitter_handle")
      .is("summarized", null)  // Only get tweets that haven't been summarized yet
      .order("created_at", { ascending: false })
      .limit(100);

    if (handlesError) {
      throw new Error(`Failed to fetch Twitter handles: ${handlesError.message}`);
    }

    // Extract unique Twitter handles
    const uniqueHandles = [...new Set(twitterHandles.map(item => item.twitter_handle))];
    console.log(`Found ${uniqueHandles.length} unique Twitter handles to summarize`);

    const summaryResults = [];

    // Process each Twitter handle
    for (const handle of uniqueHandles) {
      try {
        console.log(`Summarizing tweets for ${handle}`);

        // Get the latest tweets for this handle that haven't been summarized
        const { data: tweets, error: tweetsError } = await supabase
          .from("tweets")
          .select("*")
          .eq("twitter_handle", handle)
          .is("summarized", null)
          .order("created_at", { ascending: false })
          .limit(10);

        if (tweetsError) {
          throw new Error(`Failed to fetch tweets for ${handle}: ${tweetsError.message}`);
        }

        if (tweets.length === 0) {
          console.log(`No new tweets found for ${handle}`);
          continue;
        }

        // Summarize tweets
        const summary = await summarizeTweets(tweets, handle);

        // Store the summary
        const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
        const { data: storedSummary, error: summaryError } = await supabase
          .from("tweet_summaries")
          .upsert({
            twitter_handle: handle,
            summary_date: currentDate,
            content: summary,
            created_at: new Date().toISOString(),
          }, { onConflict: "twitter_handle,summary_date" });

        if (summaryError) {
          throw new Error(`Failed to store summary for ${handle}: ${summaryError.message}`);
        }

        // Mark tweets as summarized
        const tweetIds = tweets.map(tweet => tweet.id);
        const { error: updateError } = await supabase
          .from("tweets")
          .update({ summarized: true })
          .in("id", tweetIds);

        if (updateError) {
          throw new Error(`Failed to update tweets as summarized for ${handle}: ${updateError.message}`);
        }

        summaryResults.push({
          handle,
          success: true,
          tweets_count: tweets.length,
        });

        console.log(`Successfully summarized ${tweets.length} tweets for ${handle}`);
      } catch (error) {
        console.error(`Error summarizing tweets for ${handle}:`, error);
        summaryResults.push({
          handle,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Tweets summarized successfully",
        results: summaryResults,
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
