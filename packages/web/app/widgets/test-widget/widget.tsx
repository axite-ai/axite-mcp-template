"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkle, CheckCircleFilled } from "@openai/apps-sdk-ui/components/Icon";
import { AnimateLayout } from "@openai/apps-sdk-ui/components/Transition";
import { cn } from "@/lib/utils/cn";

export default function TestWidget() {
  return (
    <div className="p-5 antialiased">
      <AnimateLayout>
        <div key="test-content" className="rounded-3xl border-none p-8 text-center bg-surface shadow-none">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: 360 }}
            transition={{
              type: "spring",
              bounce: 0.4,
              duration: 1,
              delay: 0.2,
            }}
            className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-discovery-solid flex items-center justify-center"
          >
            <Sparkle className="w-10 h-10 text-white" />
          </motion.div>

          <h1 className="heading-lg mb-2 text-default">
            Test Widget
          </h1>

          <p className="text-sm mb-6 text-secondary">
            This is a test widget demonstrating the new design system
          </p>

          <div className="space-y-3">
            {["Adaptive theme support", "Smooth animations", "Modern design"].map(
              (feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: "spring",
                    bounce: 0.2,
                    duration: 0.5,
                    delay: index * 0.1 + 0.4,
                  }}
                  className="flex items-center justify-center gap-2"
                >
                  <CheckCircleFilled
                    className="w-4 h-4 text-success"
                  />
                  <span className="text-sm text-secondary">
                    {feature}
                  </span>
                </motion.div>
              )
            )}
          </div>
        </div>
      </AnimateLayout>
    </div>
  );
}
