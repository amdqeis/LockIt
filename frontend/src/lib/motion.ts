export const motionTokens = {
  duration: {
    instant: 0.1,
    fast: 0.15,
    normal: 0.22,
    slow: 0.35,
  },
  ease: [0.22, 1, 0.36, 1] as const,
  spring: {
    type: "spring" as const,
    stiffness: 320,
    damping: 30,
    mass: 0.8,
  },
  navSpring: {
    type: "spring" as const,
    stiffness: 380,
    damping: 34,
    mass: 0.8,
  },
};

export const pageVariants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -4,
  },
};

export const pageTransition = {
  duration: motionTokens.duration.normal,
  ease: motionTokens.ease,
};

export const modalVariants = {
  initial: {
    opacity: 0,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
  },
};

export const modalTransition = {
  duration: motionTokens.duration.fast,
  ease: motionTokens.ease,
};

export const fadeUpVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -6,
  },
};

export const staggerContainer = (staggerTime = 0.04) => ({
  animate: {
    transition: {
      staggerChildren: staggerTime,
    },
  },
});

