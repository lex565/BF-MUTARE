import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/supabase';
import { useMyOrders } from './src/liveData';
import { Image, ImageBackground, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CartMap, CustomerFlow, FlowRoute, PRODUCTS } from './src/CustomerFlow';
import { RiderFlow } from './src/RiderFlow';
import { AdminFlow } from './src/AdminFlow';

const C = { ink: '#17372D', forest: '#235643', cream: '#F7F3E9', paper: '#FFFDF8', gold: '#E7A83E', coral: '#D96B4A', sage: '#DDE7D7', muted: '#6E7B74' };
const categories = [
  ['Fresh', '🥬', '#DCE9D6'], ['Pantry', '🍚', '#F2E3C6'], ['Drinks', '🥤', '#D9E9EA'],
  ['Home', '✨', '#EEE0D9'], ['Baby', '🌙', '#E4E0ED'],
];
/**
 * Who is actually signed in, or nobody.
 *
 * The account screen showed a hard-coded "Tana M." to every person who opened
 * it, so a tester saw the owner's name on their own phone and reasonably
 * concluded they were signed in as him. An identity is either real or it is
 * absent; there is no sensible placeholder for one.
 */
function useCurrentUser() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, next) => setSession(next),
    );
    return () => subscription.unsubscribe();
  }, []);

  if (!session?.user) return null;

  const meta = session.user.user_metadata as { full_name?: string } | undefined;
  const name = meta?.full_name?.trim() || session.user.email || 'Your account';
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return { name, initials, email: session.user.email ?? '' };
}

type Tab = 'Home' | 'Shop' | 'Orders' | 'Account';

export default function App() {
  const [tab, setTab] = useState<Tab>('Home');
  const [cart, setCart] = useState<CartMap>({});
  const [flow, setFlow] = useState<FlowRoute | null>(null);
  const [riderOpen, setRiderOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(1);
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const add = (id: number) => setCart(current => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  const openProduct = (id: number) => { setSelectedId(id); setFlow('product'); };
  if (riderOpen) return <RiderFlow close={() => setRiderOpen(false)} />;
  if (adminOpen) return <AdminFlow close={() => setAdminOpen(false)} />;
  if (flow) return <CustomerFlow route={flow} setRoute={setFlow} selectedId={selectedId} setSelectedId={setSelectedId} cart={cart} setCart={setCart} />;
  return (
    <SafeAreaView style={s.viewport}>
      <StatusBar style="dark" />
      <View style={s.phone}>
        {tab === 'Home' ? <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <View><Text style={s.kicker}>DELIVERING TO</Text><Text style={s.location}>Mutare Central ⌄</Text></View>
            <Pressable style={s.bag} onPress={() => setFlow('cart')}><Text style={s.bagIcon}>□</Text>{cartCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{cartCount}</Text></View>}</Pressable>
          </View>
          <View style={s.search}>
            <Text style={s.searchIcon}>⌕</Text><TextInput placeholder="Search groceries and essentials" placeholderTextColor="#829087" style={s.input} onFocus={() => setTab('Shop')} />
            <Pressable accessibilityLabel="Open product filters" style={s.filter} onPress={() => setTab('Shop')}><Text style={s.filterText}>☷</Text></Pressable>
          </View>
          <ImageBackground source={require('./assets/muroora-kitchen.jpg')} style={s.hero} imageStyle={s.heroImage} resizeMode="cover">
            <View style={s.shade} />
            <View style={s.heroCopy}>
              <View style={s.logoPlate}><Image source={require('./assets/muroora-logo.png')} style={s.heroLogo} resizeMode="contain" /></View>
              <Text style={s.heroTitle}>Home is closer{`\n`}than you think.</Text>
              <Text style={s.heroText}>Send everyday goodness to the people you love in Zimbabwe.</Text>
              <Pressable style={s.heroButton} onPress={() => setTab('Shop')}><Text style={s.heroButtonText}>Start shopping  →</Text></Pressable>
            </View>
          </ImageBackground>
          <Heading kicker="FIND IT FAST" title="Shop by category" onPress={() => setTab('Shop')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>
            {categories.map(([name, icon, color]) => <Pressable key={name} style={s.category} onPress={() => setTab('Shop')}><View style={[s.catIcon, { backgroundColor: color }]}><Text style={s.emoji}>{icon}</Text></View><Text style={s.catLabel}>{name}</Text></Pressable>)}
          </ScrollView>
          <Pressable style={s.delivery} onPress={() => setTab('Orders')}>
            <View style={s.deliveryIcon}><Text style={s.deliveryEmoji}>🛵</Text></View>
            <View style={s.deliveryCopy}><Text style={s.deliveryTitle}>Local delivery, handled with care</Text><Text style={s.deliveryText}>Track every step from our shelves to their door.</Text></View>
            <Text style={s.arrow}>›</Text>
          </Pressable>
          <Heading kicker="POPULAR THIS WEEK" title="Pantry favourites" onPress={() => setTab('Shop')} />
          <View style={s.grid}>{PRODUCTS.map(({id, name, detail, price, icon, tint}) => (
            <View key={id} style={s.card}>
              <Pressable style={[s.productImage, { backgroundColor: tint }]} onPress={() => openProduct(id)}><Text style={s.productEmoji}>{icon}</Text><Text style={s.heart}>♡</Text></Pressable>
              <Text style={s.productName}>{name}</Text><Text style={s.detail}>{detail}</Text>
              <View style={s.productFooter}><Text style={s.price}>${price.toFixed(2)}</Text><Pressable style={s.add} onPress={() => add(id)}><Text style={s.addText}>+</Text></Pressable></View>
            </View>
          ))}</View>
        </ScrollView> : <DemoScreen tab={tab} cartCount={cartCount} add={add} openProduct={openProduct} openFlow={setFlow} openRider={() => setRiderOpen(true)} openAdmin={() => setAdminOpen(true)} />}
        <View style={s.tabs}>{([['Home','⌂'],['Shop','◈'],['Orders','▤'],['Account','○']] as [Tab,string][]).map(([name, icon]) => (
          <Pressable key={name} style={s.tab} onPress={() => setTab(name)}><View style={[s.tabIconWrap, tab === name && s.tabActive]}><Text style={[s.tabIcon, tab === name && s.tabIconActive]}>{icon}</Text></View><Text style={[s.tabLabel, tab === name && s.tabLabelActive]}>{name}</Text></Pressable>
        ))}</View>
      </View>
    </SafeAreaView>
  );
}

function Heading({ kicker, title, onPress }: { kicker: string; title: string; onPress: () => void }) {
  return <View style={s.heading}><View><Text style={s.kicker}>{kicker}</Text><Text style={s.title}>{title}</Text></View><Pressable onPress={onPress}><Text style={s.seeAll}>See all</Text></Pressable></View>;
}

function DemoScreen({ tab, cartCount, add, openProduct, openFlow, openRider, openAdmin }: { tab: Exclude<Tab, 'Home'>; cartCount: number; add: (id:number) => void; openProduct: (id:number) => void; openFlow: (route:FlowRoute) => void; openRider: () => void; openAdmin:()=>void }) {
  const me = useCurrentUser();
  const orders = useMyOrders();
  const [category,setCategory]=useState('All');
  if (tab === 'Shop') return (
    <ScrollView contentContainerStyle={s.demoContent} showsVerticalScrollIndicator={false}>
      <Text style={s.screenKicker}>MUROORA MART</Text><Text style={s.screenTitle}>Shop essentials</Text>
      <View style={s.search}><Text style={s.searchIcon}>⌕</Text><TextInput placeholder="What are you looking for?" placeholderTextColor="#829087" style={s.input} /><Pressable style={s.cartPill} onPress={() => openFlow('cart')}><Text style={s.cartPillText}>{cartCount} in basket</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{['All', 'Fresh', 'Pantry', 'Drinks', 'Home'].map(x => <Pressable key={x} onPress={()=>setCategory(x)} style={[s.chip, category===x && s.chipActive]}><Text style={[s.chipText, category===x && s.chipTextActive]}>{x}</Text></Pressable>)}</ScrollView>
      <View style={s.grid}>{PRODUCTS.filter(p=>category==='All'||p.category===category).map(({id,name,detail,price,icon,tint}) => <View key={id} style={s.card}><Pressable style={[s.productImage,{backgroundColor:tint}]} onPress={() => openProduct(id)}><Text style={s.productEmoji}>{icon}</Text></Pressable><Pressable onPress={() => openProduct(id)}><Text style={s.productName}>{name}</Text><Text style={s.detail}>{detail}</Text></Pressable><View style={s.productFooter}><Text style={s.price}>${price.toFixed(2)}</Text><Pressable style={s.add} onPress={() => add(id)}><Text style={s.addText}>+</Text></Pressable></View></View>)}</View>
    </ScrollView>
  );
  if (tab === 'Orders') return (
    <ScrollView contentContainerStyle={s.demoContent}>
      <Text style={s.screenKicker}>YOUR DELIVERIES</Text><Text style={s.screenTitle}>Orders</Text>
      {orders.loading ? (
        <Text style={s.rowSub}>Loading your orders…</Text>
      ) : orders.data.length > 0 ? (
        orders.data.map((o) => (
          <Pressable key={o.orderNumber} style={s.activeOrder} onPress={() => openFlow('tracking')}>
            <View style={s.orderTop}><Text style={s.orderNumber}>{o.orderNumber}</Text><Text style={s.status}>{o.label.toUpperCase()}</Text></View>
            <Text style={s.orderTitle}>{o.itemCount} {o.itemCount === 1 ? 'item' : 'items'} for {o.recipientName}</Text>
            <Text style={s.orderAddress}>{o.deliverySuburb} · {o.total}</Text>
            <Text style={s.rowSub}>{o.blurb}</Text>
          </Pressable>
        ))
      ) : (
        <View style={s.emptyState}>
          <Text style={s.emptyStateTitle}>{orders.signedIn ? 'No orders yet' : 'Sign in to see your orders'}</Text>
          <Text style={s.emptyStateBody}>{orders.signedIn ? 'Anything you order will appear here, with its progress.' : 'Your orders and their delivery progress live in your account.'}</Text>
        </View>
      )}
    </ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={s.demoContent}>
      <Text style={s.screenKicker}>WELCOME BACK</Text><Text style={s.screenTitle}>My account</Text>
      {me ? (
        <View style={s.profile}><View style={s.avatar}><Text style={s.avatarText}>{me.initials}</Text></View><View><Text style={s.profileName}>{me.name}</Text><Text style={s.rowSub}>{me.email}</Text></View></View>
      ) : (
        <View style={s.profile}><View style={s.avatar}><Text style={s.avatarText}>·</Text></View><View><Text style={s.profileName}>Not signed in</Text><Text style={s.rowSub}>Sign in to see your orders</Text></View></View>
      )}
      <Pressable style={s.riderCard} onPress={openRider}><View style={s.riderCardIcon}><Text style={s.riderEmoji}>🛵</Text></View><View style={s.riderCardCopy}><Text style={s.riderCardKicker}>RIDER PROTOTYPE</Text><Text style={s.riderCardTitle}>Open the delivery app</Text><Text style={s.riderCardText}>Test onboarding, a live job and earnings.</Text></View><Text style={s.riderCardArrow}>›</Text></Pressable>
      <Pressable style={s.adminCard} onPress={openAdmin}><View style={s.adminCardIcon}><Text style={s.adminIconText}>M</Text></View><View style={s.riderCardCopy}><Text style={s.adminCardKicker}>PROTECTED STAFF ACCESS</Text><Text style={s.adminCardTitle}>Admin tools</Text><Text style={s.adminCardText}>Sign in to manage operations, products and riders.</Text></View><Text style={s.adminCardArrow}>›</Text></Pressable>
      <Text style={s.listTitle}>Your details</Text>{([['▤','Orders & tracking','history'],['⌂','Saved addresses','addresses'],['♡','Saved recipients','recipients'],['○','Profile & preferences','addresses'],['?','Help and support','history']] as [string,string,FlowRoute][]).map(([icon,label,route]) => <Pressable key={label} style={s.listRow} onPress={() => openFlow(route)}><View style={s.rowLabel}><Text style={s.rowIcon}>{icon}</Text><Text style={s.rowTitle}>{label}</Text></View><Text style={s.rowArrow}>›</Text></Pressable>)}
      <View style={s.betaIdentity}><Text style={s.betaName}>Muroora Beta</Text><Text style={s.betaVersion}>Version 0.1.0</Text></View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  viewport:{flex:1,backgroundColor:Platform.OS==='web'?'#E9E6DE':C.paper}, phone:{flex:1,width:'100%',maxWidth:440,alignSelf:'center',backgroundColor:C.paper,...Platform.select({web:{boxShadow:'0 0 50px rgba(23,55,45,.12)'}})}, content:{paddingBottom:110},
  header:{paddingHorizontal:22,paddingTop:18,paddingBottom:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, kicker:{fontSize:9,letterSpacing:1.4,fontWeight:'800',color:C.coral,marginBottom:3},location:{fontSize:19,fontWeight:'800',color:C.ink}, bag:{width:44,height:44,borderRadius:22,backgroundColor:C.cream,alignItems:'center',justifyContent:'center'},bagIcon:{fontSize:25,color:C.ink,marginTop:-5},badge:{position:'absolute',right:-1,top:-2,minWidth:19,height:19,borderRadius:10,backgroundColor:C.coral,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.paper},badgeText:{color:'#fff',fontSize:10,fontWeight:'800'},
  search:{marginHorizontal:22,height:52,paddingLeft:16,paddingRight:6,borderRadius:16,flexDirection:'row',alignItems:'center',backgroundColor:C.cream,marginBottom:18},searchIcon:{fontSize:23,color:C.ink,transform:[{rotate:'-20deg'}]},input:{flex:1,paddingHorizontal:10,fontSize:14,color:C.ink},filter:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:C.forest},filterText:{color:'#fff',fontSize:20},
  hero:{marginHorizontal:14,height:360,justifyContent:'flex-end',overflow:'hidden',borderRadius:28,backgroundColor:C.forest},heroImage:{borderRadius:28,transform:[{scale:1.03}]},shade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(15,48,38,.5)'},heroCopy:{padding:25},logoPlate:{width:146,height:50,paddingHorizontal:10,paddingVertical:5,backgroundColor:'rgba(255,255,255,.94)',borderRadius:12,marginBottom:14},heroLogo:{width:'100%',height:'100%'},heroTitle:{color:'#fff',fontSize:35,lineHeight:38,letterSpacing:-1.2,fontWeight:'800'},heroText:{color:'rgba(255,255,255,.9)',fontSize:14,lineHeight:20,marginTop:10,maxWidth:295},heroButton:{alignSelf:'flex-start',paddingVertical:14,paddingHorizontal:18,backgroundColor:C.gold,borderRadius:23,marginTop:18},heroButtonText:{color:C.ink,fontSize:14,fontWeight:'800'},
  heading:{paddingHorizontal:22,marginTop:30,marginBottom:16,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},title:{color:C.ink,fontSize:22,lineHeight:28,fontWeight:'800',letterSpacing:-.5},seeAll:{color:C.forest,fontWeight:'700',fontSize:13,paddingBottom:3},categories:{paddingHorizontal:22,gap:17},category:{alignItems:'center',gap:8},catIcon:{width:62,height:62,borderRadius:21,alignItems:'center',justifyContent:'center'},emoji:{fontSize:28},catLabel:{color:C.ink,fontSize:12,fontWeight:'600'},
  delivery:{marginHorizontal:22,marginTop:30,padding:15,borderRadius:20,backgroundColor:C.forest,flexDirection:'row',alignItems:'center'},deliveryIcon:{width:46,height:46,borderRadius:15,backgroundColor:'rgba(255,255,255,.13)',justifyContent:'center',alignItems:'center'},deliveryEmoji:{fontSize:24},deliveryCopy:{flex:1,paddingHorizontal:13},deliveryTitle:{color:'#fff',fontSize:13,fontWeight:'800',marginBottom:3},deliveryText:{color:'rgba(255,255,255,.72)',fontSize:11,lineHeight:15},arrow:{color:'#fff',fontSize:28},
  grid:{paddingHorizontal:17,flexDirection:'row',flexWrap:'wrap'},card:{width:'50%',paddingHorizontal:5,marginBottom:20},productImage:{height:158,borderRadius:20,alignItems:'center',justifyContent:'center',marginBottom:10},productEmoji:{fontSize:62},heart:{position:'absolute',right:10,top:8,width:31,height:31,borderRadius:16,backgroundColor:'rgba(255,255,255,.82)',textAlign:'center',fontSize:20,color:C.ink},productName:{color:C.ink,fontSize:14,fontWeight:'800',paddingHorizontal:3},detail:{color:C.muted,fontSize:11,marginTop:3,paddingHorizontal:3},productFooter:{marginTop:9,paddingHorizontal:3,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},price:{color:C.ink,fontSize:16,fontWeight:'800'},add:{width:32,height:32,borderRadius:16,backgroundColor:C.forest,justifyContent:'center',alignItems:'center'},addText:{color:'#fff',fontSize:22,lineHeight:25},
  tabs:{position:'absolute',left:0,right:0,bottom:0,height:84,paddingTop:9,paddingBottom:15,paddingHorizontal:13,flexDirection:'row',backgroundColor:'rgba(255,253,248,.98)',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#DDE2DB'},tab:{flex:1,alignItems:'center',justifyContent:'center'},tabIconWrap:{width:38,height:31,borderRadius:16,alignItems:'center',justifyContent:'center'},tabActive:{backgroundColor:C.sage},tabIcon:{color:'#89928D',fontSize:20},tabIconActive:{color:C.forest},tabLabel:{color:'#89928D',fontSize:10,fontWeight:'600',marginTop:3},tabLabelActive:{color:C.forest,fontWeight:'800'},
  demoContent:{paddingTop:38,paddingBottom:120},screenKicker:{paddingHorizontal:22,color:C.coral,fontSize:10,fontWeight:'800',letterSpacing:1.6,marginBottom:4},screenTitle:{paddingHorizontal:22,color:C.ink,fontSize:34,fontWeight:'800',letterSpacing:-1,marginBottom:22},chips:{paddingHorizontal:22,gap:8,marginBottom:24},chip:{paddingHorizontal:16,paddingVertical:10,borderRadius:18,backgroundColor:C.cream},chipActive:{backgroundColor:C.forest},chipText:{fontSize:12,fontWeight:'700',color:C.muted},chipTextActive:{color:'#fff'},cartPill:{backgroundColor:C.gold,borderRadius:13,paddingHorizontal:9,paddingVertical:7},cartPillText:{color:C.ink,fontSize:9,fontWeight:'800'},
  activeOrder:{marginHorizontal:22,padding:20,borderRadius:24,backgroundColor:C.cream},orderTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},orderNumber:{fontSize:11,fontWeight:'800',color:C.muted,letterSpacing:.6},status:{fontSize:9,fontWeight:'900',color:C.coral,backgroundColor:'#F5DED7',paddingHorizontal:9,paddingVertical:6,borderRadius:12},orderTitle:{fontSize:20,fontWeight:'800',color:C.ink,marginTop:18},orderAddress:{fontSize:12,color:C.muted,marginTop:4},progress:{height:5,backgroundColor:'#D8DDD6',borderRadius:3,marginTop:22,overflow:'hidden'},progressDone:{height:'100%',width:'72%',backgroundColor:C.gold,borderRadius:3},orderSteps:{flexDirection:'row',justifyContent:'space-between',marginTop:8},stepDone:{fontSize:8,color:C.forest,fontWeight:'700'},step:{fontSize:8,color:'#9AA29D'},track:{height:46,borderRadius:23,backgroundColor:C.forest,alignItems:'center',justifyContent:'center',marginTop:22},trackText:{color:'#fff',fontSize:13,fontWeight:'800'},
  listTitle:{marginHorizontal:22,marginTop:30,marginBottom:10,fontSize:14,fontWeight:'800',color:C.ink},listRow:{marginHorizontal:22,minHeight:64,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DDE2DB',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},rowLabel:{flexDirection:'row',alignItems:'center',gap:14},rowIcon:{width:30,fontSize:19,color:C.forest,textAlign:'center'},rowTitle:{fontSize:13,fontWeight:'700',color:C.ink},rowSub:{fontSize:11,color:C.muted,marginTop:3},rowArrow:{fontSize:26,color:C.muted},profile:{marginHorizontal:22,padding:18,borderRadius:22,backgroundColor:C.cream,flexDirection:'row',alignItems:'center',gap:14},avatar:{width:54,height:54,borderRadius:27,backgroundColor:C.forest,alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontSize:16,fontWeight:'800'},profileName:{fontSize:18,fontWeight:'800',color:C.ink},
  riderCard:{marginHorizontal:22,marginTop:18,padding:16,borderRadius:21,backgroundColor:C.forest,flexDirection:'row',alignItems:'center'},riderCardIcon:{width:48,height:48,borderRadius:16,backgroundColor:'rgba(255,255,255,.13)',alignItems:'center',justifyContent:'center'},riderEmoji:{fontSize:25},riderCardCopy:{flex:1,paddingHorizontal:13},riderCardKicker:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:C.gold},riderCardTitle:{fontSize:14,fontWeight:'900',color:'#fff',marginTop:2},riderCardText:{fontSize:10,color:'rgba(255,255,255,.67)',marginTop:3},riderCardArrow:{fontSize:29,color:'#fff'},adminCard:{marginHorizontal:22,marginTop:10,padding:16,borderRadius:21,backgroundColor:C.cream,borderWidth:1,borderColor:'#D7DDD8',flexDirection:'row',alignItems:'center'},adminCardIcon:{width:48,height:48,borderRadius:16,backgroundColor:C.gold,alignItems:'center',justifyContent:'center'},adminIconText:{fontSize:18,fontWeight:'900',color:C.ink},adminCardKicker:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:C.coral},adminCardTitle:{fontSize:14,fontWeight:'900',color:C.ink,marginTop:2},adminCardText:{fontSize:10,color:C.muted,marginTop:3},adminCardArrow:{fontSize:29,color:C.forest},emptyState:{marginHorizontal:22,marginTop:14,padding:20,borderRadius:20,backgroundColor:C.cream},emptyStateTitle:{fontSize:13,fontWeight:'900',color:C.ink},emptyStateBody:{fontSize:10.5,lineHeight:16,color:C.muted,marginTop:5},betaIdentity:{alignItems:'center',paddingTop:28,paddingBottom:10},betaName:{fontSize:11,fontWeight:'800',color:C.ink},betaVersion:{fontSize:9,color:C.muted,marginTop:3},
});
