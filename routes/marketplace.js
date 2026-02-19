// api/marketplace.js (POST)
import MarketplaceProduct from '../../models/MarketplaceProduct.js';

export async function POST(req) {
  try {
    const productData = await req.json();
    
    const product = new MarketplaceProduct(productData);
    await product.save();
    
    return new Response(JSON.stringify(product), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
}
