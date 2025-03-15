
import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

const testimonials = [{
  quote: "ByteSize has become my go-to source for Twitter insights. The newsletter is always packed with relevant content.",
  author: "Sarah Johnson",
  title: "Marketing Director"
}, {
  quote: "I save hours each week by letting ByteSize curate the best Twitter content for me. Highly recommended!",
  author: "Michael Chen",
  title: "Product Manager"
}];

const Testimonials = () => {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <h2 className="text-3xl font-bold text-center mb-12">What Our Users Say</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              className="bg-white p-6 rounded-lg shadow-md"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              <div className="flex items-start mb-4">
                <MessageSquare className="text-bytesize-blue mr-3 mt-1 h-5 w-5" />
                <p className="text-gray-700 italic">"{testimonial.quote}"</p>
              </div>
              <div className="mt-4">
                <p className="font-semibold">{testimonial.author}</p>
                <p className="text-sm text-gray-600">{testimonial.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
