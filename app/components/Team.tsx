'use client'

import { motion } from 'framer-motion'
import team from '@/app/data/team.json'
import { fadeInUp, staggerContainer, staggerItem } from '@/app/lib/animations'

export function Team() {
  return (
    <section id="team" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          {...fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Meet Our Team
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Dedicated professionals committed to providing you with the best car import experience.
          </p>
        </motion.div>

        {/* Team Grid */}
        <motion.div
          {...staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {team.map((member) => (
            <motion.div
              key={member.id}
              {...staggerItem}
              whileHover={{ y: -12, transition: { duration: 0.3 } }}
              className="group"
            >
              <div className="text-center">
                {/* Image */}
                <div className="mb-6 relative overflow-hidden rounded-xl">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Info */}
                <h3 className="text-2xl font-bold text-gray-900 mb-1">
                  {member.name}
                </h3>
                <p className="text-orange-600 font-semibold text-lg mb-3">
                  {member.role}
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {member.bio}
                </p>

                {/* Social Links (placeholder for future) */}
                <div className="flex gap-4 justify-center mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-orange-600 hover:text-white transition-colors text-gray-600">
                    f
                  </button>
                  <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-orange-600 hover:text-white transition-colors text-gray-600">
                    🔗
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Company Values */}
        <motion.div
          {...fadeInUp}
          className="mt-20 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-12 border border-orange-200"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Our Core Values
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-3">Integrity</h4>
              <p className="text-gray-700">
                We believe in transparency and honest dealings. Every car, every transaction, every interaction built on trust.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-3">Excellence</h4>
              <p className="text-gray-700">
                We don't compromise on quality. Every vehicle is inspected and certified to the highest standards.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-3">Service</h4>
              <p className="text-gray-700">
                Your satisfaction is our mission. Available 24/7 to support you before, during, and after your purchase.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
