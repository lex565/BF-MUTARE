import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type SocialIconName = 'whatsapp'|'facebook'|'instagram'|'share';

export function SocialIcon({ name, size=42 }: { name:SocialIconName; size?:number }) {
  if(name==='instagram') return <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Instagram">
    <Defs><LinearGradient id="ig" x1="4" y1="44" x2="44" y2="4"><Stop offset="0" stopColor="#FFD600"/><Stop offset=".42" stopColor="#FF0169"/><Stop offset="1" stopColor="#7638FA"/></LinearGradient></Defs>
    <Rect x="3" y="3" width="42" height="42" rx="13" fill="url(#ig)"/><Rect x="13" y="13" width="22" height="22" rx="7" fill="none" stroke="#fff" strokeWidth="3"/><Circle cx="24" cy="24" r="5.5" fill="none" stroke="#fff" strokeWidth="3"/><Circle cx="32.5" cy="15.7" r="1.8" fill="#fff"/>
  </Svg>;
  if(name==='facebook') return <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Facebook"><Circle cx="24" cy="24" r="21" fill="#1877F2"/><Path d="M27.4 39V26.2h4.3l.7-5h-5v-3.1c0-1.5.4-2.5 2.6-2.5h2.7v-4.5c-.5-.1-2.1-.2-4-.2-4 0-6.8 2.5-6.8 7v3.3h-4.5v5h4.5V39h5.5Z" fill="#fff"/></Svg>;
  if(name==='whatsapp') return <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="WhatsApp"><Circle cx="24" cy="24" r="21" fill="#25D366"/><Path d="M13.2 35.8 15 29.4a13 13 0 1 1 4.8 4.6l-6.6 1.8Zm7-5.7.4.2a9.4 9.4 0 1 0-2-2l.3.5-1 3.3 3.3-.9Z" fill="#fff"/><Path d="M19.1 17.8c.3-.7.6-.7 1-.7h.7c.2 0 .5.1.6.5l1.1 2.6c.1.3.1.6-.1.8l-.8 1c-.2.2-.3.4-.1.8.6 1.2 1.5 2.2 2.6 3 .9.7 2 1.2 2.4 1 .3-.1 1-1.2 1.3-1.6.2-.3.5-.3.8-.2l2.6 1.2c.4.2.6.3.7.5.1.2.1 1-.2 1.9-.3.9-1.7 1.8-2.5 1.9-.7.1-1.7.2-4.8-1.1-4-1.7-6.6-5.8-6.8-6.1-.2-.3-1.6-2.2-1.6-4.1 0-1.9 1-2.9 1.4-3.3.4-.4.9-.5 1.2-.5h.5Z" fill="#25D366"/>
  </Svg>;
  return <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Share"><Circle cx="24" cy="24" r="21" fill="#235643"/><Path d="M24 31V12m0 0-7 7m7-7 7 7M14 25v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
