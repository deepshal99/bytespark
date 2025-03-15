
import React from 'react';
import { motion } from 'framer-motion';

const Header = () => {
  return (
    <header className="py-6">
      <div className="container mx-auto px-4">
        <motion.div 
          className="flex justify-between items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center">
            <motion.div 
              className="h-10 w-10 bg-gradient-to-r from-bytesize-blue to-bytesize-indigo rounded-md flex items-center justify-center mr-3"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <span className="text-white font-bold text-lg">B</span>
            </motion.div>
            <h1 className="text-xl font-bold tracking-tight">ByteSize</h1>
          </div>
          
          <nav>
            <ul className="flex space-x-6">
              <motion.li whileHover={{ scale: 1.05 }}>
                <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
              </motion.li>
              <motion.li whileHover={{ scale: 1.05 }}>
                <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </a>
              </motion.li>
            </ul>
          </nav>
        </motion.div>
      </div>
    </header>
  );
};

export default Header;
