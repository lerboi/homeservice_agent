'use client';

import { AnimatePresence, motion } from 'framer-motion';

export default function WelcomeBanner({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="text-center py-4"
        >
          <h2 className="text-xl font-semibold text-[#0F172A]">
            Welcome to your dashboard
          </h2>
          <p className="text-sm text-[#475569] mt-1">
            Complete your setup to start receiving calls from real customers.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
