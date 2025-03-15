
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, AtSign } from 'lucide-react';
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
  
  const runManualTest = async () => {
    if (!email) {
      toast.error('Please enter your email to run a test');
      return;
    }
    
    try {
      setIsTestingSystem(true);
      toast.info('Starting system test. This may take a few minutes...');
      
      const { data, error } = await supabase.functions.invoke('manual-run', {
        body: { action: 'test', email }
      });
      
      if (error) {
        console.error('Test system error:', error);
        toast.error(error.message || 'Failed to run test. Please try again.');
        return;
      }
      
      console.log('Test result:', data);
      toast.success('Test completed! Check your email for results.');
      
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
            className="form-input pl-10 mx-0 px-[41px]" 
          />
        </motion.div>
        
        <motion.div className="relative" variants={itemVariants}>
          <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <input 
            type="text" 
            placeholder="Twitter profile or thread link" 
            value={twitterSource} 
            onChange={e => setTwitterSource(e.target.value)} 
            required 
            className="form-input pl-10 px-[41px]" 
          />
        </motion.div>
        
        <motion.button 
          type="submit" 
          className="btn-primary w-full flex items-center justify-center group" 
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
        
        {process.env.NODE_ENV === 'development' && (
          <motion.div className="mt-4" variants={itemVariants}>
            <button
              type="button"
              onClick={runManualTest}
              className="text-sm text-blue-500 hover:text-blue-700 flex items-center justify-center w-full"
              disabled={isTestingSystem}
            >
              {isTestingSystem ? (
                <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-blue-500 animate-spin mr-2"></div>
              ) : null}
              {isTestingSystem ? 'Running test...' : '[DEV] Test newsletter system'}
            </button>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
};

export default NewsletterForm;
