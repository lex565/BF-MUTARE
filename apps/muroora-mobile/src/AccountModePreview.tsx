import { useEffect,useState } from 'react';
import { Linking,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';

import { API_BASE,mobileApi } from './mobileApi';
import { supabase,supabaseConfigured } from './supabase';

/**
 * The Musuwo account screen.
 *
 * THIS USED TO LET ANYBODY STRAIGHT IN.
 *
 * It was a design mock: "Continue as an individual" called setMode('individual')
 * and that was the whole of it - local React state, no password, no session, no
 * server. On a fresh install of the beta on a new phone, tapping the account
 * icon opened somebody's account. Worse, "Continue as a business" then showed
 * Muroora Mart's workspace, its public id, its founding-merchant status and its
 * business score to whoever was holding the phone.
 *
 * A nine-pixel line reading "Preview only" is not an access control.
 *
 * Now: nothing opens without a real Supabase session, and the business half is
 * built from `/api/mobile/workspaces`, which resolves the signed-in person's
 * memberships ON THE SERVER. Somebody with no membership is told they have no
 * business workspace, because that is the truth. No business is named in this
 * file any more - naming one is how a mock ends up looking like an entitlement.
 */

const C={ink:'#17372D',forest:'#235643',cream:'#F7F3E9',paper:'#FFFDF8',gold:'#E7A83E',coral:'#D96B4A',sage:'#DDE7D7',muted:'#6E7B74',rule:'#DDE2DB'};

type Mode='choose'|'individual'|'business';

type Workspace={businessId:string;publicId:string;name:string;slug:string;status:string;roles:string[];canWrite:boolean;hasCatalogue:boolean};
type WorkspacePayload={platformRoles:string[];workspaces:Workspace[]};
type Me={fullName:string|null;email:string|null};

export function AccountModePreview({close,openMuroora,shop}:{close:()=>void;openMuroora:()=>void;shop:()=>void}){
 /**
  * Open a page of the website in the phone's browser.
  *
  * Deliberately the system browser and not an in-app view: the merchant is
  * already signed in there, or can be, and an embedded browser with its own
  * cookie jar would ask them to sign in again for no reason.
  */
 const openWeb=(path:string)=>{ void Linking.openURL(`${API_BASE}${path}`); };
 const [session,setSession]=useState<Session|null>(null);
 const [checking,setChecking]=useState(true);
 const [mode,setMode]=useState<Mode>('choose');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [fullName,setFullName]=useState('');
 const [create,setCreate]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [spaces,setSpaces]=useState<WorkspacePayload|null>(null);
 const [me,setMe]=useState<Me|null>(null);

 // Restore an existing session, and keep up with sign-out from anywhere else.
 useEffect(()=>{
  if(!supabase){setChecking(false);return}
  void supabase.auth.getSession().then(({data:{session:s}})=>{setSession(s);setChecking(false);if(s)void load(s)});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,next)=>{
   setSession(next);
   if(next)void load(next); else {setSpaces(null);setMe(null);setMode('choose')}
  });
  return ()=>subscription.unsubscribe();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 const load=async(s:Session)=>{
  try{
   const [who,workspaces]=await Promise.all([
    mobileApi<Me>('/api/mobile/me',s.access_token),
    mobileApi<WorkspacePayload>('/api/mobile/workspaces',s.access_token),
   ]);
   setMe(who);setSpaces(workspaces);
  }catch(e){
   // Not fatal: the person is signed in, the extra detail just did not load.
   setError((e as Error).message);
  }
 };

 const submit=async()=>{
  if(!supabase){setError('This build has no server configured.');return}
  const address=email.trim().toLowerCase();
  if(!address||!password){setError('Email and password are both needed.');return}
  if(create&&password.length<8){setError('Use at least 8 characters.');return}
  setBusy(true);setError('');
  try{
   if(create){
    const {error:e}=await supabase.auth.signUp({email:address,password,options:{data:{full_name:fullName.trim()||null}}});
    if(e){setError(e.message);return}
   }else{
    const {error:e}=await supabase.auth.signInWithPassword({email:address,password});
    // Deliberately not "no account with that email": that turns this form
    // into a way of discovering who has an account.
    if(e){setError('That email and password do not match.');return}
   }
   setPassword('');
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 };

 const signOut=async()=>{
  try{if(supabase)await supabase.auth.signOut()}catch{/* already gone */}
  setSession(null);setSpaces(null);setMe(null);setMode('choose');
 };

 if(checking)return <Shell title="Musuwo" back={close}><Text style={s.body}>One moment…</Text></Shell>;

 /* ------------------------------------------------ not signed in: the gate */

 if(!session)return <Shell title="Sign in to Musuwo" back={close}>
  <Text style={s.eyebrow}>{create?'CREATE YOUR MUSUWO ACCOUNT':'SIGN IN TO MUSUWO'}</Text>
  <Text style={s.title}>{create?'One account for everything.':'Welcome back.'}</Text>
  <Text style={s.body}>Your individual shopping and any business you belong to live under one login, kept in separate spaces.</Text>

  {!supabaseConfigured&&<View style={s.notice}><Text style={s.noticeTitle}>Not connected</Text><Text style={s.noticeText}>This build has no server address, so signing in cannot work. It needs rebuilding with its environment set.</Text></View>}

  {create&&<Field label="Your name" value={fullName} onChange={setFullName} placeholder="What should we call you?"/>}
  <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address"/>
  <Field label="Password" value={password} onChange={setPassword} placeholder={create?'At least 8 characters':'Your password'} secure/>

  {!!error&&<View style={s.error}><Text style={s.errorText}>{error}</Text></View>}

  <Pressable style={[s.primary,busy&&s.dim]} disabled={busy||!supabaseConfigured} onPress={()=>void submit()}>
   <Text style={s.primaryText}>{busy?'One moment…':create?'Create account':'Sign in'}</Text>
  </Pressable>

  <Pressable onPress={()=>{setCreate(!create);setError('')}}>
   <Text style={s.switch}>{create?'I already have an account':'I need to create an account'}</Text>
  </Pressable>

  <Text style={s.note}>Signing in never grants staff or business access on its own. Those are given by somebody who already holds them.</Text>
 </Shell>;

 /* -------------------------------------------------- signed in: the chooser */

 const workspaces=spaces?.workspaces??[];

 if(mode==='choose')return <Shell title="Your Musuwo" back={close}>
  <Text style={s.eyebrow}>SIGNED IN</Text>
  <Text style={s.title}>{me?.fullName||'Your account'}</Text>
  <Text style={s.body}>{me?.email||session.user.email}</Text>

  <ModeCard icon="○" title="Individual account" text="Shop, enquire, manage personal orders and contact businesses." action="Continue as an individual" onPress={()=>setMode('individual')}/>

  {workspaces.length>0
   ? <ModeCard icon="▦" title="Business account" text={workspaces.length===1?`Manage ${workspaces[0].name}.`:`Manage ${workspaces.length} businesses you belong to.`} action="Continue as a business" onPress={()=>setMode('business')}/>
   : <View style={s.modeCard}>
      <View style={[s.modeIcon,{backgroundColor:C.muted}]}><Text style={s.modeIconText}>▦</Text></View>
      <Text style={s.modeTitle}>No business workspace</Text>
      <Text style={s.modeText}>This account does not belong to a business on Musuwo. If it should, an owner of that business can add you.</Text>
     </View>}

  <Pressable onPress={()=>void signOut()}><Text style={s.switch}>Sign out</Text></Pressable>
 </Shell>;

 if(mode==='individual')return <Shell title="Musuwo Individual Account" back={()=>setMode('choose')}>
  <View style={s.profile}><View style={s.avatar}><Text style={s.avatarText}>○</Text></View><View style={s.grow}><Text style={s.profileTitle}>{me?.fullName||'Individual profile'}</Text><Text style={s.meta}>{me?.email||session.user.email}</Text></View></View>
  <Text style={s.section}>YOUR MUSUWO</Text>
  <Action title="Discover businesses" text="Shopping, food, accommodation and services" onPress={shop}/>
  <Action title="My orders" text="Purchases made through Musuwo" onPress={()=>openWeb('/account')}/>
  <Action title="Chats and enquiries" soon="Messaging between customers and businesses is not built yet."/>
  <Action title="Saved places and favourites" soon="Saved addresses and favourites are not built yet."/>
  <View style={s.notice}><Text style={s.noticeTitle}>Buying is personal</Text><Text style={s.noticeText}>A business workspace cannot place personal orders using merchant authority. Purchases always come from your individual account.</Text></View>
 </Shell>;

 /* -------------------- business: only ever the person's own memberships */

 return <Shell title="Musuwo Business Account" back={()=>setMode('choose')}>
  {workspaces.map(w=>(
   <View key={w.businessId} style={s.businessHero}>
    <Text style={s.businessKicker}>YOUR BUSINESS</Text>
    <Text style={s.businessName}>{w.name}</Text>
    <Text style={s.businessMeta}>{w.publicId} · {w.status}</Text>
    <Text style={s.businessMeta}>{w.canWrite?w.roles.join(', '):'Oversight only, no changes'}</Text>
    {w.hasCatalogue&&<Pressable style={s.openStore} onPress={openMuroora}><Text style={s.openStoreText}>Open {w.name} →</Text></Pressable>}
   </View>
  ))}

  <Text style={s.section}>STORE MANAGEMENT</Text>
  {workspaces.length===0
   ? <Action title="No business workspace" soon="You are not a member of a business on Musuwo yet."/>
   : <>
    {/* These open the Merchant Studio in the phone's browser rather than
        reproducing it here. That is the brief's own instruction - the browser
        gets the full management experience - and it means these rows do the
        real thing today instead of waiting for a native rewrite. The web
        workspace is responsive and requires the same sign-in. */}
    <Action title="Products and listings" text="Photos, prices and publishing to Musuwo"
            onPress={()=>openWeb(`/business/${workspaces[0].businessId}`)}/>
    <Action title="Business profile" text="Description, links and how customers reach you"
            onPress={()=>openWeb(`/business/${workspaces[0].businessId}`)}/>
    <Action title="Your storefront" text="See your shop the way a customer sees it"
            onPress={()=>openWeb(`/stores/${workspaces[0].slug}`)}/>
    <Action title="Store overview" soon="Daily figures for your shop are being built."/>
    <Action title="Orders" soon="Order management on the phone is being built."/>
    <Action title="Stock" soon="Stock levels on the phone are being built."/>
    <Action title="Staff" soon="Business-scoped staff access is being built."/>
   </>}

  <View style={s.notice}><Text style={s.noticeTitle}>Delivery through Musuwo</Text><Text style={s.noticeText}>The business prepares the order. Musuwo coordinates the delivery experience. The independent public Musuwo rider network remains Coming Soon.</Text></View>
 </Shell>;
}

function Shell({title,back,children}:{title:string;back:()=>void;children:React.ReactNode}){return <SafeAreaView style={s.safe}><StatusBar style="dark"/><View style={s.phone}><View style={s.header}><Pressable onPress={back} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={s.headerTitle}>{title}</Text><View style={s.back}/></View><ScrollView contentContainerStyle={s.content}>{children}</ScrollView></View></SafeAreaView>}
function ModeCard({icon,title,text,action,onPress}:{icon:string;title:string;text:string;action:string;onPress:()=>void}){return <Pressable style={s.modeCard} onPress={onPress}><View style={s.modeIcon}><Text style={s.modeIconText}>{icon}</Text></View><Text style={s.modeTitle}>{title}</Text><Text style={s.modeText}>{text}</Text><Text style={s.modeAction}>{action} →</Text></Pressable>}
/**
 * A row in a list of things you can do.
 *
 * `onPress` USED TO BE OPTIONAL, AND NINE ROWS WERE RENDERED WITHOUT IT.
 *
 * Six of them were the whole of Store Management - overview, products, orders,
 * stock, staff, business profile - and three were the individual account's
 * orders, chats and saved places. Every one drew a chevron, took a press, gave
 * press feedback and did absolutely nothing. There was no message, no "coming
 * soon", no navigation. A merchant tapped Orders and the screen sat there.
 *
 * The type below is what stops that recurring. A row must EITHER do something
 * or declare itself unfinished; there is no third option, so a dead row is now
 * a TypeScript error at build time rather than a disappointment on somebody's
 * phone in Mutare.
 *
 * A `soon` row is also drawn differently - dimmed, with a Soon chip and no
 * chevron - because a control that looks live and is not is the actual problem,
 * and saying so only after the tap is too late.
 */
type ActionProps =
  { title:string; text:string; onPress:()=>void; soon?:never }
  /** `soon` carries its own explanation, so `text` would be a second one. */
  | { title:string; soon:string; text?:never; onPress?:never };

function Action({title,text,onPress,soon}:ActionProps){
 if(soon){
  return <View style={[s.action,s.actionSoon]}>
   <View style={s.grow}><Text style={s.actionTitle}>{title}</Text><Text style={s.meta}>{soon}</Text></View>
   <View style={s.soonChip}><Text style={s.soonChipText}>SOON</Text></View>
  </View>;
 }
 return <Pressable style={s.action} onPress={onPress}><View style={s.grow}><Text style={s.actionTitle}>{title}</Text><Text style={s.meta}>{text}</Text></View><Text style={s.arrow}>›</Text></Pressable>;
}
function Field({label,value,onChange,placeholder,secure,keyboard}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;secure?:boolean;keyboard?:'email-address'}){
 return <View style={s.field}>
  <Text style={s.fieldLabel}>{label}</Text>
  <TextInput style={s.fieldInput} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#89958F" secureTextEntry={secure} keyboardType={keyboard} autoCapitalize="none" autoCorrect={false}/>
 </View>;
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:C.paper},phone:{flex:1,width:'100%',maxWidth:440,alignSelf:'center',backgroundColor:C.paper},header:{height:68,paddingHorizontal:16,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.rule},back:{width:42,height:42,borderRadius:21,backgroundColor:C.cream,alignItems:'center',justifyContent:'center'},backText:{fontSize:32,color:C.ink,marginTop:-4},headerTitle:{flex:1,textAlign:'center',fontSize:15,fontWeight:'900',color:C.ink},content:{padding:20,paddingBottom:50},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.4,color:C.coral,marginTop:12},title:{fontSize:32,lineHeight:36,fontWeight:'900',color:C.ink,marginTop:6},body:{fontSize:13,lineHeight:20,color:C.muted,marginTop:12,marginBottom:8},modeCard:{padding:22,borderRadius:24,backgroundColor:C.cream,marginTop:16},modeIcon:{width:48,height:48,borderRadius:16,backgroundColor:C.forest,alignItems:'center',justifyContent:'center'},modeIconText:{fontSize:23,fontWeight:'900',color:'#fff'},modeTitle:{fontSize:20,fontWeight:'900',color:C.ink,marginTop:16},modeText:{fontSize:11,lineHeight:17,color:C.muted,marginTop:5},modeAction:{fontSize:11,fontWeight:'900',color:C.coral,marginTop:18},note:{fontSize:9,lineHeight:15,color:C.muted,textAlign:'center',marginTop:20},profile:{padding:17,borderRadius:22,backgroundColor:C.cream,flexDirection:'row',alignItems:'center',gap:12},avatar:{width:50,height:50,borderRadius:17,backgroundColor:C.forest,alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'900',fontSize:18},profileTitle:{fontSize:16,fontWeight:'900',color:C.ink},meta:{fontSize:10,lineHeight:15,color:C.muted,marginTop:3},grow:{flex:1},section:{fontSize:9,fontWeight:'900',letterSpacing:1.3,color:C.muted,marginTop:26,marginBottom:5},action:{minHeight:70,borderBottomWidth:1,borderBottomColor:C.rule,flexDirection:'row',alignItems:'center'},actionSoon:{opacity:.55},soonChip:{paddingHorizontal:8,paddingVertical:3,borderRadius:9,backgroundColor:C.sage},soonChipText:{fontSize:8,fontWeight:'900',letterSpacing:1,color:C.ink},actionTitle:{fontSize:13,fontWeight:'900',color:C.ink},arrow:{fontSize:26,color:C.muted},notice:{padding:16,borderRadius:18,backgroundColor:'#F5E6C9',marginTop:20},noticeTitle:{fontSize:12,fontWeight:'900',color:C.ink},noticeText:{fontSize:10,lineHeight:16,color:C.muted,marginTop:4},businessHero:{padding:22,borderRadius:25,backgroundColor:C.forest,marginTop:16},businessKicker:{fontSize:8,fontWeight:'900',letterSpacing:1.3,color:C.gold},businessName:{fontSize:28,fontWeight:'900',color:'#fff',marginTop:5},businessMeta:{fontSize:10,color:'rgba(255,255,255,.65)',marginTop:4},openStore:{height:48,borderRadius:24,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',marginTop:20},openStoreText:{fontSize:12,fontWeight:'900',color:C.forest},field:{marginTop:16},fieldLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:C.muted,marginBottom:6},fieldInput:{minHeight:52,borderRadius:16,backgroundColor:C.cream,paddingHorizontal:16,fontSize:14,color:C.ink},primary:{height:54,borderRadius:27,backgroundColor:C.forest,alignItems:'center',justifyContent:'center',marginTop:22},primaryText:{fontSize:13,fontWeight:'900',color:'#fff'},dim:{opacity:.6},switch:{fontSize:11,fontWeight:'900',color:C.coral,textAlign:'center',marginTop:18},error:{padding:14,borderRadius:14,backgroundColor:'#F7DDD5',marginTop:16},errorText:{fontSize:11,lineHeight:17,color:'#8C3B22',fontWeight:'700'}});
