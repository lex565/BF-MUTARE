import { Navbar } from '@/app/components/Navbar'
import { Hero } from '@/app/components/Hero'
import { HowItWorks } from '@/app/components/HowItWorks'
import { Fleet } from '@/app/components/Fleet'
import { Features } from '@/app/components/Features'
import { Testimonials } from '@/app/components/Testimonials'
import { Team } from '@/app/components/Team'
import { Contact } from '@/app/components/Contact'
import { Footer } from '@/app/components/Footer'

export default function Home() {
  return (
    <main className="bg-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Fleet />
      <Features />
      <Testimonials />
      <Team />
      <Contact />
      <Footer />
    </main>
  )
}
