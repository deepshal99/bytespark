
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
    const { email, twitterSource } = await req.json();

    if (!email || !twitterSource) {
      return new Response(
        JSON.stringify({ error: "Email and Twitter source are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if email already exists
    const { data: existingSubscription, error: checkError } = await supabase
      .from("newsletter_subscriptions")
      .select("email")
      .eq("email", email)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing subscription:", checkError);
      throw new Error("Error checking database");
    }

    if (existingSubscription) {
      return new Response(
        JSON.stringify({ error: "Email already subscribed" }),
        {
          status: 409, // Conflict
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Store the subscription in Supabase
    const { error: insertError } = await supabase
      .from("newsletter_subscriptions")
      .insert([{ email, twitter_source: twitterSource }]);

    if (insertError) {
      console.error("Error inserting subscription:", insertError);
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
          <p>We'll start extracting insights from <strong>${twitterSource}</strong> and deliver them straight to your inbox.</p>
          <p>Stay tuned for your first newsletter!</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #666;">
            <p>ByteSize - Your Twitter Feed, Curated & Summarized</p>
            <p>You're receiving this email because you signed up for ByteSize. If you believe this is a mistake, simply ignore this email.</p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

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
    console.error("Error in newsletter signup:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
