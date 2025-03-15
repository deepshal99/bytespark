
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Initialize Resend client
    const resend = new Resend(RESEND_API_KEY);
    
    // Get all subscribers
    const { data: subscribers, error: subscribersError } = await supabase
      .from("newsletter_subscriptions")
      .select("*");

    if (subscribersError) {
      console.error("Error fetching subscribers:", subscribersError);
      throw new Error("Failed to fetch subscribers");
    }
    
    const results = [];
    
    // Process each subscriber
    for (const subscriber of subscribers) {
      try {
        // Get unsent summaries for this subscriber
        const { data: unsentSummaries, error: summariesError } = await supabase
          .from("tweet_summaries")
          .select("*")
          .eq("subscriber_id", subscriber.id)
          .eq("sent", false)
          .order("created_at", { ascending: false });
        
        if (summariesError) {
          console.error(`Error fetching summaries for subscriber ${subscriber.id}:`, summariesError);
          continue;
        }
        
        if (!unsentSummaries || unsentSummaries.length === 0) {
          console.log(`No unsent summaries for subscriber ${subscriber.id}`);
          continue;
        }
        
        console.log(`Found ${unsentSummaries.length} unsent summaries for subscriber ${subscriber.id}`);
        
        // Prepare newsletter content
        let newsletterContent = "";
        
        for (const summary of unsentSummaries) {
          newsletterContent += `
<div style="margin-bottom: 30px;">
  <div style="margin-bottom: 15px;">
    <strong>@${summary.username}</strong>
  </div>
  <div>
    ${summary.summary.replace(/\n/g, '<br>')}
  </div>
</div>
<hr style="border: 0; height: 1px; background-color: #eaeaea; margin: 30px 0;">
`;
        }
        
        // Extract name from email (simple approach)
        const firstName = subscriber.email.split('@')[0].split('.')[0];
        const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        
        // Send email with Resend
        const emailResponse = await resend.emails.send({
          from: "ByteSize <onboarding@resend.dev>",
          to: [subscriber.email],
          subject: `ByteSize Newsletter: Your Twitter Digest for ${new Date().toLocaleDateString()}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ByteSize Newsletter</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      color: #4F46E5;
      font-size: 28px;
      font-weight: bold;
    }
    .content {
      background-color: #fff;
      padding: 20px;
      border-radius: 8px;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #eaeaea;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">ByteSize</div>
    <div>Your Twitter Feed, Curated & Summarized</div>
  </div>
  
  <div class="content">
    <p>Hello ${capitalizedName},</p>
    
    <p>Here's today's curated Twitter content from your favorite accounts:</p>
    
    ${newsletterContent}
    
    <p>We hope you found these insights valuable!</p>
    <p>Best regards,<br>The ByteSize Team</p>
  </div>
  
  <div class="footer">
    <p>ByteSize - Your Twitter Feed, Curated & Summarized</p>
    <p>You're receiving this email because you signed up for ByteSize. <a href="#">Unsubscribe</a>.</p>
  </div>
</body>
</html>
          `,
        });
        
        console.log("Email sent successfully:", emailResponse);
        
        // Mark summaries as sent
        const summaryIds = unsentSummaries.map(summary => summary.id);
        const { error: updateError } = await supabase
          .from("tweet_summaries")
          .update({ sent: true })
          .in("id", summaryIds);
        
        if (updateError) {
          console.error(`Error marking summaries as sent for subscriber ${subscriber.id}:`, updateError);
        }
        
        results.push({
          subscriber_id: subscriber.id,
          email: subscriber.email,
          summaries_sent: unsentSummaries.length,
          success: true
        });
        
      } catch (error) {
        console.error(`Error sending newsletter for subscriber ${subscriber.id}:`, error);
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
        message: `Sent newsletters to ${results.length} subscribers`, 
        results 
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
