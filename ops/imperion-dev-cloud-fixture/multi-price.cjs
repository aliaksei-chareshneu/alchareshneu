'use strict';
// Public synthetic fixture, not application pricing logic.
function netPrice(unitPrice, quantity) {
  return quantity < 0 ? 0 : unitPrice * quantity;
}
module.exports = {netPrice};
