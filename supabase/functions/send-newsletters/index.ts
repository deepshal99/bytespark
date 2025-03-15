
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
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable not set");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);
    
    // Determine if this is a test run or a specific email was requested
    let requestParams = {};
    try {
      requestParams = await req.json();
    } catch (e) {
      // If not valid JSON, proceed with empty params
      requestParams = {};
    }
    
    const isTestRun = requestParams.test === true;
    const targetEmail = requestParams.email;
    const forceResend = requestParams.forceResend === true;
    
    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Get active subscribers
    let subscribersQuery = supabase
      .from("newsletter_subscriptions")
      .select("*")
      .eq("active", true);
    
    // If a test email is specified, only send to that email
    if (targetEmail) {
      subscribersQuery = subscribersQuery.eq("email", targetEmail);
    }
    
    const { data: subscribers, error: subscribersError } = await subscribersQuery;
    
    if (subscribersError) {
      throw new Error(`Failed to fetch subscribers: ${subscribersError.message}`);
    }
    
    console.log(`Found ${subscribers.length} active subscribers`);
    
    if (subscribers.length === 0) {
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
        console.log(`Processing subscriber: ${subscriber.email}`);
        
        // Get the latest summary for this subscriber's Twitter source
        const twitterHandle = subscriber.twitter_source.replace('@', '').trim();

        // First, check if we've already sent a newsletter for this subscriber today
        // Skip this check if forceResend is true for our 5-minute testing
        if (!forceResend) {
          const { data: recentDeliveries, error: deliveriesError } = await supabase
            .from("newsletter_deliveries")
            .select("*")
            .eq("email", subscriber.email)
            .eq("twitter_handle", twitterHandle)
            .gte("delivered_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
            .order("delivered_at", { ascending: false })
            .limit(1);
          
          if (deliveriesError) {
            throw new Error(`Failed to check recent deliveries: ${deliveriesError.message}`);
          }
          
          if (recentDeliveries.length > 0) {
            console.log(`Already sent newsletter to ${subscriber.email} for ${twitterHandle} today, skipping`);
            emailResults.push({
              email: subscriber.email,
              success: false,
              skipped: true,
              error: "Newsletter already sent today"
            });
            continue;
          }
        }
        
        const { data: summaries, error: summariesError } = await supabase
          .from("tweet_summaries")
          .select("*")
          .eq("twitter_handle", twitterHandle)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (summariesError) {
          throw new Error(`Failed to fetch summaries for ${twitterHandle}: ${summariesError.message}`);
        }
        
        if (summaries.length === 0) {
          console.log(`No summary found for ${twitterHandle}`);
          emailResults.push({
            email: subscriber.email,
            success: false,
            error: `No summary available for ${twitterHandle}`,
          });
          continue;
        }
        
        const summary = summaries[0];
        
        // Create newsletter content
        const formattedDate = new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        
        // Send the newsletter
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
        
        console.log(`Email sent to ${subscriber.email}:`, emailResponse);
        
        // Save the newsletter delivery record
        const { error: deliveryError } = await supabase
          .from("newsletter_deliveries")
          .insert({
            email: subscriber.email,
            twitter_handle: twitterHandle,
            summary_id: summary.id,
            delivered_at: new Date().toISOString(),
          });
        
        if (deliveryError) {
          console.error(`Error recording delivery for ${subscriber.email}:`, deliveryError);
        }
        
        emailResults.push({
          email: subscriber.email,
          success: true,
        });
        
      } catch (error) {
        console.error(`Error processing subscriber ${subscriber.email}:`, error);
        emailResults.push({
          email: subscriber.email,
          success: false,
          error: error.message,
        });
      }
    }
    
    const successCount = emailResults.filter(result => result.success).length;
    
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
    console.error("Error in send-newsletters function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
