import { useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'

export function useCounter(end: number, duration: number = 2) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true })

  useEffect(() => {
    if (!inView) return

    const steps = 60
    const increment = end / steps
    const stepDuration = (duration * 1000) / steps
    let current = 0

    const interval = setInterval(() => {
      current += increment
      if (current >= end) {
        setCount(end)
        clearInterval(interval)
      } else {
        setCount(Math.floor(current))
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [inView, end, duration])

  return { count, ref }
}
