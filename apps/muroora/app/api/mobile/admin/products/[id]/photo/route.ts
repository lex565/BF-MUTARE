import { addProductPhoto,ProductPhotoError } from '@/lib/services/product-photo'
import { mobileAdmin,mobileFail,mobileOk,mobileOptions } from '../../../../_lib'

export const OPTIONS=mobileOptions
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const admin=await mobileAdmin(request)
 if(!admin)return mobileFail('FORBIDDEN','Administrator access is required.',403)
 try{
  const form=await request.formData(),file=form.get('photo')
  if(!(file instanceof File))return mobileFail('BAD_FILE','Choose a product photo.',400)
  const {id}=await params
  return mobileOk(await addProductPhoto({productId:id,file,actorId:admin.id}))
 }catch(e){return mobileFail(e instanceof ProductPhotoError?e.code:'UPLOAD_FAILED',(e as Error).message,400)}
}
