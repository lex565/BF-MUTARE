'use client'

import Link from 'next/link'
import { Share2, MessageCircle, Phone, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">BF</span>
                </div>
                <span className="font-bold text-lg">BF Mutare</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Zimbabwe's gateway to affordable Japanese cars. Quality vehicles, transparent pricing, nationwide delivery.
              </p>
              <div className="flex gap-4">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-orange-600 rounded transition">
                  <Share2 size={20} />
                </a>
                <a href="https://wa.me/263123456789" target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-green-600 rounded transition">
                  <MessageCircle size={20} />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold mb-4 text-lg">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="#home" className="hover:text-orange-500 transition">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="hover:text-orange-500 transition">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="#fleet" className="hover:text-orange-500 transition">
                    Fleet
                  </Link>
                </li>
                <li>
                  <Link href="#team" className="hover:text-orange-500 transition">
                    Team
                  </Link>
                </li>
                <li>
                  <Link href="#contact" className="hover:text-orange-500 transition">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-bold mb-4 text-lg">Contact</h4>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-2">
                  <Phone size={18} />
                  <a href="tel:+263123456789" className="hover:text-orange-500 transition">
                    +263 (0) 123 456 789
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail size={18} />
                  <a href="mailto:info@bfmutare.co.zw" className="hover:text-orange-500 transition">
                    info@bfmutare.co.zw
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle size={18} />
                  <a href="https://wa.me/263123456789" target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 transition">
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>

            {/* Hours */}
            <div>
              <h4 className="font-bold mb-4 text-lg">Business Hours</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Monday - Friday: 8:00 AM - 6:00 PM</li>
                <li>Saturday: 10:00 AM - 4:00 PM</li>
                <li>Sunday: Closed</li>
                <li className="pt-2 text-orange-500">
                  24/7 WhatsApp Support Available
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 text-sm">
          <p>
            © 2026 BF Mutare. All rights reserved. Proudly serving Zimbabwe since 2020.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-orange-500 transition">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-orange-500 transition">
              Terms of Service
            </Link>
            <Link href="#" className="hover:text-orange-500 transition">
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
