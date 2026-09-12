import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Store = { shop: { name: string; businessType: string; currency: string }; products: Array<{ id: string; name: string; category: string; price: number; inStock: number; size?: string; color?: string }> };
export default function Storefront() {
  const { slug } = useParams(); const [store, setStore] = useState<Store | null>(null); const [error, setError] = useState(""); const [cart, setCart] = useState<string[]>([]);
  useEffect(() => { fetch(`/api/public/store/${encodeURIComponent(slug || "")}`).then(async (response) => { if (!response.ok) throw new Error("Store not found."); return response.json(); }).then(setStore).catch((err) => setError(err.message)); }, [slug]);
  if (error) return <main className="mx-auto max-w-xl p-8"><Card className="p-8 text-center"><h1 className="text-xl font-semibold">Store unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></Card></main>;
  if (!store) return <main className="p-8 text-center text-sm text-muted-foreground">Loading store…</main>;
  return <main className="mx-auto max-w-6xl p-5 sm:p-8"><header className="mb-8 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Online store</p><h1 className="text-3xl font-bold">{store.shop.name}</h1></div><Button variant="outline">Cart ({cart.length})</Button></header><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{store.products.map((product) => <Card key={product.id} className="p-5"><p className="text-sm text-muted-foreground">{product.category}</p><h2 className="mt-1 font-semibold">{product.name}</h2><p className="mt-3 text-lg font-bold">{store.shop.currency} {product.price.toFixed(2)}</p><p className="mt-1 text-xs text-muted-foreground">{product.inStock} available</p><Button className="mt-5 w-full" onClick={() => setCart((current) => [...current, product.id])}>Add to cart</Button></Card>)}</div><p className="mt-8 text-center text-xs text-muted-foreground">Online checkout and delivery are enabled after merchant payment and fulfilment setup.</p></main>;
}
