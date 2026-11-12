'use strict';
// Public synthetic fixture, not application pricing logic.
function netPrice(unitPrice, quantity) {
  return unitPrice * quantity;
}
module.exports = {netPrice};
