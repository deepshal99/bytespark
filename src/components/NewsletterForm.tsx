
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, AtSign } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

const NewsletterForm = () => {
  const [email, setEmail] = useState('');
  const [twitterSource, setTwitterSource] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !twitterSource) {
      toast.error('Please fill all fields');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const { data, error } = await supabase.functions.invoke('newsletter-signup', {
        body: { email, twitterSource }
      });

      if (error) {
        console.error('Subscription error:', error);
        toast.error(error.message || 'Failed to subscribe. Please try again.');
        return;
      }
      
      if (data.error) {
        if (data.error === 'Email already subscribed') {
          toast.warning('This email is already subscribed to our newsletter.');
        } else {
          toast.error(data.error || 'Failed to subscribe. Please try again.');
        }
        return;
      }
      
      toast.success('Successfully subscribed to ByteSize!');
      setEmail('');
      setTwitterSource('');
      
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setIsSubmitting(false);
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
      </form>
    </motion.div>
  );
};

export default NewsletterForm;
