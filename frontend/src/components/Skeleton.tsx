import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        repeat: Infinity,
        repeatType: 'reverse',
        duration: 1.5,
        ease: 'easeInOut',
      }}
      className={`bg-slate-800/40 rounded-xl overflow-hidden relative ${className}`}
    >
      <div 
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent" 
        style={{ animation: 'shimmer 2s infinite' }}
      />
    </motion.div>
  );
};
