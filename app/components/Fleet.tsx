'use client'

import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import cars from '@/app/data/cars.json'

export function Fleet() {
  return (
    <section id="fleet" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Featured Fleet
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Browse our latest arrivals from Japan. All vehicles inspected and ready for delivery.
          </p>
        </motion.div>

        {/* Cars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {cars.map((car, index) => (
            <motion.div
              key={car.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200">
                {/* Image */}
                <div className="relative overflow-hidden h-60">
                  <img
                    src={car.image}
                    alt={`${car.make} ${car.model}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  {/* Badge */}
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-4 py-2 rounded-full font-bold">
                    ${car.price.toLocaleString()}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {car.make} {car.model}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">{car.year} • {car.mileage}</p>

                  {/* Details */}
                  <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">YEAR</p>
                      <p className="text-lg font-bold text-gray-900">{car.year}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">MILEAGE</p>
                      <p className="text-lg font-bold text-gray-900">{car.mileage}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">STATUS</p>
                      <p className="text-lg font-bold text-green-600">Available</p>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <a
                    href={`https://wa.me/263123456789?text=Interested%20in%20${car.year}%20${car.make}%20${car.model}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-orange-200 transition-all"
                  >
                    <MessageCircle size={18} />
                    Inquire Now
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* View More CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <button className="bg-gray-900 text-white px-8 py-4 rounded-lg font-semibold hover:bg-orange-600 transition-colors">
            View All Vehicles
          </button>
        </motion.div>
      </div>
    </section>
  )
}
