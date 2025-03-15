import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Calendar, RefreshCw, Check } from 'lucide-react';
const features = [{
  icon: <Zap className="h-6 w-6 text-bytesize-blue" />,
  title: 'AI-Powered',
  description: 'Our AI analyzes Twitter content to deliver insights personalized for you.'
}, {
  icon: <Calendar className="h-6 w-6 text-bytesize-blue" />,
  title: 'Weekly Digest',
  description: 'Receive a concise weekly newsletter with the most valuable information.'
}, {
  icon: <RefreshCw className="h-6 w-6 text-bytesize-blue" />,
  title: 'Always Updating',
  description: 'Our algorithms constantly improve to deliver better content over time.'
}];
const Features = () => {
  const containerVariants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
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
  return;
};
export default Features;