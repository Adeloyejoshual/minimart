// routes/cart/cart.controller.js
import cartService from "./cart.service.js";
import {
  validateAddItem,
  validateUpdateQty,
  validateRemoveItem,
} from "./cart.validators.js";
import { CartErrors } from "./cart.errors.js";

class CartController {
  getCart = async (req, res, next) => {
    try {
      const cart = await cartService.getCart(req.user.id);
      return res.status(200).json({ success: true, data: cart });
    } catch (err) {
      next(err);
    }
  };

  addItem = async (req, res, next) => {
    try {
      const issues = validateAddItem(req.body);
      if (issues.length > 0) {
        throw CartErrors.validationError(issues);
      }

      const { product_id, variant_id = null, qty } = req.body;

      const item = await cartService.addItem(
        req.user.id,
        product_id,
        variant_id,
        qty
      );

      return res.status(201).json({
        success: true,
        message: "Item added to cart",
        data:    item,
      });
    } catch (err) {
      next(err);
    }
  };

  updateQty = async (req, res, next) => {
    try {
      const issues = validateUpdateQty(req.body, req.params);
      if (issues.length > 0) {
        throw CartErrors.validationError(issues);
      }

      const { itemId } = req.params;
      const { qty }    = req.body;

      const item = await cartService.updateQty(req.user.id, itemId, qty);

      return res.status(200).json({
        success: true,
        message: "Quantity updated",
        data:    item,
      });
    } catch (err) {
      next(err);
    }
  };

  removeItem = async (req, res, next) => {
    try {
      const issues = validateRemoveItem(req.params);
      if (issues.length > 0) {
        throw CartErrors.validationError(issues);
      }

      const { itemId } = req.params;
      await cartService.removeItem(req.user.id, itemId);

      return res.status(200).json({
        success: true,
        message: "Item removed from cart",
      });
    } catch (err) {
      next(err);
    }
  };

  clearCart = async (req, res, next) => {
    try {
      await cartService.clearCart(req.user.id);
      return res.status(200).json({
        success: true,
        message: "Cart cleared",
      });
    } catch (err) {
      next(err);
    }
  };

  validateCheckout = async (req, res, next) => {
    try {
      const result = await cartService.validateForCheckout(req.user.id);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      if (err.code === "CART_HAS_VIOLATIONS") {
        return res.status(409).json({
          success:    false,
          error:      err.code,
          message:    err.message,
          violations: err.context?.violations ?? [],
        });
      }
      next(err);
    }
  };
}

const cartController = new CartController();
export default cartController;