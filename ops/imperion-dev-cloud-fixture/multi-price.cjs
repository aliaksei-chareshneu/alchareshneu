'use strict';
// Public synthetic fixture, not application pricing logic. Computes net price from unit price and quantity.
function netPrice(unitPrice, quantity) {
  return unitPrice * quantity;
}
module.exports = {netPrice};
