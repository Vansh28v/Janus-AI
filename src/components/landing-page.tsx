
"use client";

import TransformerSequence from "./transformer-sequence";
import ParticleSphere from "./particle-sphere";
import { motion } from "motion/react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  Activity,
  Boxes,
  BrainCircuit,
} from "lucide-react";

const features = [
  {
    icon: BrainCircuit,
    number: "01",
    title: "Demand Intelligence",
    description:
      "Anticipate material requirements using historical consumption, project activity and predictive analytics.",
  },
  {
    icon: Boxes,
    number: "02",
    title: "Inventory Optimization",
    description:
      "Maintain balanced inventory, identify shortage risks and make smarter stock allocation decisions.",
  },
  {
    icon: Activity,
    number: "03",
    title: "Procurement Planning",
    description:
      "Turn demand forecasts into actionable procurement recommendations and more resilient supply chains.",
  },
];

export default function LandingPage() {
  return (
    <main>
      <div className="page-container">
        {/* NAVIGATION */}
        <motion.header
          className="site-nav"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
        <a href="#" className="brand">
  JANUS<span> AI</span>
</a>

          <nav className="nav-links">
            <a href="#platform">PLATFORM</a>
            <a href="#intelligence">INTELLIGENCE</a>
            <a href="#about">ABOUT</a>
          </nav>

          <a href="/login" className="nav-cta">
            Launch Dashboard <ArrowRight size={14} />
          </a>
        </motion.header>

        {/* HERO SECTION */}
        <section className="hero">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, x: -35 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <div className="eyebrow">
              POWERING A SMARTER TOMORROW
            </div>

            <h1 className="hero-title">
              Intelligence
              <br />
              that keeps
              <br />
              everything
              <br />
              <em>in balance.</em>
            </h1>

            <p className="hero-description">
              A new perspective on power utility intelligence.
              Predict material demand, optimize inventory and
              build a more resilient energy network.
            </p>

            <div className="hero-actions">
             <motion.a
  href="/login"
  className="button-primary"
  whileHover={{ y: -3 }}
  whileTap={{ scale: 0.97 }}
>
  Launch Dashboard
  <ArrowRight size={15} />
</motion.a>

              <a
                href="#intelligence"
                className="button-secondary"
              >
                Our intelligence
                <ArrowDownRight size={16} />
              </a>
            </div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, delay: 0.3 }}
            aria-label="Champagne and blush-pink particle sphere"
          >
            <ParticleSphere />

            <div className="hero-caption">
              INTELLIGENCE IN MOTION · EST. 2026
            </div>
          </motion.div>
        </section>

        {/* SCROLL CUE */}
        <div className="scroll-cue">
          EXPLORE WHAT'S POSSIBLE
          <span>
            <ArrowDown size={14} />
          </span>
        </div>

        {/* TRANSFORMER CANVAS SCROLL ANIMATION */}
        <TransformerSequence />

        {/* PLATFORM INTRODUCTION */}
        <section className="intro-section" id="platform">
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="eyebrow">
              A MORE INTELLIGENT NETWORK
            </div>

            <h2 className="section-heading">
              From reactive inventory
              <br />
              to <em>predictive intelligence.</em>
            </h2>

            <p className="hero-description">
              JANUS AI connects demand forecasting, inventory
              planning and procurement intelligence into one
              unified platform for power utilities.
            </p>
          </motion.div>

          {/* FEATURES */}
          <div className="feature-grid" id="intelligence">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  className="feature-card"
                  key={feature.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.12,
                  }}
                  whileHover={{ y: -6 }}
                >
                  <div className="eyebrow">
                    {feature.number}
                  </div>

                  <Icon size={25} color="#B77D84" />

                  <h3>{feature.title}</h3>

                  <p>{feature.description}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="site-footer" id="about">
          <div className="brand">
            JANUS<span>AI</span>
          </div>

          <p>
            INTELLIGENT MATERIAL PLANNING · POWERING A BETTER TOMORROW
          </p>

          <p>PS000213 · Gujarat · 2026</p>
        </footer>
      </div>
    </main>
  );
}
