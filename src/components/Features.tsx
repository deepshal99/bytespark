
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
  
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose ByteSize</h2>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              className="bg-white p-6 rounded-lg shadow-md border border-gray-100"
              variants={itemVariants}
            >
              <div className="mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
