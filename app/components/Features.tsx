'use client'

import { motion } from 'framer-motion'
import {
  CheckCircle2,
  DollarSign,
  Truck,
  Headphones,
  CreditCard,
  Shield,
} from 'lucide-react'
import features from '@/app/data/features.json'

const iconMap: Record<string, React.ReactNode> = {
  CheckCircle2: <CheckCircle2 className="w-8 h-8" />,
  DollarSign: <DollarSign className="w-8 h-8" />,
  Truck: <Truck className="w-8 h-8" />,
  Headphones: <Headphones className="w-8 h-8" />,
  CreditCard: <CreditCard className="w-8 h-8" />,
  Shield: <Shield className="w-8 h-8" />,
}

export function Features() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Why Choose BF Mutare?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Industry-leading service. Trusted by thousands. Zimbabwe's most reliable Japanese car import partner.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon]
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="relative p-8 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-lg hover:border-orange-200 transition-all duration-300 h-full">
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />

                  {/* Icon */}
                  <div className="relative mb-6 inline-block p-4 rounded-lg bg-gradient-to-br from-yellow-100 to-orange-100 text-orange-600 group-hover:from-yellow-200 group-hover:to-orange-200 transition-colors duration-300">
                    {Icon}
                  </div>

                  {/* Content */}
                  <div className="relative">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-orange-600 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>

                    {/* Arrow */}
                    <div className="mt-4 text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Trust Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">1,200+</div>
              <p className="text-blue-100">Happy Customers</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">48h</div>
              <p className="text-blue-100">Average Delivery</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">5★</div>
              <p className="text-blue-100">Customer Rating</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
