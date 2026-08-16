import { Platform } from 'react-native';

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL
  ?? (Platform.OS === 'web' && __DEV__ ? 'http://localhost:3002' : 'https://muroora-mart.vercel.app');

type Envelope<T> = { data:T } | { error:{ code:string; message:string } };

export async function mobileApi<T>(path:string, token:string, init?:RequestInit):Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...init?.headers },
  });
  const body = await response.json() as Envelope<T>;
  if(!response.ok || 'error' in body) throw new Error('error' in body ? body.error.message : 'The server could not complete that request.');
  return body.data;
}

export type AdminData = {
  summary:{ ordersWaiting:number; beingPacked:number; onTheWay:number; deliveredThisWeek:number; products:number; lowOrOut:number; riderApplications:number; openIncidents:number };
  products:Array<{ id:string; name:string; sku:string; quantity:number; reserved:number; lowStockThreshold:number; isActive:boolean; availability:'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK'; price:{amount:string;currency:string} }>;
  riders:Array<{ id:string; publicRiderId:string; displayName:string; accountStatus:string; verificationStatus:string; availability:string; trustLevel:number|null; currentExposureAmount:string; maximumExposureAmount:string|null; currency:string; activeDeliveries:number; completedDeliveries:number; incidentCount:number }>;
  dispatch:Array<{ orderId:string; orderNumber:string; orderStatus:string; deliveryId:string|null; deliveryStatus:string|null; custodyState:string|null; riderId:string|null; merchandiseValueAmount:string; currency:string; deliverySuburb:string; createdAt:string }>;
  handovers:Array<{ deliveryId:string; orderNumber:string; deliverySuburb:string; status:string; custodyState:string; merchandiseValueAmount:string; currency:string; publicRiderId:string; riderName:string; vehicleType:string|null; assignedAt:string|null }>;
};

/**
 * DESIGN PREVIEW ONLY. Never real.
 *
 * Reachable solely behind __DEV__ from the admin login, so it cannot appear in
 * a release build. Every name here is marked so that if it ever did leak into
 * a screenshot, nobody could mistake it for the shop's actual stock, riders or
 * deliveries.
 */
export const previewAdminData:AdminData = {
  summary:{ordersWaiting:4,beingPacked:3,onTheWay:2,deliveredThisWeek:18,products:46,lowOrOut:5,riderApplications:2,openIncidents:1},
  products:[
    {id:'preview-1',name:'PREVIEW ONLY - not real stock',sku:'MM-RM-10',quantity:14,reserved:3,lowStockThreshold:5,isActive:true,availability:'IN_STOCK',price:{amount:'850',currency:'USD'}},
    {id:'preview-2',name:'PREVIEW ONLY - not real stock',sku:'MM-OIL-2',quantity:4,reserved:1,lowStockThreshold:5,isActive:true,availability:'LOW_STOCK',price:{amount:'420',currency:'USD'}},
    {id:'preview-3',name:'PREVIEW ONLY - not real stock',sku:'MM-MAZ-2',quantity:0,reserved:0,lowStockThreshold:4,isActive:false,availability:'OUT_OF_STOCK',price:{amount:'360',currency:'USD'}},
  ],
  riders:[
    {id:'rider-1',publicRiderId:'MUR-R-0027',displayName:'PREVIEW ONLY - not a real rider',accountStatus:'ACTIVE',verificationStatus:'VERIFIED',availability:'ON_DELIVERY',trustLevel:2,currentExposureAmount:'1250',maximumExposureAmount:'2500',currency:'USD',activeDeliveries:1,completedDeliveries:38,incidentCount:0},
    {id:'rider-2',publicRiderId:'MUR-R-0031',displayName:'PREVIEW ONLY - not a real rider',accountStatus:'UNDER_REVIEW',verificationStatus:'IN_PROGRESS',availability:'OFFLINE',trustLevel:null,currentExposureAmount:'0',maximumExposureAmount:null,currency:'USD',activeDeliveries:0,completedDeliveries:0,incidentCount:1},
  ],
  dispatch:[{orderId:'order-1',orderNumber:'MM-000124',orderStatus:'READY_FOR_PICKUP',deliveryId:'delivery-1',deliveryStatus:'ASSIGNED',custodyState:'RIDER_ASSIGNED',riderId:'rider-1',merchandiseValueAmount:'1250',currency:'USD',deliverySuburb:'Dangamvura',createdAt:new Date().toISOString()}],
  handovers:[{deliveryId:'delivery-2',orderNumber:'MM-000126',deliverySuburb:'Chikanga',status:'RIDER_ARRIVED_PICKUP',custodyState:'HANDOVER_STARTED',merchandiseValueAmount:'860',currency:'USD',publicRiderId:'MUR-R-0029',riderName:'PREVIEW ONLY',vehicleType:'MOTORBIKE',assignedAt:new Date().toISOString()}],
};
