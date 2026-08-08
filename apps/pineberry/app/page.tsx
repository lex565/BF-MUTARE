import { Masthead } from '@/app/components/Masthead'
import { Statement } from '@/app/components/Statement'
import { Companies } from '@/app/components/Companies'
import { Approach } from '@/app/components/Approach'
import { Colophon } from '@/app/components/Colophon'

export default function Home() {
  return (
    <>
      <Masthead />
      <main>
        <Statement />
        <Companies />
        <Approach />
      </main>
      <Colophon />
    </>
  )
}
