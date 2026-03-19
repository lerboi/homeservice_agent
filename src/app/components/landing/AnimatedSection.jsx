'use client';
import { motion, useReducedMotion } from 'framer-motion';

export function AnimatedSection({ children, className, delay = 0, direction = 'up' }) {
  const prefersReducedMotion = useReducedMotion();

  const directions = {
    up: { y: 32 },
    down: { y: -32 },
    left: { x: 32 },
    right: { x: -32 },
  };

  const offset = directions[direction] || directions.up;

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, ...offset }}
      whileInView={prefersReducedMotion ? {} : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedStagger({ children, className }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : 0.12,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({ children, className }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: prefersReducedMotion ? {} : { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
