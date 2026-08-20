import { useEffect,useMemo,useState } from 'react';
import { Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { BusinessApplication } from './BusinessApplication';
import { API_BASE } from './mobileApi';
import { supabase } from './supabase';

const C={ink:'#17372D',forest:'#235643',cream:'#F7F3E9',paper:'#FFFDF8',gold:'#E7A83E',coral:'#D96B4A',sage:'#DDE7D7',muted:'#6E7B74',rule:'#DDE2DB'};
type Kind='Shop'|'Food'|'Accommodation'|'Services'|'Education';
type Listing={id:number;kind:Kind;title:string;business:string;area:string;price:string;mode:'BUY'|'ENQUIRE';icon:string;description:string};
/**
 * THERE IS NO HARD-CODED LIST ANY MORE.
 *
 * This file used to carry invented businesses - a bookshop, a boarding house,
 * a tutor - each with a price and an area, none of which existed. A tester
 * could tap one and go looking for a shop that was never real. Everything the
 * Discover screen shows now comes from /api/mobile/marketplace, which returns
 * only approved businesses.
 */
type Screen='discover'|'detail'|'chat'|'apply'|'portal';

export function MarketplaceFlow({close}:{close:()=>void}){
 const [token,setToken]=useState<string|null>(null);
 const [live,setLive]=useState<Listing[]|null>(null);

 /**
  * The signed-in person's access token, for the application endpoints.
  * Read from Supabase rather than passed in, so this screen works wherever it
  * is opened from.
  */
 useEffect(()=>{if(!supabase)return;void supabase.auth.getSession().then(({data})=>setToken(data.session?.access_token??null))},[]);

 /**
  * REAL BUSINESSES, replacing three hard-coded arrays.
  *
  * The app shipped with invented listings - a bookshop, a boarding house, a
  * tutor - each with a price and an area, none of which existed. A tester could
  * tap one and go looking for a shop that was never real. The same fake data
  * was deleted from the website; this is the other half.
  *
  * On failure it falls back to an EMPTY list, never to the invented one: an
  * empty marketplace is the truth when nobody has joined yet.
  */
 useEffect(()=>{let alive=true;void fetch(`${API_BASE}/api/mobile/marketplace`).then(r=>r.json()).then(body=>{if(!alive)return;const businesses=body?.data?.businesses??[];setLive(businesses.map((b:{publicId:string;name:string;summary:string|null;kind:string;city:string;verified:boolean},i:number)=>({id:i+1,kind:(b.kind==='FOOD'?'Food':b.kind==='ACCOMMODATION'?'Accommodation':b.kind==='SERVICE'?'Services':b.kind==='EDUCATION'?'Education':'Shop') as Kind,title:b.name,business:b.verified?'Verified on Musuwo':'On Musuwo',area:b.city,price:'',mode:'ENQUIRE' as const,icon:'🏪',description:b.summary??''})))}).catch(()=>{if(alive)setLive([])});return()=>{alive=false}},[]);

 const [screen,setScreen]=useState<Screen>('discover'),[kind,setKind]=useState<Kind|'All'>('All'),[query,setQuery]=useState(''),[selected,setSelected]=useState<Listing|null>(null),[contact,setContact]=useState(false),[applicationStep,setApplicationStep]=useState(1);
 const source=live??[];
 const results=useMemo(()=>source.filter(x=>(kind==='All'||x.kind===kind)&&`${x.title} ${x.business} ${x.area}`.toLowerCase().includes(query.toLowerCase())),[source,kind,query]);
 const back=()=>screen==='discover'?close():screen==='chat'?setScreen('detail'):setScreen('discover');
 /**
  * THE REAL APPLICATION.
  *
  * What was here was three screens of inputs that were never read, ending in
  * Alert.alert('Preview submitted'). Nothing was written anywhere. Somebody who
  * filled it in believed they had applied, nothing reached the review queue,
  * and neither side knew.
  *
  * BusinessApplication talks to the same server functions the website uses, so
  * the phone cannot accept an application the website would refuse.
  */
 if(screen==='apply')return <Shell title="Musuwo for Business" back={back}>{token?<BusinessApplication token={token} onDone={()=>setScreen('discover')}/>:<Notice title="Sign in first" text="Registering a business needs an account, so we can write back to you and so your draft survives closing the app."/>}</Shell>;
 /**
  * THE PORTAL PREVIEW HAS BEEN REMOVED.
  *
  * It showed four metrics - new orders, enquiries, messages, and "80% profile
  * complete" - none of which were computed from anything, and seven rows that
  * each raised an alert saying the backend was not finished. It was a second,
  * fake path to merchant management, sitting alongside the real one on the
  * account screen, which now opens the actual Merchant Studio.
  *
  * A convincing mock of a feature is worse than no feature: a merchant who
  * taps "Orders" here and sees 0 has been told something false about their own
  * business.
  */
 if(screen==='chat'&&selected)return <Shell title="Musuwo Chat" back={back}><Text style={s.eyebrow}>{selected.business.toUpperCase()}</Text><Text style={s.title}>Ask before you connect</Text><Notice title="Your contact stays private" text="Phone and WhatsApp details remain hidden until contact release is approved and recorded."/><View style={s.chat}><Text style={s.chatText}>Start a conversation about availability, pricing or a viewing. No preview messages are pre-filled.</Text></View><TextInput placeholder="Write a message" placeholderTextColor="#89958F" style={s.message}/><Pressable style={s.primary} onPress={()=>Alert.alert('Preview only','Message sending requires the conversation backend.')}><Text style={s.primaryText}>Send message</Text></Pressable><Pressable style={s.secondary} onPress={()=>setContact(true)}><Text style={s.secondaryText}>{contact?'Contact requested':'Request contact details'}</Text></Pressable>{contact&&<Notice title="Request recorded" text="In production the business response and authorized release will be audited before phone or WhatsApp details appear."/>}</Shell>;
 if(screen==='detail'&&selected)return <Shell title={selected.kind} back={back}><View style={s.detailHero}><Text style={s.detailIcon}>{selected.icon}</Text><Text style={s.badge}>PREVIEW LISTING</Text></View><Text style={s.eyebrow}>{selected.business.toUpperCase()}</Text><Text style={s.title}>{selected.title}</Text><Text style={s.price}>{selected.price}</Text><Text style={s.body}>{selected.description}</Text><View style={s.info}><Text style={s.rowTitle}>ðŸ“ {selected.area}</Text><Text style={s.verified}>Information reviewed · Preview ID</Text></View>{selected.kind==='Accommodation'&&<Notice title="Accommodation safety" text="Do not send deposits solely because someone claims to represent a property. Verify the property and agreement before making off-platform payments."/>}<Pressable style={s.primary} onPress={()=>selected.mode==='BUY'?Alert.alert('Commerce preview','This listing would use the existing cart with one merchant per checkout.'):setScreen('chat')}><Text style={s.primaryText}>{selected.mode==='BUY'?'Add to basket':'Chat with business'}</Text></Pressable><Pressable style={s.secondary} onPress={()=>Alert.alert('Report listing','A production report creates a review case; it does not automatically assign guilt.')}><Text style={s.secondaryText}>Report this listing</Text></Pressable></Shell>;
 return <Shell title="Musuwo" back={back}><Text style={s.eyebrow}>MUSUWO · LOCAL BUSINESS MARKETPLACE</Text><Text style={s.title}>What are you looking for?</Text><View style={s.search}><Text>âŒ•</Text><TextInput value={query} onChangeText={setQuery} placeholder="Shop, food, room, tutor, service…" placeholderTextColor="#89958F" style={s.searchInput}/></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{(['All','Shop','Food','Accommodation','Services','Education'] as const).map(x=><Pressable key={x} onPress={()=>setKind(x)} style={[s.chip,kind===x&&s.chipOn]}><Text style={[s.chipText,kind===x&&s.chipTextOn]}>{x}</Text></Pressable>)}</ScrollView><View style={s.actionRow}><Pressable style={s.businessButton} onPress={()=>setScreen('apply')}><Text style={s.businessKicker}>SELL OR LIST</Text><Text style={s.businessTitle}>Musuwo for Business →</Text></Pressable></View><Text style={s.section}>{kind==='All'?'DISCOVER MUTARE':kind.toUpperCase()}</Text>{results.map(x=><Pressable key={x.id} style={s.listing} onPress={()=>{setSelected(x);setScreen('detail')}}><View style={s.listIcon}><Text style={s.icon}>{x.icon}</Text></View><View style={s.grow}><View style={s.between}><Text style={s.rowTitle}>{x.title}</Text><Text style={s.mode}>{x.mode}</Text></View><Text style={s.meta}>{x.business} · {x.area}</Text><Text style={s.listPrice}>{x.price}</Text></View></Pressable>)}{results.length===0&&<Notice title="No matches" text="Try another word or category."/>}</Shell>;
}
function Shell({title,back,children}:{title:string;back:()=>void;children:React.ReactNode}){return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.phone}><View style={s.header}><Pressable onPress={back} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={s.headerTitle}>{title}</Text><View style={s.back}/></View><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView></View></SafeAreaView>}
function Field({label,placeholder}:{label:string;placeholder:string}){return <View style={s.field}><Text style={s.label}>{label.toUpperCase()}</Text><TextInput placeholder={placeholder} placeholderTextColor="#89958F" style={s.fieldInput}/></View>}
function Chips({values,selected}:{values:string[];selected:string}){return <View style={s.wrap}>{values.map(x=><View key={x} style={[s.chip,x===selected&&s.chipOn]}><Text style={[s.chipText,x===selected&&s.chipTextOn]}>{x}</Text></View>)}</View>}
function Upload({label}:{label:string}){return <Pressable style={s.upload} onPress={()=>Alert.alert('Preview upload','Public marketing images and private verification documents will use separate storage policies.')}><Text style={s.uploadPlus}>+</Text><Text style={s.rowTitle}>{label}</Text></Pressable>}
function Notice({title,text}:{title:string;text:string}){return <View style={s.notice}><Text style={s.noticeTitle}>{title}</Text><Text style={s.noticeText}>{text}</Text></View>}
function Review({label}:{label:string}){return <View style={s.row}><Text style={s.rowTitle}>{label}</Text><Text style={s.verified}>Ready for review</Text></View>}
function Metric({value,label}:{value:string;label:string}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.meta}>{label}</Text></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:C.paper},phone:{flex:1,maxWidth:440,width:'100%',alignSelf:'center',backgroundColor:C.paper},header:{height:68,paddingHorizontal:16,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.rule},back:{width:42,height:42,borderRadius:21,backgroundColor:C.cream,alignItems:'center',justifyContent:'center'},backText:{fontSize:32,color:C.ink,marginTop:-4},headerTitle:{flex:1,textAlign:'center',fontWeight:'900',color:C.ink},content:{padding:20,paddingBottom:55},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.4,color:C.coral,marginTop:8},title:{fontSize:31,lineHeight:35,fontWeight:'900',color:C.ink,letterSpacing:-.8,marginTop:5,marginBottom:20},search:{height:52,borderRadius:17,backgroundColor:C.cream,flexDirection:'row',alignItems:'center',paddingHorizontal:16},searchInput:{flex:1,paddingHorizontal:10,color:C.ink},chips:{gap:8,paddingVertical:15},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:15},chip:{paddingHorizontal:14,paddingVertical:10,borderRadius:20,backgroundColor:C.cream},chipOn:{backgroundColor:C.forest},chipText:{fontSize:11,fontWeight:'800',color:C.muted},chipTextOn:{color:'#fff'},actionRow:{flexDirection:'row',gap:8},businessButton:{flex:1,padding:17,borderRadius:20,backgroundColor:C.forest},businessKicker:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:C.gold},businessTitle:{fontSize:14,fontWeight:'900',color:'#fff',marginTop:4},portalButton:{width:95,borderRadius:20,backgroundColor:C.gold,alignItems:'center',justifyContent:'center'},portalText:{fontSize:10,fontWeight:'900',color:C.ink,textAlign:'center'},section:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:C.muted,marginTop:28,marginBottom:10},listing:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.rule,flexDirection:'row',gap:12},listIcon:{width:62,height:62,borderRadius:19,backgroundColor:C.cream,alignItems:'center',justifyContent:'center'},icon:{fontSize:28},grow:{flex:1},between:{flexDirection:'row',justifyContent:'space-between',gap:8},rowTitle:{fontSize:13,fontWeight:'900',color:C.ink},meta:{fontSize:9.5,lineHeight:14,color:C.muted,marginTop:4},mode:{fontSize:7,fontWeight:'900',color:C.forest,backgroundColor:C.sage,padding:5,borderRadius:8,overflow:'hidden'},listPrice:{fontSize:12,fontWeight:'900',color:C.forest,marginTop:7},detailHero:{height:210,borderRadius:28,backgroundColor:C.cream,alignItems:'center',justifyContent:'center',marginBottom:22},detailIcon:{fontSize:80},badge:{position:'absolute',top:14,right:14,fontSize:8,fontWeight:'900',color:C.coral,backgroundColor:'#F5DED7',padding:7,borderRadius:10,overflow:'hidden'},price:{fontSize:21,fontWeight:'900',color:C.forest},body:{fontSize:13,lineHeight:20,color:C.muted,marginTop:12},info:{padding:16,borderRadius:18,backgroundColor:C.cream,marginTop:18},verified:{fontSize:9,color:C.forest,marginTop:4},notice:{padding:16,borderRadius:18,backgroundColor:'#F5E6C9',marginTop:16},noticeTitle:{fontSize:12,fontWeight:'900',color:C.ink},noticeText:{fontSize:10,lineHeight:16,color:C.muted,marginTop:4},primary:{height:54,borderRadius:27,backgroundColor:C.forest,alignItems:'center',justifyContent:'center',marginTop:20},primaryText:{color:'#fff',fontWeight:'900'},secondary:{height:52,borderRadius:26,borderWidth:1,borderColor:C.forest,alignItems:'center',justifyContent:'center',marginTop:10},secondaryText:{color:C.forest,fontWeight:'900'},chat:{minHeight:180,borderRadius:22,backgroundColor:C.cream,alignItems:'center',justifyContent:'center',padding:25},chatText:{fontSize:11,lineHeight:18,color:C.muted,textAlign:'center'},message:{height:52,borderRadius:17,backgroundColor:C.cream,paddingHorizontal:15,marginTop:12},field:{marginBottom:14},label:{fontSize:9,fontWeight:'900',letterSpacing:1.1,color:C.muted,marginBottom:6},fieldInput:{height:52,borderRadius:16,backgroundColor:C.cream,paddingHorizontal:15,color:C.ink},upload:{height:90,borderRadius:20,borderWidth:1,borderStyle:'dashed',borderColor:C.muted,alignItems:'center',justifyContent:'center'},uploadPlus:{fontSize:25,color:C.forest},row:{minHeight:62,borderBottomWidth:1,borderBottomColor:C.rule,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},arrow:{fontSize:24,color:C.muted},metrics:{flexDirection:'row',flexWrap:'wrap'},metric:{width:'50%',padding:18,borderRadius:20,borderWidth:4,borderColor:C.paper,backgroundColor:C.cream},metricValue:{fontSize:27,fontWeight:'900',color:C.ink}});

