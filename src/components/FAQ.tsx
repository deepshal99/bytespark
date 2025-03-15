
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "How does ByteSize work?",
    answer: "ByteSize uses AI to analyze Twitter content from sources you specify. We extract the most valuable insights and deliver them to your inbox in a concise, easy-to-read format."
  },
  {
    question: "How often will I receive newsletters?",
    answer: "You'll receive one newsletter per week, typically delivered on Monday mornings so you can start your week with fresh insights."
  },
  {
    question: "Can I customize what content I receive?",
    answer: "Yes! By providing specific Twitter profiles or threads, you can control what sources our AI analyzes to generate your personalized newsletter."
  },
  {
    question: "Is there a cost to subscribe?",
    answer: "ByteSize is currently free during our beta period. We may introduce premium features in the future, but we'll always maintain a free tier."
  }
];

const FAQ = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="py-16">
      <motion.h2 
        className="text-2xl md:text-3xl font-bold text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Frequently Asked Questions
      </motion.h2>
      
      <div className="max-w-3xl mx-auto">
        {faqs.map((faq, index) => (
          <motion.div 
            key={index}
            className="mb-4 border-b border-border pb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <button
              className="flex justify-between items-center w-full py-4 text-left font-medium focus:outline-none"
              onClick={() => toggleFaq(index)}
            >
              {faq.question}
              <motion.div
                animate={{ rotate: expandedIndex === index ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            </button>
            
            <AnimatePresence>
              {expandedIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pb-4 text-muted-foreground">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;
