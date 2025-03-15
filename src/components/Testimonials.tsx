
import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

const testimonials = [
  {
    quote: "ByteSize has become my go-to source for Twitter insights. The newsletter is always packed with relevant content.",
    author: "Sarah Johnson",
    title: "Marketing Director"
  },
  {
    quote: "I save hours each week by letting ByteSize curate the best Twitter content for me. Highly recommended!",
    author: "Michael Chen",
    title: "Product Manager"
  }
];

const Testimonials = () => {
  return (
    <div className="py-16">
      <motion.h2 
        className="text-2xl md:text-3xl font-bold text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        What Our Subscribers Say
      </motion.h2>
      
      <div className="grid md:grid-cols-2 gap-8">
        {testimonials.map((testimonial, index) => (
          <motion.div
            key={index}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-border relative"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <MessageSquare className="absolute top-6 right-6 h-10 w-10 text-bytesize-light-blue opacity-20" />
            <p className="text-lg italic mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
            <div>
              <p className="font-medium">{testimonial.author}</p>
              <p className="text-muted-foreground text-sm">{testimonial.title}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Testimonials;
