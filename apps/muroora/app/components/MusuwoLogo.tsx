import Image from 'next/image'

export function MusuwoLogo(){return <span className="flex items-center gap-3"><Image src="/musuwo-logo.png" alt="Musuwo" width={54} height={54} className="size-12 object-contain" priority/><span className="font-display text-h3 font-extrabold tracking-tight text-ink">Musuwo</span></span>}
