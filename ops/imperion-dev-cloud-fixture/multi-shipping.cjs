'use strict';
// Public synthetic fixture: represents shipping cost calculation (not a real offer).
function totalWithDelivery(subtotal, delivery) {
  return subtotal + delivery;
}
module.exports = {totalWithDelivery};
