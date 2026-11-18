'use strict';
// Public synthetic fixture, not application pricing logic.
function netPrice(unitPrice, quantity) {
  if (quantity < 0) return 0;
  return unitPrice * quantity;
}
module.exports = {netPrice};
