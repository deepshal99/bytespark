
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
    console.log("Running daily scheduled tasks for ByteSize newsletter");
    
    // Parse request body for test mode and targetEmail
    let isTest = false;
    let targetEmail = null;
    try {
      const body = await req.json();
      isTest = body.test === true;
      targetEmail = body.targetEmail || null;
    } catch (e) {
      // If there's no body, or it's not valid JSON, just proceed normally
    }
    
    const testMode = isTest ? "?test=true" : "";
    
    // Step 1: Fetch tweets
    console.log("Step 1: Fetching tweets...");
    const fetchResponse = await fetch(`${SUPABASE_URL}/functions/v1/fetch-tweets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        test: isTest,
        email: targetEmail
      })
    });
    
    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error("Error fetching tweets:", errorText);
      throw new Error(`Failed to fetch tweets: ${errorText}`);
    }
    
    const fetchData = await fetchResponse.json();
    console.log("Fetch tweets result:", fetchData);
    
    // Step 2: Summarize tweets
    console.log("Step 2: Summarizing tweets...");
    const summarizeResponse = await fetch(`${SUPABASE_URL}/functions/v1/summarize-tweets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        test: isTest,
        email: targetEmail
      })
    });
    
    if (!summarizeResponse.ok) {
      const errorText = await summarizeResponse.text();
      console.error("Error summarizing tweets:", errorText);
      throw new Error(`Failed to summarize tweets: ${errorText}`);
    }
    
    const summarizeData = await summarizeResponse.json();
    console.log("Summarize tweets result:", summarizeData);
    
    // Step 3: Send newsletters
    console.log("Step 3: Sending newsletters...");
    const newsletterResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-newsletters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        test: isTest,
        email: targetEmail
      })
    });
    
    if (!newsletterResponse.ok) {
      const errorText = await newsletterResponse.text();
      console.error("Error sending newsletters:", errorText);
      throw new Error(`Failed to send newsletters: ${errorText}`);
    }
    
    const newsletterData = await newsletterResponse.json();
    console.log("Send newsletters result:", newsletterData);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Daily newsletter tasks completed successfully",
        results: {
          fetch: fetchData,
          summarize: summarizeData,
          newsletter: newsletterData
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("Error in cron-scheduler function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
