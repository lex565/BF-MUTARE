import type { Metadata } from 'next'
import { MarketplacePreview } from './MarketplacePreview'

export const metadata:Metadata={title:'SME Marketplace preview',robots:{index:false,follow:false}}
export default function MarketplacePage(){return <MarketplacePreview/>}
