'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, MessageCircle } from 'lucide-react'

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed w-full top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">BF</span>
            </div>
            <span className="font-bold text-lg text-gray-900">BF Mutare</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#home" className="text-gray-700 hover:text-orange-600 transition">
              Home
            </Link>
            <Link href="#how-it-works" className="text-gray-700 hover:text-orange-600 transition">
              How It Works
            </Link>
            <Link href="#fleet" className="text-gray-700 hover:text-orange-600 transition">
              Fleet
            </Link>
            <Link href="#team" className="text-gray-700 hover:text-orange-600 transition">
              Team
            </Link>
            <Link href="#contact" className="text-gray-700 hover:text-orange-600 transition">
              Contact
            </Link>
          </div>

          {/* WhatsApp Button + Mobile Menu */}
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/263123456789"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
            >
              <MessageCircle size={18} />
              <span className="text-sm font-medium">WhatsApp</span>
            </a>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-200 pb-4 space-y-2">
            <Link href="#home" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
              Home
            </Link>
            <Link href="#how-it-works" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
              How It Works
            </Link>
            <Link href="#fleet" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
              Fleet
            </Link>
            <Link href="#team" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
              Team
            </Link>
            <Link href="#contact" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
              Contact
            </Link>
            <a
              href="https://wa.me/263123456789"
              className="block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              WhatsApp
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}
