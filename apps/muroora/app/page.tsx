import { MusuwoHomeShell } from '@/app/components/marketplace/MusuwoHomeShell'

/**
 * The homepage.
 *
 * Was rendering `DesignPreview` with `preview={false}`, which only hid the
 * "design preview" banner - the catalogue, cart, login and order confirmation
 * underneath were all simulated, so the live site looked like a working shop
 * and nothing reached the database.
 *
 * `HomeShell` keeps that approved design and points every action at the real
 * route. DesignPreview stays at /design-preview, where sample data is the
 * point and the banner says so.
 */
export default function HomePage() {
  return <MusuwoHomeShell />
}
