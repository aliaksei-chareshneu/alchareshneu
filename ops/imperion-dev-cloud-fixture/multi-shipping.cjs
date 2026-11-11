'use strict';
// Public synthetic fixture, not an actual shipping offer. Provides the total price by adding delivery cost to subtotal.
function totalWithDelivery(subtotal, delivery) {
  return subtotal + delivery;
}
module.exports = {totalWithDelivery};
