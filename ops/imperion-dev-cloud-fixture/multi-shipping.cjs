'use strict';
// Public synthetic fixture representing a simple shipping helper; not a real shipping offer.
function totalWithDelivery(subtotal, delivery) {
  return subtotal + delivery;
}
module.exports = {totalWithDelivery};
