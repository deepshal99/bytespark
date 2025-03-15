
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This endpoint allows manual testing of the newsletter system
    console.log("[TEST] Running manual test of the newsletter system");
    
    // Parse request body for specific parameters (e.g., email)
    let targetEmail = null;
    let runMode = "full"; // Options: "full", "fetch", "summarize", "send"
    
    try {
      const body = await req.json();
      console.log("[TEST] Request parameters:", body);
      targetEmail = body.email;
      if (body.mode && ["full", "fetch", "summarize", "send"].includes(body.mode)) {
        runMode = body.mode;
      }
    } catch (e) {
      // If there's no body, or it's not valid JSON, just proceed without filtering
      console.log("[TEST] No valid JSON in request body, using default parameters");
    }
    
    console.log(`[TEST] Running test with mode: ${runMode}, target email: ${targetEmail || "all"}`);
    
    // Initialize Supabase client for any database operations
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[TEST] Missing Supabase credentials");
      throw new Error("Missing Supabase credentials");
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Configure which steps to run based on the mode
    const fetchTweets = runMode === "full" || runMode === "fetch";
    const summarizeTweets = runMode === "full" || runMode === "summarize";
    const sendNewsletters = runMode === "full" || runMode === "send";
    
    // Run the cron-scheduler function to test the entire pipeline
    console.log("[TEST] Calling cron-scheduler function");
    const cronResponse = await fetch(`${SUPABASE_URL}/functions/v1/cron-scheduler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ 
        test: true,
        targetEmail,
        fetchTweets,
        summarizeTweets,
        sendNewsletters
      })
    });
    
    if (!cronResponse.ok) {
      const errorText = await cronResponse.text();
      console.error("[TEST] Error running newsletter system:", errorText);
      throw new Error(`Failed to run newsletter system: ${errorText}`);
    }
    
    const cronData = await cronResponse.json();
    console.log("[TEST] Cron scheduler result:", cronData);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Newsletter system test completed",
        results: cronData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("[TEST] Error in test-newsletter-system function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
