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
  return;
};
export default FAQ;