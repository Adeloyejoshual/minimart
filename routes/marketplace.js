// api/marketplace.js - ENTERPRISE POST ENDPOINT
import MarketplaceProduct from '../../models/MarketplaceProduct.js';
import { verifyPaystackPayment } from '../../utils/paystackHelper.js';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req) {
  try {
    const productData = await req.json();
    
    // Payment verification for promoted listings
    if (productData.promoted && productData.payment_reference) {
      const verification = await verifyPaystackPayment(productData.payment_reference);
      if (verification.status !== 'success') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Payment verification failed',
            error: verification.message 
          }), 
          { status: 400 }
        );
      }
      productData.promo_status = 'paid';
    }

    // Generate poster_id if not provided
    if (!productData.poster_id) {
      productData.poster_id = `seller_${uuidv4().slice(0, 8)}`;
    }

    // Ensure location coordinates are properly formatted
    if (productData.latitude && productData.longitude) {
      productData.location = {
        type: 'Point',
        coordinates: [parseFloat(productData.longitude), parseFloat(productData.latitude)]
      };
      delete productData.latitude;
      delete productData.longitude;
    }

    // Sanitize phone numbers
    if (productData.phone_number) {
      productData.phone_number = productData.phone_number.replace(/[^0-9+]/g, '');
    }

    const product = new MarketplaceProduct(productData);
    await product.save();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Product created successfully',
        data: product 
      }), 
      { 
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('POST /marketplace error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Failed to create product',
        validation: error.errors ? Object.values(error.errors).map(e => e.message) : []
      }), 
      { status: 400 }
    );
  }
}
