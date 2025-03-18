
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[QUICK-TEST] Starting quick test function");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[QUICK-TEST] Missing Supabase credentials");
      throw new Error("Missing Supabase credentials");
    }
    
    if (!OPENAI_API_KEY) {
      console.error("[QUICK-TEST] Missing OpenAI API key");
      throw new Error("Missing OpenAI API key");
    }
    
    if (!RESEND_API_KEY) {
      console.error("[QUICK-TEST] Missing Resend API key");
      throw new Error("Missing Resend API key");
    }

    // Initialize clients
    console.log("[QUICK-TEST] Initializing Supabase, OpenAI, and Resend clients");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const resend = new Resend(RESEND_API_KEY);

    // Parse request body
    const { email, twitterHandle } = await req.json();
    
    if (!email || !twitterHandle) {
      console.error("[QUICK-TEST] Missing required parameters:", { email, twitterHandle });
      throw new Error("Email and Twitter handle are required");
    }
    
    console.log(`[QUICK-TEST] Processing quick test for email: ${email}, Twitter handle: ${twitterHandle}`);
    
    // STEP 1: Fetch tweets
    console.log(`[QUICK-TEST] Step 1: Fetching tweets for ${twitterHandle}`);
    
    // Call the fetch-tweets function directly with the required parameters
    const fetchResponse = await fetch(`${SUPABASE_URL}/functions/v1/fetch-tweets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        maxTweets: 5, // Limit to 5 tweets for the quick test
        targetEmail: email,
        test: true,
        twitterHandle: twitterHandle // Add this parameter to help filter
      })
    });
    
    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error("[QUICK-TEST] Error fetching tweets:", errorText);
      throw new Error(`Failed to fetch tweets: ${errorText}`);
    }
    
    const fetchData = await fetchResponse.json();
    console.log("[QUICK-TEST] Fetch tweets result:", fetchData);
    
    // Check if any tweets were fetched
    let fetchSuccess = false;
    let tweetsCount = 0;
    
    if (fetchData.success && fetchData.results) {
      for (const result of fetchData.results) {
        if (result.success && result.tweets_count > 0) {
          fetchSuccess = true;
          tweetsCount += result.tweets_count;
        }
      }
    }
    
    if (!fetchSuccess) {
      console.log("[QUICK-TEST] No tweets were fetched, fetching directly from the database");
      
      // Try to get any existing tweets from the database for this handle
      const { data: existingTweets, error: tweetsError } = await supabase
        .from("tweets")
        .select("*")
        .ilike("twitter_handle", twitterHandle.replace('@', ''))
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (tweetsError) {
        console.error("[QUICK-TEST] Error fetching existing tweets:", tweetsError);
      } else if (existingTweets && existingTweets.length > 0) {
        console.log(`[QUICK-TEST] Found ${existingTweets.length} existing tweets in the database`);
        fetchSuccess = true;
        tweetsCount = existingTweets.length;
      } else {
        console.log("[QUICK-TEST] No existing tweets found in the database");
      }
    }
    
    // STEP 2: Summarize tweets
    console.log("[QUICK-TEST] Step 2: Summarizing tweets");
    
    // Get the tweets for this handle (including ones we just fetched)
    const { data: tweets, error: tweetsError } = await supabase
      .from("tweets")
      .select("*")
      .ilike("twitter_handle", twitterHandle.replace('@', ''))
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (tweetsError) {
      console.error("[QUICK-TEST] Error retrieving tweets for summarization:", tweetsError);
      throw new Error(`Failed to retrieve tweets for summarization: ${tweetsError.message}`);
    }
    
    if (!tweets || tweets.length === 0) {
      console.warn("[QUICK-TEST] No tweets found for summarization, will use mock data");
      // Create some mock tweets for testing if none were found
      const mockTweets = [
        {
          content: "Sorry, we couldn't fetch real tweets for this handle. This is a mock tweet for testing purposes. #testing",
          twitter_handle: twitterHandle.replace('@', '')
        },
        {
          content: "Please make sure the Twitter handle is correct and that the account has public tweets. #bytesize",
          twitter_handle: twitterHandle.replace('@', '')
        },
        {
          content: "If this problem persists, try a different Twitter handle that you know has recent public tweets. #troubleshooting",
          twitter_handle: twitterHandle.replace('@', '')
        }
      ];
      console.log("[QUICK-TEST] Created mock tweets:", mockTweets);
      tweets.push(...mockTweets);
    }
    
    console.log(`[QUICK-TEST] Summarizing ${tweets.length} tweets`);
    
    // Format tweets for the prompt
    const tweetContent = tweets.map((tweet, index) => {
      return `Tweet ${index + 1}: ${tweet.content || "No content available"}`;
    }).join("\n\n");
    
    console.log("[QUICK-TEST] Tweet content for summarization:", tweetContent);
    
    // Generate summary using OpenAI
    console.log("[QUICK-TEST] Sending request to OpenAI");
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
    
    const summary = response.choices[0].message.content || "No summary could be generated.";
    console.log("[QUICK-TEST] Generated summary:", summary);
    
    // Store the summary
    const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    console.log(`[QUICK-TEST] Storing summary for ${twitterHandle} with date ${currentDate}`);
    
    const { data: storedSummary, error: summaryError } = await supabase
      .from("tweet_summaries")
      .upsert({
        twitter_handle: twitterHandle.replace('@', ''),
        summary_date: currentDate,
        content: summary,
        created_at: new Date().toISOString(),
      }, { onConflict: "twitter_handle,summary_date" });
    
    if (summaryError) {
      console.error("[QUICK-TEST] Error storing summary:", summaryError);
      throw new Error(`Failed to store summary: ${summaryError.message}`);
    }
    
    // STEP 3: Send email
    console.log(`[QUICK-TEST] Step 3: Sending email to ${email}`);
    
    // Create newsletter content
    const formattedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    // Send the newsletter
    console.log(`[QUICK-TEST] Sending email to ${email}`);
    const emailResponse = await resend.emails.send({
      from: "ByteSize <onboarding@resend.dev>",
      to: [email],
      subject: `ByteSize Newsletter: ${twitterHandle} Updates - ${formattedDate} (TEST)`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">ByteSize Newsletter</h1>
          <h2 style="color: #333;">Latest from @${twitterHandle.replace('@', '')}</h2>
          <p style="color: #666;">${formattedDate}</p>
          
          <div style="margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
            <div>${summary.replace(/\n/g, '<br>')}</div>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="https://twitter.com/${twitterHandle.replace('@', '')}" style="color: #4F46E5; text-decoration: none;">Follow @${twitterHandle.replace('@', '')} on Twitter</a>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666;">
            <p>ByteSize - Your Twitter Feed, Curated & Summarized</p>
            <p>You're receiving this email because you subscribed to updates from @${twitterHandle.replace('@', '')}.</p>
            <p>This is a test email. To unsubscribe from real newsletters, click <a href="#" style="color: #4F46E5;">here</a>.</p>
          </div>
        </div>
      `,
    });
    
    console.log("[QUICK-TEST] Email sent:", emailResponse);
    
    // Save the newsletter delivery record
    console.log(`[QUICK-TEST] Recording delivery for ${email}`);
    const { error: deliveryError } = await supabase
      .from("newsletter_deliveries")
      .insert({
        email: email,
        twitter_handle: twitterHandle.replace('@', ''),
        summary_id: null, // We don't have the ID since we used upsert
        delivered_at: new Date().toISOString(),
        test_delivery: true
      });
    
    if (deliveryError) {
      console.error("[QUICK-TEST] Error recording delivery:", deliveryError);
    }
    
    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: "Quick test completed successfully",
        details: {
          tweetsStatus: {
            success: fetchSuccess,
            count: tweetsCount
          },
          summaryStatus: {
            success: true,
            length: summary.length
          },
          emailStatus: {
            success: true,
            id: emailResponse.id
          }
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
        error: error.message || "An unexpected error occurred",
        message: "Quick test failed, see error details"
      }),
      {
        status: 200, // Return 200 even for errors to prevent function failures
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
