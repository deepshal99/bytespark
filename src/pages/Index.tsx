
import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'react-toastify';
import Header from '../components/Header';
import NewsletterForm from '../components/NewsletterForm';

const Index = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [lastSubscribedHandle, setLastSubscribedHandle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    
    if (!twitterHandle) {
      toast.error('Please enter a Twitter handle to follow');
      return;
    }
    
    setLoading(true);
    
    try {
      // Format the twitter handle correctly (don't add @ if it's already a URL)
      let formattedTwitterHandle = twitterHandle;
      if (!twitterHandle.includes('twitter.com') && 
          !twitterHandle.includes('x.com') && 
          !twitterHandle.startsWith('@')) {
        formattedTwitterHandle = `@${twitterHandle}`;
      }
      
      console.log('Subscribing with:', { email, twitterSource: formattedTwitterHandle });
      
      // Call the newsletter-signup edge function
      const { data, error } = await supabase.functions.invoke('newsletter-signup', {
        body: { 
          email, 
          twitterSource: formattedTwitterHandle
        }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message);
      }
      
      // Show success message and partially reset form
      toast.success(data?.message || 'Successfully subscribed to ByteSize newsletter!');
      setLastSubscribedHandle(formattedTwitterHandle);
      setSubscribed(true);
      setTwitterHandle(''); // Only clear the Twitter handle, keep the email for additional subscriptions
    } catch (err) {
      console.error('Error subscribing to newsletter:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Failed to subscribe'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeAnother = () => {
    setSubscribed(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-indigo-100 to-white py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                Your Twitter Feed, <br />
                <span className="text-indigo-600">Curated & Summarized</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Subscribe to receive insights from your favorite Twitter accounts, 
                summarized daily by AI and delivered straight to your inbox.
              </p>
            </div>
            
            {!subscribed ? (
              <div className="max-w-md mx-auto">
                <NewsletterForm 
                  email={email}
                  setEmail={setEmail}
                  twitterHandle={twitterHandle}
                  setTwitterHandle={setTwitterHandle}
                  handleSubmit={handleSubmit}
                  loading={loading}
                />
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto text-center">
                <h3 className="text-xl font-semibold text-green-800 mb-2">
                  🎉 Successfully Subscribed!
                </h3>
                <p className="text-green-700 mb-4">
                  Thank you for subscribing to {lastSubscribedHandle} updates via ByteSize.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={handleSubscribeAnother}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  >
                    Subscribe to Another Twitter Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
