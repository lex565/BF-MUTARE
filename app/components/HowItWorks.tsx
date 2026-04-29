'use client'

import { motion } from 'framer-motion'
import { Search, Plane, FileCheck, Truck } from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Find & Browse',
    description: 'Explore our verified inventory of Japanese vehicles. Filter by make, model, year, and budget.',
    icon: Search,
  },
  {
    number: 2,
    title: 'Import & Arrange',
    description: 'We handle all Japan-to-Zimbabwe logistics. Secure customs clearance and full documentation.',
    icon: Plane,
  },
  {
    number: 3,
    title: 'Inspect & Clear',
    description: 'Every vehicle is inspected and certified. Full transparency on vehicle history and condition.',
    icon: FileCheck,
  },
  {
    number: 4,
    title: 'Deliver to Door',
    description: 'Fast nationwide delivery. Your car arrives at your location with all paperwork ready.',
    icon: Truck,
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Simple Process, Amazing Results
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            From finding your dream car in Japan to driving it in Zimbabwe, we handle everything.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                {/* Card */}
                <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-all group">
                  {/* Number Circle */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg mb-6 group-hover:scale-110 transition-transform">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <Icon className="w-10 h-10 text-orange-600 mb-4" />

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                </div>

                {/* Arrow Connector (hidden on mobile and last item) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 text-2xl text-orange-300 transform -translate-y-1/2">
                    →
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Why Choose Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-12 border border-orange-200"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Why BF Mutare?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">🔍 Verified Quality</h4>
              <p className="text-gray-600 text-sm">Direct imports from trusted Japanese suppliers with full inspection history.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">💰 Best Prices</h4>
              <p className="text-gray-600 text-sm">Cut out middlemen. Direct Japan imports = lowest prices in Zimbabwe.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">🚚 Fast Delivery</h4>
              <p className="text-gray-600 text-sm">Average delivery time: 48 hours nationwide. Car at your door.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
