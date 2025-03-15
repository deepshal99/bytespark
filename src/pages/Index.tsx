
import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion } from 'framer-motion';

import Header from '../components/Header';
import NewsletterForm from '../components/NewsletterForm';
import Features from '../components/Features';
import Testimonials from '../components/Testimonials';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
      
      <Header />
      
      <main className="flex-1">
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <motion.h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-bytesize-blue to-bytesize-indigo bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                Your Twitter Feed, Curated & Summarized
              </motion.h1>
              
              <motion.p 
                className="text-lg md:text-xl text-muted-foreground mb-10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                Let our AI extract insights from your favorite Twitter accounts and threads, delivered as a personalized newsletter straight to your inbox.
              </motion.p>
              
              <NewsletterForm />
              
              <motion.div 
                className="mt-8 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.5 }}
              >
                <p>🔒 No spam, unsubscribe anytime. Your data is secure.</p>
              </motion.div>
            </div>
          </div>
        </section>
        
        <section id="features" className="py-16 bg-secondary/50">
          <div className="container mx-auto px-4">
            <motion.h2 
              className="text-2xl md:text-3xl font-bold text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Why Choose ByteSize
            </motion.h2>
            
            <Features />
          </div>
        </section>
        
        <section className="py-16">
          <div className="container mx-auto px-4">
            <Testimonials />
          </div>
        </section>
        
        <section id="faq" className="py-16 bg-secondary/50">
          <div className="container mx-auto px-4">
            <FAQ />
          </div>
        </section>
        
        <section className="py-16">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-6">Ready to get started?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of professionals who get curated Twitter insights every week.
              </p>
              
              <div className="max-w-md mx-auto">
                <NewsletterForm />
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
