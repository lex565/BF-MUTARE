'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCounter } from '@/app/lib/useCounter'
import { fadeInUp, slideInLeft } from '@/app/lib/animations'

export function Hero() {
  const { count: customers, ref: customersRef } = useCounter(1200, 2.5)
  const { count: hours, ref: hoursRef } = useCounter(48, 2.5)
  const { count: rating, ref: ratingRef } = useCounter(5, 1.5)

  return (
    <section id="home" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-white via-white to-orange-50 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            {...slideInLeft}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="inline-block">
                <span className="bg-yellow-100 text-yellow-800 px-4 py-1 rounded-full text-sm font-semibold">
                  🚗 Gateway to Affordable Japanese Cars
                </span>
              </div>
              <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight">
                Zimbabwe's <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600">Gateway</span> to Affordable Japanese Cars
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
                Direct imports from Japan. Fast nationwide delivery. Transparent pricing. Your dream car delivered to your doorstep anywhere in Zimbabwe.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="#contact"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-8 py-4 rounded-lg font-semibold hover:shadow-lg hover:shadow-orange-200 transition-all hover:scale-105"
              >
                Get Your Car Today
                <ArrowRight size={20} />
              </Link>
              <a
                href="https://wa.me/263123456789"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg font-semibold hover:border-orange-600 hover:text-orange-600 transition-all"
              >
                Chat on WhatsApp
              </a>
            </div>

            {/* Stats with Counters */}
            <div className="flex flex-wrap gap-8 pt-8 border-t border-gray-200">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="space-y-1"
                ref={customersRef}
              >
                <div className="text-3xl font-bold text-orange-600">{customers}+</div>
                <p className="text-gray-600 text-sm">Happy Customers</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="space-y-1"
                ref={hoursRef}
              >
                <div className="text-3xl font-bold text-orange-600">{hours}h</div>
                <p className="text-gray-600 text-sm">Average Delivery Time</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="space-y-1"
                ref={ratingRef}
              >
                <div className="text-3xl font-bold text-orange-600">{rating}★</div>
                <p className="text-gray-600 text-sm">Customer Rating</p>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            whileHover={{ scale: 1.02 }}
            className="relative h-full min-h-96"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-200 via-orange-200 to-orange-300 rounded-2xl blur-2xl opacity-40" />
            <img
              src="https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=600&h=500&fit=crop"
              alt="Japanese car"
              className="relative rounded-2xl w-full h-full object-cover shadow-2xl"
            />
            {/* Floating Badge */}
            <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md rounded-lg p-4 shadow-lg">
              <p className="text-sm font-semibold text-gray-900">From Japan to Your Door</p>
              <p className="text-xs text-gray-600">Quality vehicles, trusted service</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
