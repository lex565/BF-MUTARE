import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { SocialIcon, type SocialIconName } from './SocialIcon';

const C = { ink:'#17372D', forest:'#235643', cream:'#F7F3E9', paper:'#FFFDF8', gold:'#E7A83E', coral:'#D96B4A', sage:'#DDE7D7', muted:'#6E7B74' };

export type Product = { id:number; name:string; detail:string; price:number; icon:string; tint:string; description:string; category:string };
export type CartMap = Record<number, number>;
export type FlowRoute = 'product'|'cart'|'checkout'|'confirmation'|'tracking'|'addresses'|'recipients'|'history';

const STORE_URL = 'https://muroora-mart.vercel.app/shop';
type ShareChannel = 'whatsapp'|'facebook'|'instagram'|'more';

async function shareProduct(product: Product, channel: ShareChannel) {
  const message = `Check out ${product.name} (${product.detail}) for $${product.price.toFixed(2)} at Muroora Mart. ${STORE_URL}`;
  try {
    if (channel === 'whatsapp') {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
      return;
    }
    if (channel === 'facebook') {
      await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(STORE_URL)}&quote=${encodeURIComponent(message)}`);
      return;
    }

    // Instagram has no supported URL that pre-fills a link post. The native
    // share sheet is the safe route and offers Instagram when it is installed.
    if (Platform.OS !== 'web') {
      await Share.share({ title: product.name, message, url: STORE_URL });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: product.name, text: message, url: STORE_URL });
      return;
    }
    await navigator.clipboard.writeText(message);
    if (channel === 'instagram') await Linking.openURL('https://www.instagram.com/');
    Alert.alert('Product link copied', 'Paste it into the app or conversation you want to share it with.');
  } catch (error) {
    // Cancelling the native share sheet is not a product failure.
    if (String(error).toLowerCase().includes('cancel')) return;
    Alert.alert('Could not share', 'Please try again from your phone’s share menu.');
  }
}

type Props = {
  route: FlowRoute;
  setRoute: Dispatch<SetStateAction<FlowRoute | null>>;
  selectedId: number;
  setSelectedId: (id:number) => void;
  cart: CartMap;
  setCart: Dispatch<SetStateAction<CartMap>>;
  products: Product[];
  account: { name:string; email:string; phone:string } | null;
};

export function CustomerFlow({ route, setRoute, selectedId, setSelectedId, cart, setCart, products, account }: Props) {
  const [buyerType, setBuyerType] = useState<'Local'|'Diaspora'|'Diaspora to local'>('Local');
  const [zone, setZone] = useState('Mutare Central');
  const [payment, setPayment] = useState('Pay on delivery');
  const [substitution, setSubstitution] = useState('Contact me first');
  const [favourite,setFavourite]=useState(false);
  const [gpsPin,setGpsPin]=useState('');
  const [locating,setLocating]=useState(false);
  const product = products.find(x => x.id === selectedId) ?? products[0];
  const items = products.filter(x => cart[x.id]);
  const subtotal = useMemo(() => items.reduce((sum,p) => sum + p.price * cart[p.id], 0), [cart, items]);
  const fee = zone === 'Mutare Central' ? 2 : 3.5;
  const count = Object.values(cart).reduce((a,b) => a+b, 0);
  const quantity = product ? cart[product.id] ?? 0 : 0;
  const change = (id:number, by:number) => setCart(current => {
    const next = Math.max(0, (current[id] ?? 0) + by);
    const result = { ...current, [id]: next };
    if (!next) delete result[id];
    return result;
  });
  const back = () => {
    if (route === 'checkout') setRoute('cart');
    else if (route === 'confirmation') setRoute(null);
    else if (route === 'tracking') setRoute('history');
    else setRoute(null);
  };
  const captureLocation=async()=>{
    setLocating(true);
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if(!permission.granted){ Alert.alert('Location permission needed','You can still type the full address and nearby landmarks below.'); return; }
      const current=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      setGpsPin(`${current.coords.latitude.toFixed(6)}, ${current.coords.longitude.toFixed(6)}`);
    } catch { Alert.alert('Could not get a GPS pin','Please type the full address and add clear landmarks instead.'); }
    finally { setLocating(false); }
  };

  if (!product && (route === 'product' || route === 'cart' || route === 'checkout')) return <Frame title="Shop" back={back}><View style={s.emptyBox}><Text style={s.emptyBoxTitle}>No products available</Text><Text style={s.emptyBody}>The shop will appear here once real products have been added.</Text></View></Frame>;

  if (route === 'product') return <Frame title="Product details" back={back} cartCount={count} openCart={() => setRoute('cart')}>
    <View style={[s.productHero,{backgroundColor:product.tint}]}><Text style={s.productEmoji}>{product.icon}</Text><Pressable accessibilityLabel={favourite?'Remove from favourites':'Add to favourites'} onPress={()=>setFavourite(!favourite)} style={s.favourite}><Text style={s.favouriteText}>{favourite?'♥':'♡'}</Text></Pressable></View>
    <Text style={s.productKicker}>IN STOCK · MUROORA MART</Text><Text style={s.productTitle}>{product.name}</Text><Text style={s.productDetail}>{product.detail}</Text>
    <Text style={s.productPrice}>${product.price.toFixed(2)}</Text><Text style={s.description}>{product.description}</Text>
    <View style={s.shareBlock}><Text style={s.shareTitle}>Share this product</Text><View style={s.shareActions}><ShareButton label="WhatsApp" icon="whatsapp" onPress={()=>void shareProduct(product,'whatsapp')} /><ShareButton label="Facebook" icon="facebook" onPress={()=>void shareProduct(product,'facebook')} /><ShareButton label="Instagram" icon="instagram" onPress={()=>void shareProduct(product,'instagram')} /><ShareButton label="More" icon="share" onPress={()=>void shareProduct(product,'more')} /></View></View>
    <View style={s.infoCard}><Text style={s.infoIcon}>🛵</Text><View style={s.grow}><Text style={s.infoTitle}>Delivery around Mutare</Text><Text style={s.infoText}>Fee calculated from the recipient's area at checkout.</Text></View></View>
    <View style={s.stickyAction}>{quantity > 0 && <Quantity value={quantity} minus={() => change(product.id,-1)} plus={() => change(product.id,1)} />}<Pressable style={s.primaryGrow} onPress={() => { change(product.id,1); setRoute('cart'); }}><Text style={s.primaryText}>{quantity ? 'View basket' : 'Add to basket'}</Text></Pressable></View>
  </Frame>;

  if (route === 'cart') return <Frame title="Your basket" back={back} cartCount={count}>
    {items.length === 0 ? <View style={s.empty}><Text style={s.emptyIcon}>🧺</Text><Text style={s.emptyTitle}>Your basket is waiting</Text><Text style={s.emptyText}>Add a few essentials and they will appear here.</Text><Pressable style={s.primary} onPress={() => setRoute(null)}><Text style={s.primaryText}>Continue shopping</Text></Pressable></View> : <>
      <View style={s.notice}><Text style={s.noticeText}>Sold and fulfilled by Muroora Mart · Musuwo Founding Merchant</Text></View>
      {items.map(p => <Pressable key={p.id} style={s.cartRow} onPress={() => {setSelectedId(p.id);setRoute('product')}}><View style={[s.thumb,{backgroundColor:p.tint}]}><Text style={s.thumbEmoji}>{p.icon}</Text></View><View style={s.grow}><Text style={s.rowTitle}>{p.name}</Text><Text style={s.rowSub}>{p.detail}</Text><Text style={s.rowPrice}>${(p.price*cart[p.id]).toFixed(2)}</Text></View><Quantity value={cart[p.id]} minus={() => change(p.id,-1)} plus={() => change(p.id,1)} /></Pressable>)}
      <Summary subtotal={subtotal} fee={fee} />
      <Pressable style={s.primary} onPress={() => setRoute('checkout')}><Text style={s.primaryText}>Continue to checkout · ${(subtotal+fee).toFixed(2)}</Text></Pressable>
    </>}
  </Frame>;

  if (route === 'checkout') return <Frame title="Checkout" back={back} step="Delivery details">
    <Section number="1" title="Where are you ordering from?"><Choice values={['Local','Diaspora','Diaspora to local']} selected={buyerType} onSelect={(x)=>setBuyerType(x as 'Local'|'Diaspora'|'Diaspora to local')} /><Text style={s.help}>{account ? `Using the contact details registered to ${account.name}.` : 'Your registered account contact details will be used.'}</Text></Section>
    <Section number="2" title={buyerType==='Diaspora to local'?'Recipient in Zimbabwe':'Delivery contact'}>
      {buyerType==='Diaspora to local'&&<><Field label="Recipient name" value="" placeholder="Who receives it" /><Field label="Recipient Zimbabwe phone" value="" placeholder="+263 77 000 0000" keyboard="phone-pad" /></>}
      <Field label="Full delivery address" value="" placeholder="House number, street, suburb and city" />
      <Field label="Landmarks and directions" value="" placeholder="Nearby shop, school, gate colour or road" />
      <Pressable style={s.locationButton} disabled={locating} onPress={()=>void captureLocation()}><Text style={s.secondaryText}>{locating?'Finding your location…':gpsPin?'✓ Precise GPS pin added':'Use my precise GPS location'}</Text></Pressable>
      {!!gpsPin&&<Text style={s.help}>GPS pin: {gpsPin}. The typed address will still guide the rider.</Text>}
    </Section>
    <Section number="3" title="Delivery through Musuwo"><Text style={s.help}>Prepared and fulfilled from Muroora Mart. Musuwo coordinates the delivery experience; the independent public rider network remains Coming Soon.</Text><Choice values={['Mutare Central','Dangamvura','Chikanga']} selected={zone} onSelect={setZone} /><View style={s.feeRow}><Text style={s.rowTitle}>Estimated delivery</Text><Text style={s.rowPrice}>${fee.toFixed(2)}</Text></View></Section>
    <Section number="4" title="Order preferences"><Choice values={['Contact me first']} selected={substitution} onSelect={setSubstitution} /><Choice values={['Pay on delivery','EcoCash','OneMoney']} selected={payment} onSelect={setPayment} /></Section>
    <Summary subtotal={subtotal} fee={fee} />
    <Pressable style={s.primary} onPress={() => setRoute('confirmation')}><Text style={s.primaryText}>Place order · ${(subtotal+fee).toFixed(2)}</Text></Pressable>
  </Frame>;

  if (route === 'confirmation') return <Frame title="Order confirmed" back={back}>
    <View style={s.success}><View style={s.successIcon}><Text style={s.checkLarge}>✓</Text></View><Text style={s.successTitle}>The shopping is in motion.</Text><Text style={s.successText}>Your order has been received. We’ll keep you updated as it is prepared and delivered.</Text></View>
    <View style={s.infoCard}><Text style={s.infoIcon}>📍</Text><View style={s.grow}><Text style={s.infoTitle}>Delivery details</Text><Text style={s.infoText}>The address you entered at checkout appears here.</Text></View></View>
    <Pressable style={s.primary} onPress={() => setRoute('tracking')}><Text style={s.primaryText}>Track this order</Text></Pressable><Pressable style={s.secondary} onPress={() => setRoute(null)}><Text style={s.secondaryText}>Return home</Text></Pressable>
  </Frame>;

  if (route === 'tracking') return <Frame title="Track order" back={back}>
    <View style={s.emptyBox}>
      <Text style={s.emptyBoxTitle}>Nothing to track</Text>
      <Text style={s.emptyBody}>Live tracking appears here once you have an order on the way. There is no order to follow at the moment.</Text>
    </View>
    <Timeline title="Order received" detail="What happens after you order" done /><Timeline title="Preparing" detail="Items are picked and packed" /><Timeline title="Driver assigned" detail="A verified rider collects it" /><Timeline title="Delivered" detail="Proof of delivery appears here" last />
    <Pressable style={s.secondary} onPress={()=>Alert.alert('Order support','The support conversation is a demo until the shop contact channel is confirmed.')}><Text style={s.secondaryText}>Get order support</Text></Pressable>
  </Frame>;

  // Nothing invented. Saved addresses and recipients are not stored on the
  // phone yet, and order history comes from the account, so all three are
  // empty until there is something real to show.
  const list: [string, string][] = [];
  const title = route === 'addresses' ? 'Saved addresses' : route === 'recipients' ? 'Saved recipients' : 'Order history';
  return <Frame title={title} back={back}>
    <Text style={s.listIntro}>{route === 'addresses' ? 'Choose addresses faster during checkout.' : route === 'recipients' ? 'Send groceries to loved ones without entering their details again.' : 'Every order and delivery update in one place.'}</Text>
    {list.length === 0 ? (
      <View style={s.emptyBox}>
        <Text style={s.emptyBoxTitle}>{route === 'addresses' ? 'No saved addresses yet' : route === 'recipients' ? 'No saved recipients yet' : 'No orders yet'}</Text>
        <Text style={s.emptyBody}>{route === 'history' ? 'Orders you place will appear here.' : 'Anything you save during checkout will appear here.'}</Text>
      </View>
    ) : list.map(([a,b],i) => <Pressable key={a} style={s.savedRow} onPress={() => route === 'history' && i === 0 ? setRoute('tracking') : undefined}><View style={s.savedIcon}><Text>{route === 'addresses'?'⌂':route === 'recipients'?'♡':'▤'}</Text></View><View style={s.grow}><Text style={s.rowTitle}>{a}</Text><Text style={s.rowSub}>{b}</Text></View><Text style={s.chevron}>›</Text></Pressable>)}
    {route !== 'history' && <Pressable style={s.secondary} onPress={()=>Alert.alert('Add new',`The ${route==='addresses'?'address':'recipient'} editor will save through your signed-in account in the connected beta.`)}><Text style={s.secondaryText}>+ Add new</Text></Pressable>}
  </Frame>;
}

function Frame({ title, back, children, cartCount, openCart, step }: { title:string; back:()=>void; children:React.ReactNode; cartCount?:number; openCart?:()=>void; step?:string }) {
  return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.flowPhone}><View style={s.frameHeader}><Pressable style={s.back} onPress={back}><Text style={s.backText}>‹</Text></Pressable><View style={s.headerCenter}><Text style={s.frameTitle}>{title}</Text>{step&&<Text style={s.stepText}>{step}</Text>}</View>{openCart?<Pressable style={s.miniCart} onPress={openCart}><Text>□</Text>{!!cartCount&&<Text style={s.miniCount}>{cartCount}</Text>}</Pressable>:<View style={s.back}/>}</View><ScrollView contentContainerStyle={s.frameContent} showsVerticalScrollIndicator={false}>{children}</ScrollView></View></SafeAreaView>;
}
function Quantity({ value, minus, plus }: { value:number; minus:()=>void; plus:()=>void }) { return <View style={s.quantity}><Pressable onPress={minus} style={s.qButton}><Text style={s.qText}>−</Text></Pressable><Text style={s.qValue}>{value}</Text><Pressable onPress={plus} style={s.qButton}><Text style={s.qText}>+</Text></Pressable></View>; }
function ShareButton({ label,icon,onPress }: { label:string; icon:SocialIconName; onPress:()=>void }) { return <Pressable accessibilityRole="button" accessibilityLabel={`Share on ${label}`} onPress={onPress} style={({pressed})=>[s.shareButton,pressed&&s.pressed]}><SocialIcon name={icon}/><Text style={s.shareLabel}>{label}</Text></Pressable>; }
function Summary({ subtotal, fee }: { subtotal:number; fee:number }) { return <View style={s.summary}><View style={s.summaryRow}><Text style={s.rowSub}>Subtotal</Text><Text style={s.rowTitle}>${subtotal.toFixed(2)}</Text></View><View style={s.summaryRow}><Text style={s.rowSub}>Delivery</Text><Text style={s.rowTitle}>${fee.toFixed(2)}</Text></View><View style={[s.summaryRow,s.totalRow]}><Text style={s.total}>Total</Text><Text style={s.total}>${(subtotal+fee).toFixed(2)}</Text></View></View>; }
function Section({ number,title,children }: { number:string; title:string; children:React.ReactNode }) { return <View style={s.section}><View style={s.sectionHead}><Text style={s.sectionNumber}>{number}</Text><Text style={s.sectionTitle}>{title}</Text></View>{children}</View>; }
function Field({ label,value,keyboard,placeholder }: { label:string; value:string; keyboard?:'email-address'|'phone-pad'; placeholder?:string }) { return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput style={s.fieldInput} defaultValue={value} placeholder={placeholder} placeholderTextColor="#89958F" keyboardType={keyboard}/></View>; }
function Choice({ values,selected,onSelect }: { values:string[]; selected:string; onSelect:(x:string)=>void }) { return <View style={s.choices}>{values.map(x=><Pressable key={x} style={[s.choice,selected===x&&s.choiceOn]} onPress={()=>onSelect(x)}><View style={[s.radio,selected===x&&s.radioOn]}/><Text style={[s.choiceText,selected===x&&s.choiceTextOn]}>{x}</Text></Pressable>)}</View>; }
function Timeline({title,detail,done,active,last}:{title:string;detail:string;done?:boolean;active?:boolean;last?:boolean}) { return <View style={s.timeline}><View style={s.lineColumn}><View style={[s.dot,(done||active)&&s.dotOn]}>{done&&<Text style={s.dotCheck}>✓</Text>}</View>{!last&&<View style={[s.line,done&&s.lineOn]}/>}</View><View style={s.timelineText}><Text style={[s.rowTitle,active&&{color:C.coral}]}>{title}</Text><Text style={s.rowSub}>{detail}</Text></View></View>; }

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:Platform.OS==='web'?'#E9E6DE':C.paper},flowPhone:{flex:1,width:'100%',maxWidth:440,alignSelf:'center',backgroundColor:C.paper,...Platform.select({web:{boxShadow:'0 0 50px rgba(23,55,45,.12)'}})},frameHeader:{height:68,paddingHorizontal:16,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DDE2DB'},back:{width:42,height:42,borderRadius:21,backgroundColor:C.cream,alignItems:'center',justifyContent:'center'},backText:{fontSize:32,lineHeight:34,color:C.ink,marginTop:-3},headerCenter:{flex:1,alignItems:'center'},frameTitle:{fontSize:16,fontWeight:'800',color:C.ink},stepText:{fontSize:9,color:C.muted,marginTop:2},miniCart:{width:42,height:42,borderRadius:21,backgroundColor:C.cream,alignItems:'center',justifyContent:'center'},miniCount:{position:'absolute',right:-2,top:-3,color:'#fff',backgroundColor:C.coral,minWidth:18,height:18,borderRadius:9,textAlign:'center',fontSize:10,fontWeight:'800'},frameContent:{width:'100%',padding:20,paddingBottom:50},
  productHero:{height:280,borderRadius:28,alignItems:'center',justifyContent:'center',marginBottom:24},productEmoji:{fontSize:110},favourite:{position:'absolute',right:16,top:16,width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,.86)',alignItems:'center',justifyContent:'center'},favouriteText:{fontSize:27,color:C.ink},productKicker:{fontSize:9,fontWeight:'800',color:C.coral,letterSpacing:1.4},productTitle:{fontSize:32,fontWeight:'800',color:C.ink,letterSpacing:-.8,marginTop:5},productDetail:{fontSize:13,color:C.muted,marginTop:4},productPrice:{fontSize:24,fontWeight:'900',color:C.ink,marginTop:18},description:{fontSize:14,lineHeight:22,color:C.muted,marginTop:14},
  infoCard:{padding:16,borderRadius:18,backgroundColor:C.cream,flexDirection:'row',alignItems:'center',gap:12,marginTop:22},infoIcon:{fontSize:25},infoTitle:{fontSize:13,fontWeight:'800',color:C.ink},infoText:{fontSize:11,lineHeight:16,color:C.muted,marginTop:3},grow:{flex:1},shareBlock:{marginTop:22,paddingTop:18,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#DDE2DB'},shareTitle:{fontSize:11,fontWeight:'800',color:C.ink,marginBottom:12},shareActions:{flexDirection:'row',justifyContent:'space-between',gap:6},shareButton:{flex:1,alignItems:'center',minHeight:68,borderRadius:14,paddingTop:2},pressed:{opacity:.68,transform:[{scale:.97}]},shareLabel:{fontSize:9,color:C.muted,fontWeight:'700',marginTop:6},stickyAction:{flexDirection:'row',gap:10,alignItems:'center',marginTop:24},primary:{height:54,borderRadius:27,backgroundColor:C.forest,alignItems:'center',justifyContent:'center',marginTop:22},primaryGrow:{flex:1,height:54,borderRadius:27,backgroundColor:C.forest,alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontSize:14,fontWeight:'800'},secondary:{height:52,borderRadius:26,borderWidth:1,borderColor:'#BFC9C1',alignItems:'center',justifyContent:'center',marginTop:12},secondaryText:{color:C.forest,fontSize:13,fontWeight:'800'},
  quantity:{height:38,borderRadius:19,backgroundColor:C.cream,flexDirection:'row',alignItems:'center'},qButton:{width:36,height:38,alignItems:'center',justifyContent:'center'},qText:{fontSize:18,color:C.forest},qValue:{minWidth:20,textAlign:'center',fontSize:13,fontWeight:'800',color:C.ink},notice:{padding:12,borderRadius:14,backgroundColor:C.sage,marginBottom:10},noticeText:{textAlign:'center',fontSize:11,fontWeight:'700',color:C.forest},cartRow:{paddingVertical:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DDE2DB',flexDirection:'row',alignItems:'center',gap:12},thumb:{width:68,height:68,borderRadius:18,alignItems:'center',justifyContent:'center'},thumbEmoji:{fontSize:34},rowTitle:{fontSize:13,fontWeight:'800',color:C.ink},rowSub:{fontSize:11,color:C.muted,marginTop:3},rowPrice:{fontSize:13,fontWeight:'800',color:C.ink,marginTop:7},summary:{backgroundColor:C.cream,borderRadius:20,padding:17,marginTop:22},summaryRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6},totalRow:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#C9D0CA',marginTop:7,paddingTop:13},total:{fontSize:17,fontWeight:'900',color:C.ink},empty:{alignItems:'center',paddingVertical:70},emptyIcon:{fontSize:58},emptyTitle:{fontSize:22,fontWeight:'800',color:C.ink,marginTop:20},emptyText:{fontSize:13,lineHeight:20,color:C.muted,textAlign:'center',marginTop:8,maxWidth:260},
  section:{marginBottom:26},sectionHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:13},sectionNumber:{width:26,height:26,borderRadius:13,backgroundColor:C.forest,color:'#fff',textAlign:'center',lineHeight:26,fontSize:11,fontWeight:'800'},sectionTitle:{fontSize:17,fontWeight:'800',color:C.ink},field:{marginBottom:11},fieldLabel:{fontSize:10,fontWeight:'700',color:C.muted,marginBottom:5,marginLeft:3},fieldInput:{height:50,borderRadius:15,backgroundColor:C.cream,paddingHorizontal:15,fontSize:13,color:C.ink},toggleRow:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:16,backgroundColor:C.cream,marginBottom:14},checkbox:{width:23,height:23,borderRadius:7,borderWidth:1.5,borderColor:'#9BA79F',alignItems:'center',justifyContent:'center'},checkboxOn:{backgroundColor:C.forest,borderColor:C.forest},check:{color:'#fff',fontWeight:'900'},choices:{gap:8},choice:{minHeight:46,borderWidth:1,borderColor:'#D8DDD6',borderRadius:15,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:10},choiceOn:{borderColor:C.forest,backgroundColor:C.sage},choiceText:{fontSize:12,fontWeight:'600',color:C.muted},choiceTextOn:{color:C.ink,fontWeight:'800'},radio:{width:16,height:16,borderRadius:8,borderWidth:1.5,borderColor:'#A7B0AA'},radioOn:{borderWidth:5,borderColor:C.forest,backgroundColor:'#fff'},help:{fontSize:11,lineHeight:16,color:C.muted,marginBottom:12},feeRow:{flexDirection:'row',justifyContent:'space-between',marginTop:12,padding:13,borderRadius:14,backgroundColor:C.cream},locationButton:{height:48,borderRadius:24,borderWidth:1,borderColor:C.forest,alignItems:'center',justifyContent:'center',marginBottom:10},disclaimer:{fontSize:10,color:C.muted,textAlign:'center',marginTop:12},
  success:{alignItems:'center',paddingTop:24},successIcon:{width:74,height:74,borderRadius:37,backgroundColor:C.sage,alignItems:'center',justifyContent:'center'},checkLarge:{fontSize:34,fontWeight:'800',color:C.forest},successTitle:{fontSize:27,fontWeight:'900',color:C.ink,textAlign:'center',marginTop:20},successText:{fontSize:13,lineHeight:20,color:C.muted,textAlign:'center',marginTop:10,maxWidth:330},orderNumber:{marginTop:22,alignItems:'center',backgroundColor:C.cream,borderRadius:16,paddingHorizontal:34,paddingVertical:12},orderLabel:{fontSize:8,fontWeight:'800',letterSpacing:1.3,color:C.muted},orderValue:{fontSize:18,fontWeight:'900',color:C.ink,marginTop:3},
  mapDemo:{height:190,borderRadius:25,backgroundColor:'#DCE7DB',alignItems:'center',justifyContent:'center',overflow:'hidden'},mapRoad:{fontSize:9,color:'#708077',letterSpacing:1.2,transform:[{rotate:'-13deg'}]},mapPin:{width:48,height:48,borderRadius:24,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',marginTop:8},trackingHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingVertical:24},trackingTitle:{fontSize:21,fontWeight:'900',color:C.ink,marginTop:4},live:{fontSize:9,fontWeight:'900',color:C.coral,backgroundColor:'#F5DED7',paddingHorizontal:10,paddingVertical:6,borderRadius:12},timeline:{minHeight:72,flexDirection:'row'},lineColumn:{width:34,alignItems:'center'},dot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:'#B8C1BA',backgroundColor:C.paper,alignItems:'center',justifyContent:'center'},dotOn:{borderColor:C.forest,backgroundColor:C.forest},dotCheck:{fontSize:10,color:'#fff',fontWeight:'800'},line:{width:2,flex:1,backgroundColor:'#D7DDD8'},lineOn:{backgroundColor:C.forest},timelineText:{paddingLeft:9,paddingTop:1},
  listIntro:{fontSize:13,lineHeight:20,color:C.muted,marginBottom:18},savedRow:{minHeight:76,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DDE2DB',flexDirection:'row',alignItems:'center',gap:13},savedIcon:{width:44,height:44,borderRadius:15,backgroundColor:C.cream,alignItems:'center',justifyContent:'center'},emptyBox:{padding:22,borderRadius:20,backgroundColor:C.cream,marginTop:6},emptyBoxTitle:{fontSize:13,fontWeight:'900',color:C.ink},emptyBody:{fontSize:10.5,lineHeight:16,color:C.muted,marginTop:5},chevron:{fontSize:26,color:C.muted},
});
