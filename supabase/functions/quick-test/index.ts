
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.29.0'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string
const RETTIWT_API_URL = Deno.env.get('RETTIWT_API_URL') || 'http://localhost:3000'

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Parse request body
    const { email, twitterSource } = await req.json()
    
    if (!email || !twitterSource) {
      return new Response(
        JSON.stringify({ error: 'Email and Twitter handle are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Clean Twitter handle (remove @ if present)
    const cleanTwitterHandle = twitterSource.startsWith('@') 
      ? twitterSource.substring(1) 
      : twitterSource
    
    console.log(`🔍 Running quick test for Twitter handle: ${cleanTwitterHandle}, email: ${email}`)
    
    // Call the Rettiwt API to fetch real tweets
    const fetchResponse = await fetch(`${RETTIWT_API_URL}/quick-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        username: cleanTwitterHandle, 
        email 
      }),
    })
    
    const fetchData = await fetchResponse.json()
    
    if (!fetchResponse.ok) {
      throw new Error(fetchData.error || 'Failed to fetch tweets via Rettiwt API')
    }
    
    return new Response(
      JSON.stringify({
        message: 'Quick test successful! Check your email for the summarized tweets.',
        tweetCount: fetchData.tweetCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in quick-test function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred during quick test' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
