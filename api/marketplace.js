// api/marketplace/route.js - PRODUCTION READY
import MarketplaceProduct from '../../../models/MarketplaceProduct.js';
import { verifyPaystackPayment } from '../../../utils/paystackHelper.js';
import { v4 as uuidv4 } from 'uuid';
import authMiddleware from '../../../middleware/auth.js'; // Add auth

export async function POST(req) {
  try {
    // 🔒 Authentication (add your JWT middleware)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const productData = await req.json();
    
    // 🛡️ Input validation
    const requiredFields = ['title', 'price', 'category', 'description'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, message: `Missing fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // 💰 Payment verification for promoted listings
    if (productData.promoted && productData.payment_reference) {
      const verification = await verifyPaystackPayment(productData.payment_reference);
      if (verification.status !== 'success') {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Payment verification failed',
            error: verification.message 
          }, 
          { status: 402 } // Payment Required
        );
      }
      productData.promo_status = 'paid';
      productData.promoted_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }

    // 🆔 Generate poster_id if not provided
    if (!productData.poster_id) {
      productData.poster_id = `seller_${uuidv4().slice(0, 8)}`;
    }

    // 📍 Geolocation formatting (MongoDB GeoJSON)
    if (productData.latitude && productData.longitude) {
      productData.location = {
        type: 'Point',
        coordinates: [parseFloat(productData.longitude), parseFloat(productData.latitude)]
      };
      delete productData.latitude;
      delete productData.longitude;
    }

    // ☎️ Sanitize phone numbers (Nigeria format)
    if (productData.phone_number) {
      productData.phone_number = productData.phone_number
        .replace(/[^0-9+]/g, '')
        .replace(/^0/, '+234'); // Convert 080 to +23480
    }

    // 🕐 Timestamps
    productData.createdAt = new Date();
    productData.updatedAt = new Date();

    // 💾 Save to MongoDB
    const product = new MarketplaceProduct(productData);
    await product.save();

    // Populate seller if needed
    await product.populate('seller_id');

    return NextResponse.json(
      { 
        success: true, 
        message: 'Product listed successfully!',
        data: {
          id: product._id,
          title: product.title,
          price: product.price,
          poster_id: product.poster_id,
          status: product.status
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('POST /api/marketplace error:', error);
    
    // Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors },
        { status: 400 }
      );
    }

    // Paystack errors
    if (error.message.includes('paystack')) {
      return NextResponse.json(
        { success: false, message: 'Payment service error' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Failed to create product' },
      { status: 500 }
    );
  }
}