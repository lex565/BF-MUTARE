import type { Metadata } from 'next'
import { HomeShell } from '@/app/components/shop/HomeShell'

export const metadata:Metadata={title:'Muroora Mart · Founding Merchant'}
export default function MurooraMartStore(){return <><div className="bg-accent px-gutter py-2 text-center font-mono text-micro uppercase tracking-label text-white">Muroora Mart · Musuwo Founding Merchant · Business #001</div><HomeShell/></>}
