'use strict';
// Public synthetic fixture, not an actual shipping offer. Computes total price including delivery cost.
function totalWithDelivery(subtotal, delivery) {
  return subtotal + delivery;
}
module.exports = {totalWithDelivery};
