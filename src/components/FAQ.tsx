
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [{
  question: "How does ByteSize work?",
  answer: "ByteSize uses AI to analyze Twitter content from sources you specify. We extract the most valuable insights and deliver them to your inbox in a concise, easy-to-read format."
}, {
  question: "How often will I receive newsletters?",
  answer: "You'll receive one newsletter per week, typically delivered on Monday mornings so you can start your week with fresh insights."
}, {
  question: "Can I customize what content I receive?",
  answer: "Yes! By providing specific Twitter profiles or threads, you can control what sources our AI analyzes to generate your personalized newsletter."
}, {
  question: "Is there a cost to subscribe?",
  answer: "ByteSize is currently free during our beta period. We may introduce premium features in the future, but we'll always maintain a free tier."
}];

const FAQ = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  const toggleFaq = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };
  
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-4xl">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div 
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <button
                className="flex justify-between items-center w-full p-4 text-left bg-white hover:bg-gray-50 transition-colors"
                onClick={() => toggleFaq(index)}
              >
                <span className="font-medium">{faq.question}</span>
                <ChevronDown 
                  className={`h-5 w-5 text-gray-500 transition-transform ${
                    expandedIndex === index ? 'transform rotate-180' : ''
                  }`} 
                />
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
                    <div className="p-4 pt-0 text-gray-600 bg-gray-50">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
