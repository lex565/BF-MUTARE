import { ShopCatalogue } from '@/app/components/shop/ShopCatalogue'
import type { CatalogueCategory,CatalogueProduct,WireMoney } from '@/app/components/shop/types'
import type { Money } from '@/lib/money'
import { listCategories,listPublicProducts } from '@/lib/services/products'

export const dynamic='force-dynamic'
const wireMoney=(value:Money):WireMoney=>({amount:value.amount.toString(),currency:value.currency,decimal:(Number(value.amount)/100).toFixed(2)})
export default async function MurooraShopPage({searchParams}:{searchParams:Promise<{q?:string}>}){
 const {q}=await searchParams
 const [sourceProducts,sourceCategories]=await Promise.all([listPublicProducts(),listCategories()])
 const categories:CatalogueCategory[]=sourceCategories.map(category=>({id:category.id,name:category.name,slug:category.slug,description:category.description}))
 const products:CatalogueProduct[]=sourceProducts.map(product=>({id:product.id,name:product.name,slug:product.slug,sku:product.sku,brand:product.brand,description:product.description,unitSize:product.unitSize,price:wireMoney(product.price),promoPrice:product.promoPrice?wireMoney(product.promoPrice):null,category:product.categoryId?{id:product.categoryId,name:product.categoryName!,slug:product.categorySlug!,description:categories.find(item=>item.id===product.categoryId)?.description??null}:null,images:product.images,availability:product.availability}))
 return <main><header className="border-b border-rule bg-[#fff8ed]"><div className="mx-auto max-w-[86rem] px-gutter py-14"><p className="font-mono text-micro font-bold uppercase tracking-label text-accent">Muroora Mart · Personal storefront</p><h1 className="mt-4 max-w-[14ch] text-mega leading-[.95] text-support">Our shelves, our way.</h1><p className="mt-5 max-w-xl text-lead text-ink-soft">Browse Muroora Mart&rsquo;s own catalogue. Publishing here does not place a product on Musuwo until the business shares it.</p></div></header>{products.length?<ShopCatalogue products={products} categories={categories} initialQuery={q??''}/>:<section className="mx-auto max-w-[86rem] px-gutter py-section"><div className="border border-rule bg-paper-sunk px-6 py-16 text-center"><h2 className="text-h2">Nothing to show for now</h2><p className="mt-3 text-ink-soft">Products will appear here as soon as they are available.</p></div></section>}</main>
}
