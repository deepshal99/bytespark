
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[SEND] Starting send-newsletters function");
    
    if (!RESEND_API_KEY) {
      console.error("[SEND] RESEND_API_KEY environment variable not set");
      throw new Error("RESEND_API_KEY environment variable not set");
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[SEND] Missing Supabase credentials");
      throw new Error("Missing Supabase credentials");
    }
    
    console.log("[SEND] Creating Supabase client and Resend client");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);
    
    // Determine if this is a test run or a specific email was requested
    let requestParams = {};
    try {
      console.log("[SEND] Parsing request parameters");
      requestParams = await req.json();
      console.log("[SEND] Request parameters:", requestParams);
    } catch (e) {
      // If not valid JSON, proceed with empty params
      console.log("[SEND] No valid JSON in request body, using default parameters");
      requestParams = {};
    }
    
    const isTestRun = requestParams.test === true;
    const targetEmail = requestParams.email;
    const forceResend = requestParams.forceResend === true;
    
    console.log(`[SEND] Mode: ${isTestRun ? 'Test' : 'Production'}, Target email: ${targetEmail || 'All'}, Force resend: ${forceResend}`);
    
    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];
    console.log(`[SEND] Current date: ${currentDate}`);
    
    // Get active subscribers
    console.log("[SEND] Fetching active subscribers");
    let subscribersQuery = supabase
      .from("newsletter_subscriptions")
      .select("*")
      .eq("active", true);
    
    // If a test email is specified, only send to that email
    if (targetEmail) {
      console.log(`[SEND] Filtering to target email: ${targetEmail}`);
      subscribersQuery = subscribersQuery.eq("email", targetEmail);
    }
    
    const { data: subscribers, error: subscribersError } = await subscribersQuery;
    
    if (subscribersError) {
      console.error("[SEND] Failed to fetch subscribers:", subscribersError);
      throw new Error(`Failed to fetch subscribers: ${subscribersError.message}`);
    }
    
    console.log(`[SEND] Found ${subscribers.length} active subscribers`);
    
    if (subscribers.length === 0) {
      console.log("[SEND] No active subscribers found, exiting");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active subscribers found",
          count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const emailResults = [];
    
    // Process each subscriber
    for (const subscriber of subscribers) {
      try {
        console.log(`[SEND] Processing subscriber: ${subscriber.email}`);
        
        // Get the Twitter handle from the subscription
        if (!subscriber.twitter_source) {
          console.error(`[SEND] No Twitter source for subscriber ${subscriber.email}, skipping`);
          emailResults.push({
            email: subscriber.email,
            success: false,
            error: "No Twitter source specified in subscription"
          });
          continue;
        }
        
        // Remove @ symbol if present and trim
        const twitterHandle = subscriber.twitter_source.replace('@', '').trim();
        console.log(`[SEND] Twitter handle for subscriber ${subscriber.email}: ${twitterHandle}`);

        // First, check if we've already sent a newsletter for this subscriber today
        // Skip this check if forceResend is true for our 5-minute testing
        if (!forceResend) {
          console.log(`[SEND] Checking recent deliveries for ${subscriber.email} and ${twitterHandle}`);
          const { data: recentDeliveries, error: deliveriesError } = await supabase
            .from("newsletter_deliveries")
            .select("*")
            .eq("email", subscriber.email)
            .eq("twitter_handle", twitterHandle)
            .gte("delivered_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
            .order("delivered_at", { ascending: false })
            .limit(1);
          
          if (deliveriesError) {
            console.error(`[SEND] Failed to check recent deliveries for ${subscriber.email}:`, deliveriesError);
            throw new Error(`Failed to check recent deliveries: ${deliveriesError.message}`);
          }
          
          if (recentDeliveries.length > 0) {
            console.log(`[SEND] Already sent newsletter to ${subscriber.email} for ${twitterHandle} today, skipping`);
            emailResults.push({
              email: subscriber.email,
              success: false,
              skipped: true,
              error: "Newsletter already sent today"
            });
            continue;
          }
        } else {
          console.log(`[SEND] Force resend enabled for ${subscriber.email}, skipping delivery check`);
        }
        
        // Get the latest summary for this twitter handle
        console.log(`[SEND] Fetching latest summary for ${twitterHandle}`);
        const { data: summaries, error: summariesError } = await supabase
          .from("tweet_summaries")
          .select("*")
          .eq("twitter_handle", twitterHandle)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (summariesError) {
          console.error(`[SEND] Failed to fetch summaries for ${twitterHandle}:`, summariesError);
          throw new Error(`Failed to fetch summaries for ${twitterHandle}: ${summariesError.message}`);
        }
        
        if (summaries.length === 0) {
          console.log(`[SEND] No summary found for ${twitterHandle}`);
          emailResults.push({
            email: subscriber.email,
            success: false,
            error: `No summary available for ${twitterHandle}`,
          });
          continue;
        }
        
        const summary = summaries[0];
        console.log(`[SEND] Found summary for ${twitterHandle} from ${summary.created_at}`);
        
        // Create newsletter content
        const formattedDate = new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        
        // Send the newsletter
        console.log(`[SEND] Sending email to ${subscriber.email}`);
        const emailResponse = await resend.emails.send({
          from: "ByteSize <onboarding@resend.dev>",
          to: [subscriber.email],
          subject: `ByteSize Newsletter: ${twitterHandle} Updates - ${formattedDate}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4F46E5;">ByteSize Newsletter</h1>
              <h2 style="color: #333;">Latest from @${twitterHandle}</h2>
              <p style="color: #666;">${formattedDate}</p>
              
              <div style="margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
                <div>${summary.content.replace(/\n/g, '<br>')}</div>
              </div>
              
              <p style="margin-top: 30px;">
                <a href="https://twitter.com/${twitterHandle}" style="color: #4F46E5; text-decoration: none;">Follow @${twitterHandle} on Twitter</a>
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666;">
                <p>ByteSize - Your Twitter Feed, Curated & Summarized</p>
                <p>You're receiving this email because you subscribed to updates from @${twitterHandle}.</p>
                <p>To unsubscribe, click <a href="YOUR_UNSUBSCRIBE_LINK" style="color: #4F46E5;">here</a>.</p>
              </div>
            </div>
          `,
        });
        
        console.log(`[SEND] Email sent to ${subscriber.email}:`, emailResponse);
        
        // Save the newsletter delivery record
        console.log(`[SEND] Recording delivery for ${subscriber.email}`);
        const { error: deliveryError } = await supabase
          .from("newsletter_deliveries")
          .insert({
            email: subscriber.email,
            twitter_handle: twitterHandle,
            summary_id: summary.id,
            delivered_at: new Date().toISOString(),
          });
        
        if (deliveryError) {
          console.error(`[SEND] Error recording delivery for ${subscriber.email}:`, deliveryError);
        }
        
        emailResults.push({
          email: subscriber.email,
          success: true,
        });
        
      } catch (error) {
        console.error(`[SEND] Error processing subscriber ${subscriber.email}:`, error);
        emailResults.push({
          email: subscriber.email,
          success: false,
          error: error.message,
        });
      }
    }
    
    const successCount = emailResults.filter(result => result.success).length;
    console.log(`[SEND] Completed sending newsletters. Success: ${successCount}/${subscribers.length}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Newsletters sent: ${successCount}/${subscribers.length}`,
        results: emailResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("[SEND] Error in send-newsletters function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
