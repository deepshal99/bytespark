
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
    console.log("Running manual test of the newsletter system");
    
    // Parse request body for specific parameters (e.g., email)
    let targetEmail = null;
    try {
      const body = await req.json();
      targetEmail = body.email;
    } catch (e) {
      // If there's no body, or it's not valid JSON, just proceed without filtering
    }
    
    // Initialize Supabase client for any database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Run the cron-scheduler function to test the entire pipeline
    const cronResponse = await fetch(`${SUPABASE_URL}/functions/v1/cron-scheduler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ 
        test: true,
        targetEmail 
      })
    });
    
    if (!cronResponse.ok) {
      const errorText = await cronResponse.text();
      console.error("Error running newsletter system:", errorText);
      throw new Error(`Failed to run newsletter system: ${errorText}`);
    }
    
    const cronData = await cronResponse.json();
    
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
    console.error("Error in test-newsletter-system function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
