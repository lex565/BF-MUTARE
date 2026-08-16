import type { Metadata } from 'next'

import { DesignPreview } from '@/app/components/shop/DesignPreview'

export const metadata: Metadata = {
  title: 'Customer journey design preview',
  robots: { index: false, follow: false },
}

export default function DesignPreviewPage() {
  return <DesignPreview />
}
