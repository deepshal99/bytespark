
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, AtSign, Send, PlayCircle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

type NewsletterFormProps = {
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  twitterHandle: string;
  setTwitterHandle: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
}

const NewsletterForm = ({
  email,
  setEmail,
  twitterHandle: twitterSource,
  setTwitterHandle: setTwitterSource,
  handleSubmit,
  loading: isSubmitting
}: NewsletterFormProps) => {
  const [isTestingSystem, setIsTestingSystem] = useState(false);
  const [testMode, setTestMode] = useState<'full' | 'fetch' | 'summarize' | 'send'>('full');
  
  const runManualTest = async () => {
    if (!email) {
      toast.error('Please enter your email to run a test');
      return;
    }
    
    try {
      setIsTestingSystem(true);
      toast.info(`Starting system test in ${testMode} mode. This may take a few minutes...`);
      
      console.log(`Running manual test with email: ${email}, mode: ${testMode}`);
      
      const { data, error } = await supabase.functions.invoke('manual-run', {
        body: { 
          action: 'test', 
          email,
          mode: testMode
        }
      });
      
      if (error) {
        console.error('Test system error:', error);
        toast.error(error.message || 'Failed to run test. Please try again.');
        return;
      }
      
      console.log('Test result:', data);
      toast.success(`Test completed in ${testMode} mode! Check your email for results.`);
      
    } catch (error) {
      console.error('Test system error:', error);
      toast.error('Failed to run test. Please try again.');
    } finally {
      setIsTestingSystem(false);
    }
  };
  
  const containerVariants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: {
      y: 20,
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 10
      }
    }
  };
  
  return (
    <motion.div 
      className="w-full max-w-md mx-auto" 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <motion.div className="relative" variants={itemVariants}>
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <input 
            type="email" 
            placeholder="Your email address" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" 
          />
        </motion.div>
        
        <motion.div className="relative" variants={itemVariants}>
          <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <input 
            type="text" 
            placeholder="Twitter handle (e.g. @elonmusk)" 
            value={twitterSource} 
            onChange={e => setTwitterSource(e.target.value)} 
            required 
            className="w-full p-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" 
          />
        </motion.div>
        
        <motion.button 
          type="submit" 
          className="w-full bg-indigo-600 text-white p-3 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center group" 
          disabled={isSubmitting}
          variants={itemVariants}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <div className="h-5 w-5 rounded-full border-2 border-t-transparent border-white animate-spin"></div>
          ) : (
            <>
              Get My Newsletter
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </motion.button>
        
        <motion.div className="mt-4 space-y-2" variants={itemVariants}>
          <div className="flex gap-2 mb-2">
            <select 
              value={testMode}
              onChange={(e) => setTestMode(e.target.value as any)}
              className="text-sm bg-white border border-gray-300 rounded px-2 flex-1"
            >
              <option value="full">Full Pipeline</option>
              <option value="fetch">Fetch Tweets Only</option>
              <option value="summarize">Summarize Only</option>
              <option value="send">Send Newsletter Only</option>
            </select>
            
            <button
              type="button"
              onClick={runManualTest}
              className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded flex items-center justify-center flex-1"
              disabled={isTestingSystem}
            >
              {isTestingSystem ? (
                <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-blue-500 animate-spin mr-2"></div>
              ) : <PlayCircle size={16} className="mr-1" />}
              {isTestingSystem ? 'Running...' : 'Test Newsletter'}
            </button>
          </div>
          
          <p className="text-xs text-gray-500 italic">
            This will test the selected part of the newsletter pipeline.
          </p>
        </motion.div>
      </form>
    </motion.div>
  );
};

export default NewsletterForm;
