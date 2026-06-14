// routes/cart/cart.repository.js
import { pool }       from "../../server.js";
import { CartErrors } from "./cart.errors.js";

const SQL = {
  UPSERT_CART: `
    INSERT INTO market.carts (user_id)
    VALUES ($1)
    ON CONFLICT (user_id)
    DO UPDATE SET updated_at = now()
    RETURNING id, user_id, created_at, updated_at
  `,

  GET_CART_ITEMS: `
    SELECT
      ci.id,
      ci.cart_id,
      ci.product_id,
      ci.variant_id,
      ci.qty,
      ci.price::FLOAT                             AS saved_price,
      ci.created_at,
      ci.updated_at,

      p.name                                      AS product_name,
      p.slug                                      AS product_slug,
      p.status                                    AS product_status,
      p.is_active                                 AS product_is_active,
      p.is_hidden                                 AS product_is_hidden,
      p.is_paused                                 AS product_is_paused,
      p.deleted_at                                AS product_deleted_at,
      p.brand                                     AS product_brand,
      p.category                                  AS product_category,
      p.condition                                 AS product_condition,
      p.return_policy,
      p.warranty,

      COALESCE(pv.price::FLOAT, p.price::FLOAT)   AS live_price,

      pv.stock                                    AS live_stock,
      pv.name                                     AS variant_name,
      pv.sku                                      AS variant_sku,
      pv.attributes                               AS variant_attributes,

      pi.image_url                                AS primary_image

    FROM market.cart_items ci
    JOIN market.products p
      ON p.id = ci.product_id
    LEFT JOIN market.product_variants pv
      ON pv.id = ci.variant_id
    LEFT JOIN market.product_images pi
      ON  pi.product_id = ci.product_id
      AND pi.is_primary  = true
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at ASC
  `,

  GET_PRODUCT_FOR_UPDATE: `
    SELECT
      id, name,
      price::FLOAT  AS price,
      status, is_active, is_hidden, is_paused,
      deleted_at, is_flagged, fraud_score
    FROM market.products
    WHERE id = $1
    FOR UPDATE
  `,

  GET_VARIANT_FOR_UPDATE: `
    SELECT
      id, product_id, name, sku,
      price::FLOAT  AS price,
      stock, attributes
    FROM market.product_variants
    WHERE id = $1 AND product_id = $2
    FOR UPDATE
  `,

  UPSERT_CART_ITEM: `
    INSERT INTO market.cart_items
      (cart_id, product_id, variant_id, qty, price)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (
      cart_id, product_id,
      (COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'))
    )
    DO UPDATE SET
      qty        = LEAST(market.cart_items.qty + EXCLUDED.qty, 99),
      price      = EXCLUDED.price,
      updated_at = now()
    RETURNING *
  `,

  GET_CART_ITEM: `
    SELECT *
    FROM market.cart_items
    WHERE id = $1 AND cart_id = $2
    FOR UPDATE
  `,

  UPDATE_QTY: `
    UPDATE market.cart_items
    SET qty = $1, updated_at = now()
    WHERE id = $2 AND cart_id = $3
    RETURNING *
  `,

  REMOVE_ITEM: `
    DELETE FROM market.cart_items
    WHERE id = $1 AND cart_id = $2
    RETURNING id
  `,

  CLEAR_CART: `
    DELETE FROM market.cart_items
    WHERE cart_id = $1
  `,

  TOUCH_CART: `
    UPDATE market.carts
    SET updated_at = now()
    WHERE id = $1
  `,

  VALIDATE_FOR_CHECKOUT: `
    SELECT
      ci.id                                       AS item_id,
      ci.product_id,
      ci.variant_id,
      ci.qty,
      ci.price::FLOAT                             AS saved_price,

      COALESCE(pv.price::FLOAT, p.price::FLOAT)   AS live_price,
      pv.stock                                    AS live_stock,

      p.name                                      AS product_name,
      p.status,
      p.is_active,
      p.is_hidden,
      p.is_paused,
      p.deleted_at

    FROM market.cart_items ci
    JOIN market.products p ON p.id = ci.product_id
    LEFT JOIN market.product_variants pv ON pv.id = ci.variant_id
    WHERE ci.cart_id = $1
    FOR UPDATE
  `,
};

class CartRepository {
  async withTransaction(fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Cart ──────────────────────────────────────────────

  async upsertCart(userId) {
    const { rows } = await pool.query(SQL.UPSERT_CART, [userId]);
    return rows[0];
  }

  async getCartItems(cartId) {
    const { rows } = await pool.query(SQL.GET_CART_ITEMS, [cartId]);
    return rows;
  }

  async touchCart(cartId, client = null) {
    const runner = client ?? pool;
    await runner.query(SQL.TOUCH_CART, [cartId]);
  }

  // ── Add item ──────────────────────────────────────────

  async addItem(cartId, productId, variantId, qty) {
    return this.withTransaction(async (client) => {

      // 1. Lock + validate product
      const { rows: pRows } = await client.query(
        SQL.GET_PRODUCT_FOR_UPDATE, [productId]
      );

      if (pRows.length === 0) {
        throw CartErrors.productNotFound(productId);
      }

      const product = pRows[0];

      // 2. Check availability
      if (product.deleted_at) {
        throw CartErrors.productUnavailable("product has been deleted");
      }
      if (product.status !== "active") {
        throw CartErrors.productUnavailable(`status is "${product.status}"`);
      }
      if (!product.is_active) {
        throw CartErrors.productUnavailable("product is not active");
      }
      if (product.is_hidden) {
        throw CartErrors.productUnavailable("product is hidden");
      }
      if (product.is_paused) {
        throw CartErrors.productUnavailable("product is paused");
      }
      if (product.is_flagged && product.fraud_score > 80) {
        throw CartErrors.productUnavailable("product is under review");
      }

      // 3. Variant check + stock
      let livePrice = Number(product.price);

      if (variantId) {
        const { rows: vRows } = await client.query(
          SQL.GET_VARIANT_FOR_UPDATE, [variantId, productId]
        );

        if (vRows.length === 0) {
          throw CartErrors.variantNotFound(variantId);
        }

        const variant = vRows[0];

        if (variant.product_id !== productId) {
          throw CartErrors.variantMismatch(variantId, productId);
        }
        if (variant.stock <= 0) {
          throw CartErrors.outOfStock(productId);
        }
        if (variant.stock < qty) {
          throw CartErrors.insufficientStock(variant.stock, qty);
        }

        livePrice = Number(variant.price);
      }

      // 4. Upsert item
      const { rows: itemRows } = await client.query(
        SQL.UPSERT_CART_ITEM,
        [cartId, productId, variantId ?? null, qty, livePrice]
      );

      await this.touchCart(cartId, client);

      return itemRows[0];
    });
  }

  // ── Update qty ────────────────────────────────────────

  async updateQty(cartId, itemId, qty) {
    return this.withTransaction(async (client) => {

      const { rows: itemRows } = await client.query(
        SQL.GET_CART_ITEM, [itemId, cartId]
      );

      if (itemRows.length === 0) {
        throw CartErrors.itemNotFound(itemId);
      }

      const item = itemRows[0];

      if (item.variant_id) {
        const { rows: vRows } = await client.query(
          `SELECT stock FROM market.product_variants
           WHERE id = $1 FOR UPDATE`,
          [item.variant_id]
        );

        if (vRows.length > 0) {
          const stock = Number(vRows[0].stock);
          if (stock <= 0) throw CartErrors.outOfStock(item.product_id);
          if (stock < qty) throw CartErrors.insufficientStock(stock, qty);
        }
      }

      const { rows } = await client.query(
        SQL.UPDATE_QTY, [qty, itemId, cartId]
      );

      await this.touchCart(cartId, client);

      return rows[0];
    });
  }

  // ── Remove item ───────────────────────────────────────

  async removeItem(cartId, itemId) {
    const { rows } = await pool.query(SQL.REMOVE_ITEM, [itemId, cartId]);
    if (rows.length === 0) throw CartErrors.itemNotFound(itemId);
    await this.touchCart(cartId);
    return rows[0];
  }

  // ── Clear cart ────────────────────────────────────────

  async clearCart(cartId) {
    await pool.query(SQL.CLEAR_CART, [cartId]);
    await this.touchCart(cartId);
  }

  // ── Checkout validation ───────────────────────────────

  async getItemsForCheckout(cartId) {
    const { rows } = await pool.query(SQL.VALIDATE_FOR_CHECKOUT, [cartId]);
    return rows;
  }
}

const cartRepository = new CartRepository();
export default cartRepository;