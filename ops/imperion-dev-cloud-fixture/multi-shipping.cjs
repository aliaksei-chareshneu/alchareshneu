'use strict';
// Public synthetic fixture, not an actual shipping offer.
function totalWithDelivery(subtotal, delivery) {
  return subtotal + delivery;
}
module.exports = {totalWithDelivery};
