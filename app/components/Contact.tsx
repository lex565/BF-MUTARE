'use client'

import { motion } from 'framer-motion'
import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'

interface ContactFormData {
  name: string
  email: string
  phone: string
  carInterest: string
  budget: string
  message: string
}

export function Contact() {
  const { register, handleSubmit, formState: { errors } } = useForm<ContactFormData>()

  const onSubmit = (data: ContactFormData) => {
    // Send to WhatsApp as placeholder
    const message = `New Inquiry:\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nCar Interest: ${data.carInterest}\nBudget: ${data.budget}\nMessage: ${data.message}`
    const whatsappUrl = `https://wa.me/263123456789?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Ready to Get Your Car?
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Fill out the form below or reach out directly. Our team will get back to you within 2 hours.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            {/* Phone */}
            <a
              href="tel:+263123456789"
              className="flex items-start gap-4 p-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/50 transition-all group"
            >
              <div className="p-3 rounded-lg bg-orange-600 text-white group-hover:scale-110 transition-transform">
                <Phone size={24} />
              </div>
              <div>
                <h4 className="font-bold mb-1">Call Us</h4>
                <p className="text-gray-300">+263 (0) 123 456 789</p>
                <p className="text-sm text-gray-400">Mon-Sun, 8AM-6PM ZST</p>
              </div>
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/263123456789"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-green-500/50 transition-all group"
            >
              <div className="p-3 rounded-lg bg-green-500 text-white group-hover:scale-110 transition-transform">
                <MessageCircle size={24} />
              </div>
              <div>
                <h4 className="font-bold mb-1">WhatsApp</h4>
                <p className="text-gray-300">+263 (0) 123 456 789</p>
                <p className="text-sm text-gray-400">Instant replies</p>
              </div>
            </a>

            {/* Email */}
            <a
              href="mailto:info@bfmutare.co.zw"
              className="flex items-start gap-4 p-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 transition-all group"
            >
              <div className="p-3 rounded-lg bg-blue-600 text-white group-hover:scale-110 transition-transform">
                <Mail size={24} />
              </div>
              <div>
                <h4 className="font-bold mb-1">Email</h4>
                <p className="text-gray-300">info@bfmutare.co.zw</p>
                <p className="text-sm text-gray-400">Response within 24h</p>
              </div>
            </a>

            {/* Location */}
            <div className="flex items-start gap-4 p-6 rounded-lg bg-white/5 border border-white/10">
              <div className="p-3 rounded-lg bg-purple-600 text-white">
                <MapPin size={24} />
              </div>
              <div>
                <h4 className="font-bold mb-1">Visit Us</h4>
                <p className="text-gray-300">BF Mutare Headquarters</p>
                <p className="text-sm text-gray-400">Mutare, Zimbabwe</p>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onSubmit={handleSubmit(onSubmit)}
            className="lg:col-span-2 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold mb-2">Full Name</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  type="text"
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none transition-colors"
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold mb-2">Email Address</label>
                <input
                  {...register('email', { required: 'Email is required' })}
                  type="email"
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none transition-colors"
                />
                {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold mb-2">Phone Number</label>
                <input
                  {...register('phone', { required: 'Phone is required' })}
                  type="tel"
                  placeholder="+263 123 456 789"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none transition-colors"
                />
                {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone.message}</p>}
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-semibold mb-2">Budget Range ($)</label>
                <select
                  {...register('budget', { required: 'Budget is required' })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-orange-500 focus:outline-none transition-colors"
                >
                  <option value="">Select budget</option>
                  <option value="5000-8000">$5,000 - $8,000</option>
                  <option value="8000-12000">$8,000 - $12,000</option>
                  <option value="12000-15000">$12,000 - $15,000</option>
                  <option value="15000+">$15,000+</option>
                </select>
                {errors.budget && <p className="text-red-400 text-sm mt-1">{errors.budget.message}</p>}
              </div>
            </div>

            {/* Car Interest */}
            <div>
              <label className="block text-sm font-semibold mb-2">Car Interest (Make/Model)</label>
              <input
                {...register('carInterest')}
                type="text"
                placeholder="e.g., Toyota Corolla, Honda Civic"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-semibold mb-2">Message</label>
              <textarea
                {...register('message')}
                placeholder="Tell us more about what you're looking for..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-4 rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-orange-600/50 hover:scale-105 transition-all duration-300"
            >
              Send Inquiry via WhatsApp
            </button>

            <p className="text-sm text-gray-400 text-center">
              We'll respond within 2 hours during business hours. Your information is safe with us.
            </p>
          </motion.form>
        </div>
      </div>
    </section>
  )
}
