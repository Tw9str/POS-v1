// Barrel re-export — all merchant actions split into domain files
export type { ActionResult } from "./_shared";
export {
  createProduct,
  updateProduct,
  deleteProduct,
  generateSku,
  createCategory,
  updateCategory,
  deleteCategory,
  saveCategoryAction,
} from "./products";
export {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  collectPayment,
  getCustomerPayments,
  getCustomerCreditOrders,
} from "./customers";
export { createOrder, processOrderAction } from "./orders";
export { createStaff, updateStaff, toggleStaffActive } from "./staff";
export { createSupplier, updateSupplier, deleteSupplier } from "./suppliers";
export {
  getPromotions,
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
  validatePromoCode,
  savePromotionAction,
} from "./promotions";
export {
  createInventoryAdjustment,
  getInventoryAdjustments,
  adjustInventoryFormAction,
} from "./inventory";
export {
  updateSettings,
  updateQuickSettings,
  completeOnboarding,
} from "./settings";
