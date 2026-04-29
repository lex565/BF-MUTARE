'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import testimonials from '@/app/data/testimonials.json'
import { fadeInUp, staggerContainer, staggerItem } from '@/app/lib/animations'

export function Testimonials() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          {...fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Satisfied Clients Across Zimbabwe
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Real reviews from real customers who trusted us with their car purchases.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          {...staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 mb-12"
        >
          {testimonials.map((testimonial) => (
            <motion.div
              key={testimonial.id}
              {...staggerItem}
              whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
              className="group"
            >
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-8 shadow-md hover:shadow-lg transition-all border border-gray-200 hover:border-orange-200 h-full">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 fill-yellow-500 text-yellow-500"
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-lg text-gray-700 font-medium mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>

                {/* Author */}
                <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-bold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.city}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          {...fadeInUp}
          className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-12 border border-orange-200"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Trusted by Zimbabwe's Best
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 mb-2">99%</div>
              <p className="text-sm text-gray-600">Satisfaction Rate</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 mb-2">48h</div>
              <p className="text-sm text-gray-600">Delivery Promise</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 mb-2">ISO</div>
              <p className="text-sm text-gray-600">Certified Dealer</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 mb-2">24/7</div>
              <p className="text-sm text-gray-600">Customer Support</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
