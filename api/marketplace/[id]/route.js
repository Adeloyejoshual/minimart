// api/marketplace/[id]/route.js - Product Detail + View Tracking
import MarketplaceProduct from '../../../models/MarketplaceProduct.js';
import { viewQueue } from '../../../queues/viewQueue.js';

export async function GET(req, { params }) {
  try {
    const product = await MarketplaceProduct.findOne({ 
      _id: params.id, 
      active: true, 
      status: 'active',
      deletedAt: null 
    }).lean();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, message: 'Product not found' }), 
        { status: 404 }
      );
    }

    // Queue async view tracking (non-blocking)
    viewQueue.add('increment', { productId: params.id }).catch(console.error);

    return new Response(
      JSON.stringify({ success: true, data: product }), 
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: 'Failed to fetch product' }), 
      { status: 500 }
    );
  }
}
