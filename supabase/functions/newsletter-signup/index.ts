
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    // Initialize Resend client
    const resend = new Resend(resendApiKey);

    // Parse request body
    const requestBody = await req.json();
    console.log("[NEWSLETTER-SIGNUP] Request body:", requestBody);
    
    const { email, twitterSource } = requestBody;

    if (!email || !twitterSource) {
      console.error("[NEWSLETTER-SIGNUP] Missing required fields:", { email, twitterSource });
      return new Response(
        JSON.stringify({ error: "Email and Twitter source are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Clean up the Twitter handle
    let cleanTwitterSource = twitterSource;
    if (cleanTwitterSource.startsWith("@")) {
      cleanTwitterSource = cleanTwitterSource.substring(1);
    }
    // If it's a URL, extract just the username
    if (cleanTwitterSource.includes("twitter.com/") || cleanTwitterSource.includes("x.com/")) {
      const matches = cleanTwitterSource.match(/(?:twitter\.com|x\.com)\/([^/?\s]+)/);
      if (matches && matches[1]) {
        cleanTwitterSource = matches[1];
      }
    } else if (cleanTwitterSource.includes("/")) {
      // If it has slashes but isn't clearly a URL, just take the first part
      cleanTwitterSource = cleanTwitterSource.split("/")[0];
    }
    
    console.log(`[NEWSLETTER-SIGNUP] Cleaned Twitter handle: ${cleanTwitterSource}`);

    // Check if this specific email + twitter handle combination already exists
    const { data: existingSubscription, error: checkError } = await supabase
      .from("newsletter_subscriptions")
      .select("*")
      .eq("email", email)
      .eq("twitter_source", cleanTwitterSource)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[NEWSLETTER-SIGNUP] Error checking existing subscription:", checkError);
      throw new Error("Error checking database");
    }

    if (existingSubscription) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "You're already subscribed to this Twitter account!"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Store the subscription in Supabase - allow the same email to subscribe to multiple Twitter handles
    const { error: insertError } = await supabase
      .from("newsletter_subscriptions")
      .insert([{ email, twitter_source: cleanTwitterSource }]);

    if (insertError) {
      console.error("[NEWSLETTER-SIGNUP] Error inserting subscription:", insertError);
      throw new Error("Failed to save subscription");
    }

    // Send confirmation email using Resend
    const emailResponse = await resend.emails.send({
      from: "ByteSize <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to ByteSize!",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Welcome to ByteSize!</h1>
          <p>Thank you for subscribing to ByteSize, your Twitter feed, curated & summarized.</p>
          <p>We'll start extracting insights from <strong>@${cleanTwitterSource}</strong> and deliver them straight to your inbox.</p>
          <p>Stay tuned for your first newsletter!</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666;">
            <p>ByteSize - Your Twitter Feed, Curated & Summarized</p>
            <p>You're receiving this email because you signed up for ByteSize. If you believe this is a mistake, simply ignore this email.</p>
          </div>
        </div>
      `,
    });

    console.log("[NEWSLETTER-SIGNUP] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully subscribed to ByteSize newsletter!" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[NEWSLETTER-SIGNUP] Error in newsletter signup:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
