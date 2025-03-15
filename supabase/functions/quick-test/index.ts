
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { OpenAI } from "https://esm.sh/openai@4.20.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function fetchTweetsUsingTwint(twitterHandle: string, maxTweets = 5) {
  try {
    console.log(`[QUICK-TEST] Starting to fetch tweets for ${twitterHandle}`);
    
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
    
    console.log(`[QUICK-TEST] Cleaned Twitter handle: ${cleanHandle}`);
    
    // Fetch tweets using Twint web scraping
    const apiUrl = `https://twintapp.vercel.app/api/twint?username=${cleanHandle}&limit=${maxTweets}`;
    console.log(`[QUICK-TEST] Fetching tweets from Twint API: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`[QUICK-TEST] Failed to fetch tweets: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error(`[QUICK-TEST] Error response body: ${errorBody}`);
      throw new Error(`Twint API error: ${response.status} - ${errorBody}`);
    }
    
    const tweetsData = await response.json();
    console.log(`[QUICK-TEST] Raw Twint response:`, tweetsData);
    
    if (!tweetsData.tweets || tweetsData.tweets.length === 0) {
      console.log(`[QUICK-TEST] No tweets found for ${cleanHandle}`);
      return { tweets: [], twitterHandle: cleanHandle };
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
    
    console.log(`[QUICK-TEST] Successfully extracted ${tweets.length} tweets for ${cleanHandle}`);
    return { tweets, twitterHandle: cleanHandle };
  } catch (error) {
    console.error(`[QUICK-TEST] Error fetching tweets for ${twitterHandle}:`, error);
    throw error;
  }
}

async function summarizeTweets(tweets: any[], twitterHandle: string): Promise<string> {
  try {
    if (tweets.length === 0) {
      console.log(`[QUICK-TEST] No tweets to summarize for ${twitterHandle}`);
      return "No tweets to summarize.";
    }

    console.log(`[QUICK-TEST] Initializing OpenAI client for ${twitterHandle}`);
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Format tweets for the prompt
    const tweetContent = tweets.map((tweet, index) => {
      return `Tweet ${index + 1}: ${tweet.content}\n`;
    }).join("\n");

    console.log(`[QUICK-TEST] Prepared ${tweets.length} tweets for summarization, total character length: ${tweetContent.length}`);

    const prompt = `
    Summarize the following tweets by ${twitterHandle} into a cohesive newsletter section. 
    Focus on the main themes, insights, and valuable information. 
    Make it engaging and insightful, like a well-written newsletter.
    Format it in a way that's easy to read with bullet points where appropriate.
    Keep the tone conversational but professional.
    
    Tweets:
    ${tweetContent}
    `;

    console.log(`[QUICK-TEST] Sending request to OpenAI for ${twitterHandle}`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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

    console.log(`[QUICK-TEST] Received response from OpenAI for ${twitterHandle}`);
    const summaryContent = response.choices[0].message.content || "No summary could be generated.";
    console.log(`[QUICK-TEST] Summary generated for ${twitterHandle}, length: ${summaryContent.length} chars`);
    
    return summaryContent;
  } catch (error) {
    console.error(`[QUICK-TEST] Error summarizing tweets for ${twitterHandle}:`, error);
    throw error;
  }
}

async function sendNewsletter(email: string, twitterHandle: string, summary: string): Promise<void> {
  try {
    console.log(`[QUICK-TEST] Preparing to send newsletter to ${email} for ${twitterHandle}`);
    
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not set");
    }
    
    const resend = new Resend(RESEND_API_KEY);
    
    // Format the date nicely
    const formattedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    console.log(`[QUICK-TEST] Sending email to ${email}`);
    
    const emailResponse = await resend.emails.send({
      from: "ByteSize <onboarding@resend.dev>",
      to: [email],
      subject: `[QUICK TEST] ByteSize Newsletter: ${twitterHandle} Updates - ${formattedDate}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">ByteSize Newsletter</h1>
          <h2 style="color: #333;">Latest from @${twitterHandle}</h2>
          <p style="color: #666;">${formattedDate}</p>
          
          <div style="margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
            <div>${summary.replace(/\n/g, '<br>')}</div>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="https://twitter.com/${twitterHandle}" style="color: #4F46E5; text-decoration: none;">Follow @${twitterHandle} on Twitter</a>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666;">
            <p>ByteSize - Your Twitter Feed, Curated & Summarized</p>
            <p>This is a QUICK TEST result. If you like it, please subscribe to our regular newsletters.</p>
          </div>
        </div>
      `,
    });
    
    console.log(`[QUICK-TEST] Email sent to ${email}:`, emailResponse);
    
  } catch (error) {
    console.error(`[QUICK-TEST] Error sending newsletter to ${email}:`, error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[QUICK-TEST] Starting quick-test function");
    
    if (!OPENAI_API_KEY) {
      console.error("[QUICK-TEST] OPENAI_API_KEY environment variable not set");
      throw new Error("OPENAI_API_KEY environment variable not set");
    }
    
    if (!RESEND_API_KEY) {
      console.error("[QUICK-TEST] RESEND_API_KEY environment variable not set");
      throw new Error("RESEND_API_KEY environment variable not set");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[QUICK-TEST] Missing Supabase credentials");
      throw new Error("Missing Supabase credentials");
    }
    
    console.log("[QUICK-TEST] Creating Supabase client");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get parameters from request
    const { email, twitterHandle } = await req.json();
    
    if (!email || !twitterHandle) {
      console.error("[QUICK-TEST] Missing required parameters");
      throw new Error("Missing required parameters: email and twitterHandle");
    }
    
    console.log(`[QUICK-TEST] Processing quick test for email: ${email}, Twitter handle: ${twitterHandle}`);
    
    // Step 1: Fetch the latest tweets
    console.log("[QUICK-TEST] Step 1: Fetching tweets");
    const { tweets, twitterHandle: cleanedHandle } = await fetchTweetsUsingTwint(twitterHandle);
    
    if (tweets.length === 0) {
      throw new Error(`No tweets found for ${twitterHandle}`);
    }
    
    // Step 2: Store tweets in database
    console.log(`[QUICK-TEST] Step 2: Storing ${tweets.length} tweets in database`);
    const { data: storedTweets, error: storageError } = await supabase
      .from("tweets")
      .upsert(
        tweets.map(tweet => ({
          tweet_id: tweet.id,
          content: tweet.content,
          created_at: tweet.created_at,
          url: tweet.url,
          twitter_handle: cleanedHandle,
          fetched_at: new Date().toISOString(),
          summarized: false,
        })),
        { onConflict: "tweet_id" }
      );
    
    if (storageError) {
      console.error("[QUICK-TEST] Error storing tweets:", storageError);
      throw new Error(`Error storing tweets: ${storageError.message}`);
    }
    
    // Step 3: Summarize the tweets
    console.log("[QUICK-TEST] Step 3: Summarizing tweets");
    const summary = await summarizeTweets(tweets, cleanedHandle);
    
    // Step 4: Store the summary
    console.log("[QUICK-TEST] Step 4: Storing summary in database");
    const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const { data: storedSummary, error: summaryError } = await supabase
      .from("tweet_summaries")
      .upsert({
        twitter_handle: cleanedHandle,
        summary_date: currentDate,
        content: summary,
        created_at: new Date().toISOString(),
      }, { onConflict: "twitter_handle,summary_date" });
    
    if (summaryError) {
      console.error("[QUICK-TEST] Error storing summary:", summaryError);
      throw new Error(`Error storing summary: ${summaryError.message}`);
    }
    
    // Mark tweets as summarized
    console.log("[QUICK-TEST] Step 5: Marking tweets as summarized");
    const tweetIds = tweets.map(tweet => tweet.id);
    const { error: updateError } = await supabase
      .from("tweets")
      .update({ summarized: true })
      .in("id", tweetIds);
    
    if (updateError) {
      console.error("[QUICK-TEST] Error marking tweets as summarized:", updateError);
      throw new Error(`Error marking tweets as summarized: ${updateError.message}`);
    }
    
    // Step 6: Send the newsletter
    console.log("[QUICK-TEST] Step 6: Sending newsletter email");
    await sendNewsletter(email, cleanedHandle, summary);
    
    // Step 7: Log the delivery
    console.log("[QUICK-TEST] Step 7: Recording delivery in database");
    const { error: deliveryError } = await supabase
      .from("newsletter_deliveries")
      .insert({
        email: email,
        twitter_handle: cleanedHandle,
        summary_id: storedSummary ? storedSummary[0]?.id : null,
        delivered_at: new Date().toISOString(),
      });
    
    if (deliveryError) {
      console.error("[QUICK-TEST] Error recording delivery:", deliveryError);
      throw new Error(`Error recording delivery: ${deliveryError.message}`);
    }
    
    console.log("[QUICK-TEST] Quick test completed successfully!");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Quick test completed successfully!",
        details: {
          tweets_found: tweets.length,
          summary_length: summary.length,
          email_sent: true
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("[QUICK-TEST] Error in quick-test function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "An unexpected error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
