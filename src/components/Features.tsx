
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Calendar, RefreshCw, Check } from 'lucide-react';

const features = [
  {
    icon: <Zap className="h-6 w-6 text-bytesize-blue" />,
    title: 'AI-Powered',
    description: 'Our AI analyzes Twitter content to deliver insights personalized for you.'
  },
  {
    icon: <Calendar className="h-6 w-6 text-bytesize-blue" />,
    title: 'Weekly Digest',
    description: 'Receive a concise weekly newsletter with the most valuable information.'
  },
  {
    icon: <RefreshCw className="h-6 w-6 text-bytesize-blue" />,
    title: 'Always Updating',
    description: 'Our algorithms constantly improve to deliver better content over time.'
  }
];

const Features = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
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
      className="grid md:grid-cols-3 gap-8 mt-16"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {features.map((feature, index) => (
        <motion.div 
          key={index}
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-border"
          variants={itemVariants}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
        >
          <div className="bg-bytesize-gray dark:bg-gray-700 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
            {feature.icon}
          </div>
          <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
          <p className="text-muted-foreground">{feature.description}</p>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default Features;
